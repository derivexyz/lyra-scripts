import { AvalonStakingConfig } from '.'
import { StkLyraData } from "./getStkLyraData";
import { Block } from '@ethersproject/abstract-provider'

export type StakingRewardData = {
  perUser: {
    [user: string]: {
      isIgnored: boolean,
      lyra: number,
      op: number
    }
  }
  startTimestamp: number,
  endTimestamp: number,
  totalDistributedLyraRewards: number,
  totalDistributedOPRewards: number
}

export async function getStakingRewards(
  startTs: number, endTs: number, params: AvalonStakingConfig, stkLyraData: StkLyraData, maxBlock: Block, globalIgnoreList: string[]
): Promise<StakingRewardData> {
  const ignoreList = [...new Set(globalIgnoreList.map(x => x.toLowerCase()))];
  let epochPercentCompleted = (1 - (endTs - maxBlock.timestamp) / (endTs - startTs));
    if (epochPercentCompleted < 0) {
      epochPercentCompleted = 0;
    } else if (epochPercentCompleted > 1) {
      epochPercentCompleted = 1;
    }

  const stakingRewardData = {
    perUser: {},
    startTimestamp: startTs,
    endTimestamp: endTs,
    totalDistributedLyraRewards: params.totalRewards.LYRA * epochPercentCompleted,
    totalDistributedOPRewards: params.totalRewards.OP * epochPercentCompleted
  } as StakingRewardData

  Object.keys(stkLyraData.perUser).forEach((user) => {
    const isIgnored = ignoreList.includes(user.toLowerCase());
    stakingRewardData.perUser[user] = {
      isIgnored,
      lyra: isIgnored ? 0 : stkLyraData.perUser[user].percentOfTotal * stakingRewardData.totalDistributedLyraRewards,
      op: isIgnored ? 0 : stkLyraData.perUser[user].percentOfTotal * stakingRewardData.totalDistributedOPRewards,
    }
  })
  // console.log("stakingRewardData.perUser", stakingRewardData.perUser);
  
  return stakingRewardData
}

// loadArgsAndEnv(process.argv);
// getStkLyraData(LP_CONFIG[0], 'kovan-ovm').then(
//   (res) => getInflationaryRewards(INFLATION_CONFIG[0], res).then(
//     (res) => {
//       console.log(res);
//     })
// );