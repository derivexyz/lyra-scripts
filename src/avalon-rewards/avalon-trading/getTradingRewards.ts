

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
      const lyraRebate = tradingRebate.rebate * rewardsConfig.rewards.lyraPortion / rewardsConfig.rewards.fixedLyraPrice;
      const opRebate = tradingRebate.rebate * (1 - rewardsConfig.rewards.lyraPortion) / rewardsConfig.rewards.fixedOpPrice

      userRebates[trade.trader].lyraRebate += lyraRebate;
      userRebates[trade.trader].opRebate += opRebate;
      tradingRewards.tradingRebates.totalLyraRebate += lyraRebate;
      tradingRewards.tradingRebates.totalOpRebate += opRebate;
      tradingRewards.totalLyraRebate += lyraRebate;
      tradingRewards.totalOpRebate += opRebate;
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

    tradingRewards.shortCollat.totalShortCallSeconds += shortCollatRewards[user].totalShortCallAmtSec;
    tradingRewards.shortCollat.totalShortPutSeconds += shortCollatRewards[user].totalShortPutAmtSec;
    userRebates[user].totalShortCallSeconds += shortCollatRewards[user].totalShortCallAmtSec;
    userRebates[user].totalShortPutSeconds += shortCollatRewards[user].totalShortPutAmtSec;

    // add in total reward dollars to stats
    tradingRewards.totalUnscaledRebateDollars += shortCollatRewards[user].totalRewardDollars;
    tradingRewards.totalCollatUnscaledRebateDollars += shortCollatRewards[user].totalRewardDollars;
    userRebates[user].totalCollatRebateDollars += shortCollatRewards[user].totalRewardDollars;
    userRebates[user].totalRebateDollars += shortCollatRewards[user].totalRewardDollars;

    // Calculate lyra/op rebates
    const lyraRebate = shortCollatRewards[user].totalRewardDollars * rewardsConfig.rewards.lyraPortion / rewardsConfig.rewards.fixedLyraPrice;
    const opRebate = shortCollatRewards[user].totalRewardDollars * (1 - rewardsConfig.rewards.lyraPortion) / rewardsConfig.rewards.fixedOpPrice

    userRebates[user].opRebate += opRebate;
    userRebates[user].lyraRebate += lyraRebate;
    tradingRewards.shortCollat.totalLyraRebate += lyraRebate;
    tradingRewards.shortCollat.totalOpRebate += opRebate;
    tradingRewards.totalLyraRebate += lyraRebate;
    tradingRewards.totalOpRebate += opRebate;
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
        let putReward
        if (callDelta > 0.1 && callDelta < 0.9) {
          const rewardsDiff = rewardsConfig.shortCollatRewards.ninetyDeltaRebatePerOptionDay - rewardsConfig.shortCollatRewards.tenDeltaRebatePerOptionDay
          callReward = rewardsConfig.shortCollatRewards.tenDeltaRebatePerOptionDay + (rewardsDiff * ((callDelta - 0.1) / 0.8))
          putReward = rewardsConfig.shortCollatRewards.tenDeltaRebatePerOptionDay + rewardsDiff - (rewardsDiff * ((callDelta - 0.1) / 0.8))
        } else if (callDelta <= 0.1) {
          callReward = rewardsConfig.shortCollatRewards.tenDeltaRebatePerOptionDay;
          putReward = rewardsConfig.shortCollatRewards.ninetyDeltaRebatePerOptionDay;
        } else {
          callReward = rewardsConfig.shortCollatRewards.ninetyDeltaRebatePerOptionDay;
          putReward = rewardsConfig.shortCollatRewards.tenDeltaRebatePerOptionDay;
        }

        if (allStrikeDetails[market][strike].expiryTimestamp - countStart > (4 * 7 * 24 * 60 * 60)) {
          callReward = callReward * rewardsConfig.shortCollatRewards.longDatedPenalty;
          putReward = putReward * rewardsConfig.shortCollatRewards.longDatedPenalty;
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
          perUserRewards[user].totalRewardDollars += putReward * perUserShortPutAmtSec[user] / (24 * 60 * 60)
          perUserRewards[user].totalShortPutAmtSec += perUserShortPutAmtSec[user];
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
    if (transfer.isLong || transfer.strikeId != strike) {
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
      // console.log(trade);
      // console.log(transfer);
      if (trade.timestamp == transfer.timestamp) {
        // TODO: pretty sure this is handled fine, but will error and handle manually to make sure if it ever pops up
        console.warn("Trade timestamp == transfer timestamp. Need to fix to make sure order is maintained correctly.")
        console.log(trade);
        console.log(transfer);
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
      throw Error("sizeAtTransfer is 0, should be impossible")
    }

    const fromTime = Math.min(Math.max(start, transfer.timestamp), end);
    console.log({sizeAtTransfer, fromTime})
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
  // console.log(perUserShortCallAmtSeconds)
  // console.log(perUserShortPutAmtSeconds)

  return [perUserShortCallAmtSeconds, perUserShortPutAmtSeconds];
}


//
// calculateShortCollatRewards(
//   1661474000, 1661904000, 1661904001, AVALON_CONFIG['mainnet-ovm-avalon'][0].tradingConfig,
//   {'sETH':[{
//       trader: '0x7694a2898a5d080E241f5033f443694d27Fd1A78',
//       spotPriceFee: 5.50102617873,
//       vegaUtilFee: 0,
//       optionPriceFee: 2.058160336000614,
//       varianceFee: 1.493898519317968,
//       timestamp: 1656411969,
//       strikeId: 156,
//       positionId: 1981,
//       size: 2,
//       isLong: false,
//       isCall: false
//     }]},
//   {
//     'sETH': {'156': [
//       { timestamp: 1660348800, delta: 0.31781545988249216 },
//       { timestamp: 1660435200, delta: 0.32188652780240523 },
//       { timestamp: 1660521600, delta: 0.304211179325455 },
//       { timestamp: 1660608000, delta: 0.2897303595656878 },
//       { timestamp: 1660694400, delta: 0.2673211335142328 },
//       { timestamp: 1660780800, delta: 0.2500582281090298 },
//       { timestamp: 1660867200, delta: 0.2520406589190745 },
//       { timestamp: 1660953600, delta: 0.17899444321510757 },
//       { timestamp: 1661040000, delta: 0.16625262114047124 },
//       { timestamp: 1661126400, delta: 0.18411934936099728 },
//       { timestamp: 1661212800, delta: 0.1806882544271815 },
//       { timestamp: 1661299200, delta: 0.19626165956331965 },
//       { timestamp: 1661385600, delta: 0.19294297359890208 },
//       { timestamp: 1661472000, delta: 0.20391763514967126 },
//       { timestamp: 1661558400, delta: 0.1400419768394571 },
//       { timestamp: 1661644800, delta: 0.13492007250027582 },
//       { timestamp: 1661731200, delta: 0.1110058404778036 }
//     ]
//     }
//   },
//   {
//     'sETH': {'156': { strikeId: 156, expiryTimestamp: 1663920000, strikePrice: 1000 }}
//   },
//   {'sETH': [
//       {
//         positionId: 1981,
//         oldOwner: '0x7694a2898a5d080E241f5033f443694d27Fd1A78',
//         newOwner: '0xB957339804fea2829baBc79294D6e7615705Fd14',
//         timestamp: 1661664800
//       }
//     ]});