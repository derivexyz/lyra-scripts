import { insertOrUpdateRewardEvents, RewardEvent, RewardEventType } from '../../utils/rewards'
import getLyraLPRewards from './getLyraLPRewards'
import getLyraLPRewardsWithLEAP14Bug from './getLyraLPRewardsWithLEAP14Bug'
import CONFIG from './config'
import { getEventsFromLyraContract } from '../../utils/events'

export default async function syncLyraLPRewards() {
  const rewardEvents: RewardEvent[] = []
  const leap14ExtraRewards: Record<string, number> = {}

  for (const market in CONFIG) {
    console.log('-', market)
    for (const params of CONFIG[market]) {
      console.log(
        '--',
        'Round:',
        new Date(params.maxExpiryTimestamp * 1000).toDateString(),
        `(${params.maxExpiryTimestamp})`
      )

      const roundStartedEvents = await getEventsFromLyraContract(
        params.deployment,
        'LiquidityPool',
        'RoundStarted',
        market
      )
      const roundStartedEvent = roundStartedEvents.find(x => {
        return (x.args.newMaxExpiryTimestamp || x.args.newMaxExpiryTimestmp) == params.maxExpiryTimestamp
      })
      if (!roundStartedEvent) {
        console.log('- Round not started')
        continue
      }

      let result
      if (params.bugs?.leap14) {
        // fetch result with leap-14 bug
        result = await getLyraLPRewardsWithLEAP14Bug(market, params)
        // fetch result without leap-14 bug
        const correctResult = await getLyraLPRewards(market, params)
        // calculate extra rewards owed per user
        Object.entries(result).forEach(([address, { rewards: distributedRewards }]) => {
          const correctRewards = correctResult[address]?.rewards
          if (correctRewards != null && correctRewards > distributedRewards) {
            leap14ExtraRewards[address] = (leap14ExtraRewards[address] ?? 0) + correctRewards - distributedRewards
          }
        })
      } else {
        result = await getLyraLPRewards(market, params)
      }

      const totalRewards = Object.values(result).reduce((sum, user) => sum + user.rewards, 0)
      const initialLiquidity = Object.values(result).reduce((sum, user) => sum + user.liquidity, 0)
      console.log('---', totalRewards, '/', params.totalRewards, 'rewards distributed')
      console.log('---', initialLiquidity, 'initial liquidity')
      console.log('---', 'Found', Object.keys(result).length, 'LPs')

      Object.entries(result).forEach(([address, { rewards, liquidity, share }]) => {
        rewardEvents.push({
          address,
          rewards,
          id: `${market}-${params.maxExpiryTimestamp}`,
          type: RewardEventType.LyraLP,
          availableTimestamp: roundStartedEvent.timestamp,
          context: {
            market,
            maxExpiryTimestamp: params.maxExpiryTimestamp,
            liquidity,
            share,
          },
        })
      })
    }
  }

  // create events for extra rewards
  const totalLeap14ExtraRewards = Object.values(leap14ExtraRewards).reduce((sum, val) => sum + val, 0)
  console.log('- LEAP-14 bug')
  console.log('--', Object.values(leap14ExtraRewards).length, 'under-rewarded LPs')
  console.log('--', totalLeap14ExtraRewards, 'extra rewards')

  for (const [address, rewards] of Object.entries(leap14ExtraRewards)) {
    rewardEvents.push({
      address,
      rewards,
      id: 'leap-14-bug',
      type: RewardEventType.LyraLP,
      availableTimestamp: 1641542400, // round 3 max expiry timestamp
    })
  }

  await insertOrUpdateRewardEvents(RewardEventType.LyraLP, rewardEvents)
}
