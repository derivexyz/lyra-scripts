

// needs to query the graph for each markets trades
// determine how much the person paid in fees
// determine if they are long or short

import { getStkLyraBalance } from "../stkLyra/getStkLyraData";
import { TradingRewardsConfig } from ".";
import { CooldownEvent } from '../config'
import { AllDeltaSnapshots } from './getAllOptionDeltaSnapshots'
import { AllTrades, TradeResult } from './getAllTrades'
import { AllStrikeDetails } from './getAllStrikeDetails'
import { AllTransfers } from './getAllOptionTransfers'
import { ethers } from 'ethers'

export type TradingRewards = {
  totalLyraRebate: number,
  totalOpRebate: number,
  lyraScaleFactor: number,
  opScaleFactor: number,
  totalUnscaledRebateDollars: number,
  totalTradingUnscaledRebateDollars: number,
  totalCollatUnscaledRebateDollars: number,
  totalFees: number,
  tradingRebates: {
    totalLyraRebate: number,
    totalOpRebate: number,
  },
  shortCollat: {
    totalShortCallSeconds: number,
    totalShortPutSeconds: number,
    totalLyraRebate: number,
    totalOpRebate: number,
  },
}

type RawRebate = {
  fees: number // USD
  rebate: number // total after boosts, USD
  baseRebateRate: number // before xLyra, percentage
  boostedRebateRate: number // after xLyra percentage
}

export type UserTradingRebate = {
  // For trading rebates
  fees: number, // USD
  effectiveRebateRate: number, // post xLyra, percentage
  totalTradingRebateDollars: number,

  // For short collat
  totalShortCallSeconds: number,
  totalShortPutSeconds: number,
  totalCollatRebateDollars: number,

  // totals
  totalRebateDollars: number,

  // scaled totals
  lyraRebate: number,
  opRebate: number
}

export type UserRebates = {
  [user: string]: UserTradingRebate;
}

export async function getTradingRewards(
  startTs: number, endTs: number, latestTs: number, enabledTradingRewardMarkets: string[], rewardsConfig: TradingRewardsConfig, cooldownEvents: CooldownEvent[], allTrades: AllTrades, allDeltaSnapshots: AllDeltaSnapshots, allStrikeDetails: AllStrikeDetails, allTransfers: AllTransfers) : Promise<[TradingRewards, UserRebates]> {

  let tradingRewards: TradingRewards = {
    totalLyraRebate: 0,
    totalOpRebate: 0,
    lyraScaleFactor: 1,
    opScaleFactor: 1,
    totalUnscaledRebateDollars: 0,
    totalTradingUnscaledRebateDollars: 0,
    totalCollatUnscaledRebateDollars: 0,
    totalFees: 0,
    tradingRebates: {
      totalLyraRebate: 0,
      totalOpRebate: 0,
    },
    shortCollat: {
      totalShortCallSeconds: 0,
      totalShortPutSeconds: 0,
      totalLyraRebate: 0,
      totalOpRebate: 0,
    },
  }
  let userRebates: UserRebates = {};

  for (const market of enabledTradingRewardMarkets) {
    // fetch all trades in an epoch

    //////
    // Trading Fee rebates
    //////
    for(const trade of allTrades[market]) {
      if (trade.timestamp < startTs || trade.timestamp >= endTs) {
        continue;
      }
      const tradingRebate = await calculateTradingRebate(trade, rewardsConfig, cooldownEvents);
      if (!userRebates[trade.trader]) {
        userRebates[trade.trader] = {
          // For trading rebates
          fees: 0, // USD
          effectiveRebateRate: 0, // post xLyra, percentage
          totalTradingRebateDollars: 0,

          // For short collat
          totalShortCallSeconds: 0,
          totalShortPutSeconds: 0,
          totalCollatRebateDollars: 0,

          // totals
          totalRebateDollars: 0,

          // scaled totals
          lyraRebate: 0,
          opRebate: 0
        };
      }

      // Add in total fees to stats
      userRebates[trade.trader].fees += tradingRebate.fees;
      tradingRewards.totalFees += tradingRebate.fees;
      // Add in rebate dollars to stats
      tradingRewards.totalUnscaledRebateDollars += tradingRebate.rebate;
      tradingRewards.totalTradingUnscaledRebateDollars += tradingRebate.rebate;
      userRebates[trade.trader].totalTradingRebateDollars += tradingRebate.rebate;
      userRebates[trade.trader].totalRebateDollars += tradingRebate.rebate;

      // Calculate lyra/op amounts
      const lyraRebate = (tradingRebate.rebate * rewardsConfig.rewards.lyraPortion / rewardsConfig.rewards.fixedLyraPrice) || 0;
      const opRebate = (tradingRebate.rebate * (1 - rewardsConfig.rewards.lyraPortion) / rewardsConfig.rewards.fixedOpPrice) || 0;

      userRebates[trade.trader].lyraRebate += (lyraRebate >= 0 ? lyraRebate : 0);
      userRebates[trade.trader].opRebate += (opRebate >= 0 ? opRebate : 0);
      tradingRewards.tradingRebates.totalLyraRebate += (lyraRebate >= 0 ? lyraRebate : 0);
      tradingRewards.tradingRebates.totalOpRebate += (opRebate >= 0 ? opRebate : 0);
      tradingRewards.totalLyraRebate += (lyraRebate >= 0 ? lyraRebate : 0);
      tradingRewards.totalOpRebate += (opRebate >= 0 ? opRebate : 0);
    }

  }

  ///////
  // Short collat rewards
  ///////
  const shortCollatRewards = await calculateShortCollatRewards(startTs, endTs, latestTs, rewardsConfig, allTrades, allDeltaSnapshots, allStrikeDetails, allTransfers);
  for (const user of Object.keys(shortCollatRewards)) {
    if (!userRebates[user]) {
      userRebates[user] = {
        // For trading rebates
        fees: 0, // USD
        effectiveRebateRate: 0, // post xLyra, percentage
        totalTradingRebateDollars: 0,

        // For short collat
        totalShortCallSeconds: 0,
        totalShortPutSeconds: 0,
        totalCollatRebateDollars: 0,

        // totals
        totalRebateDollars: 0,

        // scaled totals
        lyraRebate: 0,
        opRebate: 0
      };
    }

    tradingRewards.shortCollat.totalShortCallSeconds += (shortCollatRewards[user].totalShortCallAmtSec > 0 ? shortCollatRewards[user].totalShortCallAmtSec : 0);
    tradingRewards.shortCollat.totalShortPutSeconds += (shortCollatRewards[user].totalShortPutAmtSec > 0 ? shortCollatRewards[user].totalShortPutAmtSec : 0);
    userRebates[user].totalShortCallSeconds += (shortCollatRewards[user].totalShortCallAmtSec > 0 ? shortCollatRewards[user].totalShortCallAmtSec : 0);
    userRebates[user].totalShortPutSeconds += (shortCollatRewards[user].totalShortPutAmtSec > 0 ? shortCollatRewards[user].totalShortPutAmtSec : 0);

    // add in total reward dollars to stats
    tradingRewards.totalUnscaledRebateDollars += (shortCollatRewards[user].totalRewardDollars > 0 ? shortCollatRewards[user].totalRewardDollars : 0);
    tradingRewards.totalCollatUnscaledRebateDollars += (shortCollatRewards[user].totalRewardDollars > 0 ? shortCollatRewards[user].totalRewardDollars : 0);
    userRebates[user].totalCollatRebateDollars += (shortCollatRewards[user].totalRewardDollars > 0 ? shortCollatRewards[user].totalRewardDollars : 0);
    userRebates[user].totalRebateDollars += (shortCollatRewards[user].totalRewardDollars > 0 ? shortCollatRewards[user].totalRewardDollars : 0);

    // Calculate lyra/op rebates
    const lyraRebate = shortCollatRewards[user].totalRewardDollars * rewardsConfig.rewards.lyraPortion / rewardsConfig.rewards.fixedLyraPrice;
    const opRebate = shortCollatRewards[user].totalRewardDollars * (1 - rewardsConfig.rewards.lyraPortion) / rewardsConfig.rewards.fixedOpPrice

    userRebates[user].opRebate += (opRebate > 0 ? opRebate : 0);
    userRebates[user].lyraRebate += (lyraRebate > 0 ? lyraRebate : 0);
    tradingRewards.shortCollat.totalLyraRebate += (lyraRebate > 0 ? lyraRebate : 0);
    tradingRewards.shortCollat.totalOpRebate += (opRebate > 0 ? opRebate : 0);
    tradingRewards.totalLyraRebate += (lyraRebate > 0 ? lyraRebate : 0);
    tradingRewards.totalOpRebate += (opRebate > 0 ? opRebate : 0);
  }

  // scale down rewards if cap reached and compute final rebate rate
  if (tradingRewards.totalLyraRebate > rewardsConfig.rewards.lyraRewardsCap) {
    tradingRewards.lyraScaleFactor = rewardsConfig.rewards.lyraRewardsCap / tradingRewards.totalLyraRebate;
    tradingRewards.totalLyraRebate = rewardsConfig.rewards.lyraRewardsCap;
  }

  if (tradingRewards.totalOpRebate > rewardsConfig.rewards.opRewardsCap) {
    tradingRewards.opScaleFactor = rewardsConfig.rewards.opRewardsCap / tradingRewards.totalOpRebate;
    tradingRewards.totalOpRebate = rewardsConfig.rewards.opRewardsCap;
  }

  for (const user of Object.keys(userRebates)) {
    userRebates[user].lyraRebate = userRebates[user].lyraRebate * tradingRewards.lyraScaleFactor;
    userRebates[user].opRebate = userRebates[user].opRebate * tradingRewards.opScaleFactor;

    const scaledLyraPortionDollars = userRebates[user].totalTradingRebateDollars * rewardsConfig.rewards.lyraPortion * tradingRewards.lyraScaleFactor;
    const scaledOPPortion = userRebates[user].totalTradingRebateDollars * (1 - rewardsConfig.rewards.lyraPortion) * tradingRewards.opScaleFactor;

    if (userRebates[user].fees !== 0) {
      userRebates[user].effectiveRebateRate = (scaledLyraPortionDollars + scaledOPPortion) / userRebates[user].fees;
    }
  }

  return [tradingRewards, userRebates];
}

// returns dollar amount of fees applicable for redemption
function calculateTradingRebate(tradesObject: TradeResult, config: TradingRewardsConfig, cooldownEvents: CooldownEvent[]): RawRebate {

  const totalFee = tradesObject.spotPriceFee + tradesObject.vegaUtilFee + tradesObject.optionPriceFee + tradesObject.varianceFee;

  // get lyra balance and calculate rebate
  // rebate percentage == min(maxRebate, c + max(0, a(b+log(x/d))))
  const userBalanceAtTrade = getStkLyraBalance(tradesObject.trader, cooldownEvents, tradesObject.timestamp);
  let rebate;
  if (config.useRebateTable) {
    rebate = Math.max(...config.rebateRateTable.filter(x => userBalanceAtTrade >= x.cutoff).map(x => x.returnRate))
  } else {
    rebate = Math.min(
      config.maxRebatePercentage,
      config.vertIntercept + Math.max(
        0,
        config.netVerticalStretch * (config.verticalShift + Math.log(userBalanceAtTrade / config.stretchiness))
      )
    );
  }
  // cap token rewards based on floorTokenPrice
  return {
    fees: totalFee, 
    rebate: totalFee * rebate, 
    baseRebateRate: config.vertIntercept,
    boostedRebateRate: rebate,
  } as RawRebate;
}

function calculateShortCollatRewards(startTs: number, endTs: number, latestTs: number, rewardsConfig: TradingRewardsConfig, allTrades: AllTrades, allDeltaSnapshots: AllDeltaSnapshots, allStrikeDetails: AllStrikeDetails, allTransfers: AllTransfers): Promise<{[user: string]: {
    totalRewardDollars: number,
    totalShortCallAmtSec: number,
    totalShortPutAmtSec: number
  }}> {

  const perUserRewards: any = {}

  for (const market of Object.keys(allDeltaSnapshots)) {
    for (const strike of Object.keys(allDeltaSnapshots[market])) {
      const snaps = allDeltaSnapshots[market][strike].sort((x, y) => {
        return x.timestamp - y.timestamp;
      });
      let firstSnap = true;
      for (let i=0; i < snaps.length; i++) {
        if (snaps[i].timestamp >= endTs) {
          // dont count anything that happens after the epoch period
          break;
        }

        if (i < snaps.length - 1 && snaps[i + 1].timestamp <= startTs) {
          // skip snapshots until we hit one relevant to the reward epoch
          continue;
        }

        let countStart;
        if (firstSnap) {
          countStart = startTs;
          firstSnap = false;
        } else {
          countStart = snaps[i].timestamp;
        }

        let countEnd;
        if (i == snaps.length - 1) {
          countEnd = Math.min(endTs, latestTs, allStrikeDetails[market][strike].expiryTimestamp)
        } else {
          countEnd = snaps[i + 1].timestamp;
        }

        if (countStart > countEnd) {
          continue;
        }

        const [perUserShortCallAmtSec, perUserShortPutAmtSec] = getAvgShortAmountPerUser(countStart, countEnd, market, parseInt(strike), allTrades, allTransfers);

        const callDelta = snaps[i].delta;

        let callReward;
        let putReward;
        const marketShortCollatRewards = rewardsConfig.shortCollatRewards[market]
        if (callDelta > 0.1 && callDelta < 0.9) {
          const rewardsDiff = marketShortCollatRewards.ninetyDeltaRebatePerOptionDay - marketShortCollatRewards.tenDeltaRebatePerOptionDay
          callReward = marketShortCollatRewards.tenDeltaRebatePerOptionDay + (rewardsDiff * ((callDelta - 0.1) / 0.8))
          putReward = marketShortCollatRewards.tenDeltaRebatePerOptionDay + rewardsDiff - (rewardsDiff * ((callDelta - 0.1) / 0.8))
        } else if (callDelta <= 0.1) {
          callReward = marketShortCollatRewards.tenDeltaRebatePerOptionDay;
          putReward = marketShortCollatRewards.ninetyDeltaRebatePerOptionDay;
        } else {
          callReward = marketShortCollatRewards.ninetyDeltaRebatePerOptionDay;
          putReward = marketShortCollatRewards.tenDeltaRebatePerOptionDay;
        }

        if (allStrikeDetails[market][strike].expiryTimestamp - countStart > (4 * 7 * 24 * 60 * 60)) {
          callReward = callReward * marketShortCollatRewards.longDatedPenalty;
          putReward = putReward * marketShortCollatRewards.longDatedPenalty;
        }


        for (const user of Object.keys(perUserShortCallAmtSec)) {
          if (!perUserRewards[user]) {
            perUserRewards[user] = {
              totalRewardDollars: 0,
              totalShortCallAmtSec: 0,
              totalShortPutAmtSec: 0
            }
          }
          perUserRewards[user].totalRewardDollars += callReward * perUserShortCallAmtSec[user] / (24 * 60 * 60);
          perUserRewards[user].totalShortCallAmtSec += perUserShortCallAmtSec[user];
        }
        for (const user of Object.keys(perUserShortPutAmtSec)) {
          if (!perUserRewards[user]) {
            perUserRewards[user] = {
              totalRewardDollars: 0,
              totalShortCallAmtSec: 0,
              totalShortPutAmtSec: 0
            }
          }
          perUserRewards[user].totalRewardDollars += (putReward * perUserShortPutAmtSec[user] / (24 * 60 * 60) || 0)
          perUserRewards[user].totalShortPutAmtSec += (perUserShortPutAmtSec[user] || 0);
        }
      }
    }
  }

  return perUserRewards;
}

function getAvgShortAmountPerUser(start: number, end: number, market: string, strike: number, allTrades: AllTrades, allTransfers: AllTransfers) {
  const perUserShortCallAmtSeconds: any = {}
  const perUserShortPutAmtSeconds: any = {}

  for (const trade of allTrades[market]) {
    if (trade.strikeId != strike) {
      continue;
    }
    if (trade.isLong) {
      continue;
    }
    if (trade.timestamp >= end) {
      continue;
    }

    const fromTime = Math.max(start, trade.timestamp);

    if (trade.isCall) {
      if (!perUserShortCallAmtSeconds[trade.trader]) {
        perUserShortCallAmtSeconds[trade.trader] = 0;
      }
      // note trade.size is negative for closes
      perUserShortCallAmtSeconds[trade.trader] += trade.size * (end - fromTime);
    } else {
      if (!perUserShortPutAmtSeconds[trade.trader]) {
        perUserShortPutAmtSeconds[trade.trader] = 0;
      }
      // note trade.size is negative for closes
      perUserShortPutAmtSeconds[trade.trader] += trade.size * (end - fromTime);
    }
  }

  for (const transfer of (allTransfers[market] || [])) {
    if (transfer.isLong || transfer.strikeId != strike || transfer.timestamp >= end) {
      continue;
    }

    let sizeAtTransfer = 0;
    let found = false;
    // figure out the size of the position at time of transfer
    for (const trade of allTrades[market]) {
      if (trade.positionId !== transfer.positionId) {
        continue;
      }
      if (trade.timestamp > transfer.timestamp) {
        continue;
      }
      if (trade.timestamp >= end) {
        continue;
      }

      if (trade.timestamp == transfer.timestamp) {
        console.warn("Trade timestamp == transfer timestamp. Need to fix to make sure order is maintained correctly.")
        // console.log(trade);
        // console.log(transfer);
        console.log({sizeAtTransfer});
        // continue;
      }
      // we've found a match, but early exit if the strike doesnt match what we need...
      // highly inefficient
      if (trade.strikeId != strike) {
        throw Error("Mismatching strikes???")
      }
      sizeAtTransfer += trade.size;
      found = true;
    }

    if (!found) {
      throw Error("no trades found for transfer...");
    }

    if (sizeAtTransfer == 0) {
      // throw Error("sizeAtTransfer is 0, should be impossible")
      console.warn("sizeAtTransfer is 0")
      continue;
    }

    const fromTime = Math.min(Math.max(start, transfer.timestamp), end);
    if (transfer.isCall) {
      if (!perUserShortCallAmtSeconds[transfer.oldOwner]) {
        if (transfer.oldOwner === "0x9cB46586C9ec74E4D9De6cD67c760F89915bBcD8") {
          continue;
        }
        throw Error("impossible state calls")
      }
      if (!perUserShortCallAmtSeconds[transfer.newOwner]) {
        perUserShortCallAmtSeconds[transfer.newOwner] = 0;
      }
      perUserShortCallAmtSeconds[transfer.oldOwner] -= sizeAtTransfer * (end - fromTime)
      perUserShortCallAmtSeconds[transfer.newOwner] += sizeAtTransfer * (end - fromTime)
    } else {
      if (!perUserShortPutAmtSeconds[transfer.oldOwner]) {
        if (transfer.oldOwner === "0x9cB46586C9ec74E4D9De6cD67c760F89915bBcD8") {
          continue;
        }
        throw Error("impossible state puts")
      }
      if (!perUserShortPutAmtSeconds[transfer.newOwner]) {
        perUserShortPutAmtSeconds[transfer.newOwner] = 0;
      }
      perUserShortPutAmtSeconds[transfer.oldOwner] -= sizeAtTransfer * (end - fromTime)
      perUserShortPutAmtSeconds[transfer.newOwner] += sizeAtTransfer * (end - fromTime)
    }
  }
  //
  // console.log(perUserShortCallAmtSeconds[])
  // console.log(perUserShortPutAmtSeconds[])

  return [perUserShortCallAmtSeconds, perUserShortPutAmtSeconds];
}
