import nullthrows from 'nullthrows'
import { Collections } from '../../constants/collections'
import { getBlocksDb, getCachedMax, getTimestampForBlock } from '../../utils/blocks'
import { getDB } from '../../utils/mongo'
import { insertOrUpdateRewardEvents, RewardEvent, RewardEventType } from '../../utils/rewards'
import cacheETHLYRALPEvents from './cacheETHLYRALPEvents'
import CONFIG from './config'
import getETHLYRALPRewards, { NotEarningReason } from './getETHLYRALPRewards'

type ETHLYRALPUser = {
  address: string
  totalLiquidity: number
  totalShare: number
  positions: {
    id: number
    isEarning: boolean
    notEarningReason: NotEarningReason
    liquidity: number
    createdTimestamp: number
    lastUpdatedTimestamp: number
    tickLower: number
    tickUpper: number
  }[]
}

export default async function syncETHLYRALPRewards() {
  if (!process.argv.includes('--skip-cache')) {
    await cacheETHLYRALPEvents()
  } else {
    console.warn('- WARNING: Skipping event cache, results may be stale')
  }

  const db = await getDB()
  const users: Record<string, ETHLYRALPUser> = {}
  const rewardEvents: RewardEvent[] = []

  // get total rewards from previous epoch and add to current epoch
  for (const params of CONFIG) {
    const paramsIndex = CONFIG.indexOf(params)
    console.log('- Epoch', paramsIndex + 1)

    const { epochs, userSnapshots } = await getETHLYRALPRewards(params)

    const latestEpoch = epochs[epochs.length - 1]
    const latestSnapshotID = latestEpoch[0][0] + '-' + latestEpoch[1][0]

    for (const [address, userSnapshot] of Object.entries(userSnapshots)) {
      rewardEvents.push({
        address,
        rewards: userSnapshot.totalRewards,
        id: paramsIndex.toString(),
        type: RewardEventType.ETHLYRALP,
        availableTimestamp: params.endTimestamp,
      })
    }
    console.log('--', rewardEvents.length, 'addresses')

    // store global stats
    const currentTotalRewards = Object.values(userSnapshots).reduce(
      (sum, userSnapshot) => sum + userSnapshot.totalRewards,
      0
    )
    const totalEpochEndLiquidity = Object.values(userSnapshots).reduce(
      (sum, userSnapshot) => sum + nullthrows(userSnapshot.periods[latestSnapshotID]).totalEpochEndLiquidity,
      0
    )

    const latestBlock = await getCachedMax(await getBlocksDb('mainnet'))
    const latestTimestamp = await getTimestampForBlock(await getBlocksDb('mainnet'), latestBlock)

    // current active config
    if (latestTimestamp >= params.startTimestamp && latestTimestamp <= params.endTimestamp) {
      console.log('- Active Epoch')

      // populate stats collection
      const statsC = db.collection(Collections.ETHLYRALPStats)
      await statsC.createIndex({ id: 1 })
      console.log('--', 'Update', Collections.ETHLYRALPStats)
      await statsC.replaceOne(
        { id: 1 },
        {
          id: 1,
          currentTotalRewards,
          totalLiquidity: totalEpochEndLiquidity,
          latestBlock,
          latestTimestamp,
          ...params,
        },
        {
          upsert: true,
        }
      )
      console.log('---', currentTotalRewards, '/', params.totalRewards, 'rewards distributed')
      console.log('---', totalEpochEndLiquidity, 'total current liquidity')
      console.log('---', latestBlock, 'latest block')
      console.log('---', latestTimestamp, 'latest timestamp')

      // populate users collection
      for (const [address, { periods }] of Object.entries(userSnapshots)) {
        console.log(address)
        const latestPeriod = nullthrows(periods[latestSnapshotID])
        users[address] = {
          address,
          totalLiquidity: latestPeriod.totalEpochEndLiquidity,
          totalShare: latestPeriod.totalEpochEndShare,
          positions: latestPeriod.positions.map(position => ({
            id: position.id,
            isEarning: position.isEarning,
            notEarningReason: position.notEarningReason,
            liquidity: position.epochEndLiquidity,
            createdTimestamp: position.createdTimestamp,
            lastUpdatedTimestamp: position.lastUpdatedTimestamp,
            tickLower: position.tickLower,
            tickUpper: position.tickUpper,
          })),
        }
      }

      const userC = db.collection(Collections.ETHLYRALPUsers)
      await userC.createIndex({ address: 1 })
      console.log('--', 'Update', Collections.ETHLYRALPUsers, users.length, 'items')
      const userBulk = userC.initializeOrderedBulkOp()
      // remove all
      userBulk.find({}).delete()
      for (const address in users) {
        userBulk.find({ address }).upsert().replaceOne(users[address])
      }
      const userBulkRes = await userBulk.execute()
      console.log('---', 'Remove', userBulkRes.nRemoved, 'items')
      console.log('---', 'Insert', userBulkRes.nUpserted, 'items')
    }
  }

  await insertOrUpdateRewardEvents(RewardEventType.ETHLYRALP, rewardEvents)
}
