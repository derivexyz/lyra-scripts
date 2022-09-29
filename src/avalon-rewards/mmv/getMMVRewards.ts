import { AvalonMMVConfig } from '.'
import { ethers } from 'ethers';
import { StkLyraData } from '../stkLyra/getStkLyraData';
import { Block } from '@ethersproject/abstract-provider'
import { LPEvent } from '../config'
import { DAY_SEC } from '../../constants'

export type AvalonLyraLPData = {
  [market: string] : {
    perUser: {
      [user: string]: {
        lpDays: number,
        lyraRewards: number,
        opRewards: number,
        boostedLpDays: number,
        isIgnored: boolean,
      },
    }
    startTimestamp: number,
    endTimestamp: number,
    lastUpdatedTimestamp: number,
    totalLPDays: number,
    totalBoostedLPDays: number,
    totalLyraRewards: number,
    totalOPRewards: number,
    totalDistributedLyraRewards: number,
    totalDistributedOPRewards: number,
    scaledStkLyraDays: number
  }
}

export async function getMMVRewards(startTs: number, endTs: number, params: AvalonMMVConfig, stkLyraData: StkLyraData, maxBlock: Block, lpEvents: {[market: string]: LPEvent[]}, globalIgnoreList: string[]) {
  let lyraLpData = {} as AvalonLyraLPData;

  for (const market of Object.keys(params)) {
    const ignoreList = [...new Set([...globalIgnoreList, ...params[market].ignoreList].map((x: string) => x.toLowerCase()))];

    lyraLpData[market] = {
      perUser: {},
      startTimestamp: startTs,
      endTimestamp: endTs,
      lastUpdatedTimestamp: 0,
      totalLyraRewards: 0,
      totalOPRewards: 0,
      totalLPDays: 0,
      totalBoostedLPDays: 0,
      totalDistributedLyraRewards: 0,
      totalDistributedOPRewards: 0,
      scaledStkLyraDays: 0
    };

    const userLPDays = await getLPDays(startTs, endTs, maxBlock, lpEvents[market]);

    lyraLpData[market].totalLPDays = 0;
    for (const user of Object.keys(userLPDays)) {
      if (!ignoreList.includes(user.toLowerCase())) {
        lyraLpData[market].totalLPDays += userLPDays[user];
      }
    }

    const [userBoostedLPDays, totalBoostedLPDays, scaledStkLyraDays] = getBoostedLpDays(
      userLPDays, lyraLpData[market].totalLPDays, stkLyraData, params[market].totalStkScaleFactor, params[market].x, ignoreList);

    let epochPercentCompleted = (1 - (endTs - maxBlock.timestamp) / (endTs - startTs));
    if (epochPercentCompleted < 0) {
      epochPercentCompleted = 0;
    } else if (epochPercentCompleted > 1) {
      epochPercentCompleted = 1;
    }

    lyraLpData[market].totalLyraRewards = params[market].LYRA;
    lyraLpData[market].totalOPRewards = params[market].OP;
    lyraLpData[market].totalDistributedLyraRewards = params[market].LYRA * epochPercentCompleted;
    lyraLpData[market].totalDistributedOPRewards = params[market].OP * epochPercentCompleted;
    lyraLpData[market].totalBoostedLPDays = totalBoostedLPDays;
    lyraLpData[market].scaledStkLyraDays = scaledStkLyraDays;

    for (const user of Object.keys(userLPDays)) {
      const isIgnored = ignoreList.includes(user.toLowerCase());
      lyraLpData[market].perUser[user] = {
        isIgnored,
        lpDays: userLPDays[user],
        boostedLpDays: userBoostedLPDays[user],
        lyraRewards: isIgnored ? 0 : lyraLpData[market].totalDistributedLyraRewards * userBoostedLPDays[user] / totalBoostedLPDays,
        opRewards: isIgnored ? 0 : lyraLpData[market].totalDistributedOPRewards * userBoostedLPDays[user] / totalBoostedLPDays,
      }
    }
  }

  return lyraLpData;
}

function getBoostedLpDays(
  userLPDays: any, totalLpDays: number, stkLyraData: StkLyraData, totalLyraScale: number, x: number, ignoreList: string[]
):  [{ [user: string]: number }, number, number] {
  let userBoostedLpDays: { [user: string]: number } = {};
  let totalBoostedLpDays = 0;

  for (const user of Object.keys(userLPDays)) {
    if (userLPDays[user] == 0) {
      userBoostedLpDays[user] = 0;
      continue;
    }
    const percentStkLyraOfTotal = (stkLyraData.perUser[user] != undefined && stkLyraData.perUser[user].stkLyraDays != 0)
      ? stkLyraData.perUser[user].stkLyraDays / (stkLyraData.totalStkLyraDays * totalLyraScale)
      : 0;

    userBoostedLpDays[user] = Math.min(
      (x * userLPDays[user]) 
        + (1 - x) * percentStkLyraOfTotal * totalLpDays,
      userLPDays[user]
    )

    if (!ignoreList.includes(user.toLowerCase())) {
      totalBoostedLpDays += userBoostedLpDays[user];
    }
  }
  return [userBoostedLpDays, totalBoostedLpDays, (stkLyraData.totalStkLyraDays * totalLyraScale)];
}


async function getLPDays(
  startTs: number, endTs: number, maxBlock: Block, lpEvents: LPEvent[]
): Promise<{ [user: string]: number }> {
  const userLPDollarDays: { [user: string]: number } = {};

  if (maxBlock.timestamp <= startTs) {
    return {};
  }
  const endTimestamp = Math.min(maxBlock.timestamp, endTs);

  for (const event of lpEvents) {
    const eventTimestamp = Math.max(event.timestamp, startTs);
    if (eventTimestamp > endTimestamp) {
      continue;
    }

    const value = parseFloat(ethers.utils.formatEther(event.value))

    if (userLPDollarDays[event.from] && event.from != ethers.constants.AddressZero) {
      userLPDollarDays[event.from] -= value * (endTimestamp - eventTimestamp) / DAY_SEC;
    } else if (event.from != ethers.constants.AddressZero) {
      throw Error("User doesn't exit and is sending - events are out of order?")
    }

    if (userLPDollarDays[event.to] && event.to != ethers.constants.AddressZero) {
      userLPDollarDays[event.to] += value * (endTimestamp - eventTimestamp) / DAY_SEC;
    } else if (event.to != ethers.constants.AddressZero) {
      userLPDollarDays[event.to] = value * (endTimestamp - eventTimestamp) / DAY_SEC;
    }
  }

  for (const key of Object.keys(userLPDollarDays)) {
    if (userLPDollarDays[key] < 0.00000000001) {
      userLPDollarDays[key] = 0;
    }
  }

  return userLPDollarDays;
}
