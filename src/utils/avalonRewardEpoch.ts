import { Deployments } from '.'
import { AvalonMMVConfig } from '../avalon-rewards/mmv'
import { Collections } from '../constants/collections'
import { getDB } from './mongo'
import { AvalonStakingConfig } from '../avalon-rewards/stkLyra'
import { TradingRewardsConfig } from '../avalon-rewards/avalon-trading'
import { TradingRewards, UserTradingRebate } from '../avalon-rewards/avalon-trading/getTradingRewards'

export type GlobalRewardEpoch = {
  deployment: Deployments, // indexed
  startTimestamp: number, // indexed
  endTimestamp: number,
  lastUpdated: number,
  totalStkLyraDays: number,
  scaledStkLyraDays: {
    [market: string]: number
  },
  totalLpTokenDays: {
    [market: string]: number 
  },
  totalBoostedLpTokenDays: {
    [market: string]: number 
  },
  rewardedStakingRewards: {
    [rewardToken: string]: number
  }
  rewardedMMVRewards: {
    [rewardToken: string]: {
      [market: string]: number 
    }
  },
  tradingRewardResults: TradingRewards,
  tradingRewardConfig: TradingRewardsConfig,
  MMVConfig: AvalonMMVConfig,
  stakingRewardConfig: AvalonStakingConfig
}

export type AccountRewardEpoch = {
  account: string, //indexed,
  deployment: Deployments, // indexed
  startTimestamp: number, // indexed
  endTimestamp: number,
  stkLyraDays: number, 
  inflationaryRewards: {
    lyra: number,
    op: number,
    isIgnored: boolean,
  },
  lpDays: {
    [market: string]: number // boosted, 
  },
  boostedLpDays: {
    [market: string]: number // boosted, 
  },
  MMVRewards: {
    [market: string]: {
      op: number,
      lyra: number,
      isIgnored: boolean
    }
  },
  tradingRewards: UserTradingRebate & { tradingFees: number }
}

export function getEmptyAccountEpoch(account: string, deployment: Deployments, startTimestamp: number, endTimestamp: number): AccountRewardEpoch {
  return {
    account,
    deployment,
    startTimestamp,
    endTimestamp,
    stkLyraDays: 0,
    inflationaryRewards: {
      lyra: 0,
      op: 0,
      isIgnored: false,
    },
    lpDays: {},
    boostedLpDays: {},
    MMVRewards: {},
    tradingRewards: {
      // For trading rebates
      fees: 0, // USD
      tradingFees: 0,
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
      opRebate: 0,
    }
  }

}


export async function insertOrUpdateGlobalRewardEpoch(globalEpoch: GlobalRewardEpoch) {
  console.log('Updating GlobalRewardEpoch...')
  console.log(`-`.repeat(20));

  console.log(globalEpoch);

  if (globalEpoch.startTimestamp === undefined) {
    return
  }

  const db = await getDB()
  const globalEpochCollection = db.collection(Collections.AvalonGlobalRewardsEpoch)

  await globalEpochCollection.createIndex({ startTimestamp: 1 })
  await globalEpochCollection.createIndex({ deployment: 1 })

  await globalEpochCollection.deleteOne( {startTimestamp: globalEpoch.startTimestamp, deployment: globalEpoch.deployment } );
  await globalEpochCollection.insertOne(globalEpoch); 
}

export async function insertOrUpdateAccountRewardEpoch(accountEpochs: AccountRewardEpoch[]) {
  console.log('Updating AccountRewardEpoch...')
  console.log(`-`.repeat(20));

  const db = await getDB();

  const accountEpochCollection = db.collection(Collections.AvalonAccountRewardsEpoch)
  await accountEpochCollection.createIndex({ account: 1 })
  await accountEpochCollection.createIndex({ startTimestamp: 1 })
  await accountEpochCollection.createIndex({ deployment: 1 })

  console.log('--', 'Update', Collections.AvalonAccountRewardsEpoch, accountEpochs.length, 'items')
  const userBulk = accountEpochCollection.initializeOrderedBulkOp()
  // remove all
  userBulk.find({}).delete()
  for (const accountEpoch of accountEpochs) {
    userBulk.find({
      account: accountEpoch.account,
      deployment: accountEpoch.deployment,
      startTimestamp: accountEpoch.startTimestamp
    }).upsert().replaceOne(accountEpoch)
  }
  const userBulkRes = await userBulk.execute()
  console.log('---', 'Remove', userBulkRes.nRemoved, 'items')
  console.log('---', 'Insert', userBulkRes.nUpserted, 'items')
}
