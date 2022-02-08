import { insertOrUpdateRewardEvents, RewardEvent, RewardEventType } from '../../utils/rewards'
import getCSVRewards from './getCSVRewards'
import getDiscordRewards from './getDiscordRewards'

export const DEC_COMMUNITY_TIMESTAMP = 1637875800
export const JAN_COMMUNITY_TIMESTAMP = 1641590100 - 15 * 60

export default async function syncCommunityRewards() {
  const discordRewards = await getDiscordRewards()
  const discordRewardEvents: RewardEvent[] = Object.entries(discordRewards).map(
    ([address, { rewards, availableTimestamp }]) => {
      return {
        address,
        rewards,
        id: 'discord',
        type: RewardEventType.Community,
        availableTimestamp,
      }
    }
  )
  console.log('-', discordRewardEvents.length, 'discord addresses')

  const paopRewards = await getCSVRewards('poaps.csv')
  const poapRewardEvents: RewardEvent[] = Object.entries(paopRewards).map(([address, rewards]) => {
    return {
      address,
      rewards,
      id: 'poaps',
      type: RewardEventType.Community,
      availableTimestamp: DEC_COMMUNITY_TIMESTAMP,
    }
  })
  console.log('-', poapRewardEvents.length, 'POAP addresses')

  const pokerRewards = await getCSVRewards('poker.csv')
  const pokerRewardEvents: RewardEvent[] = Object.entries(pokerRewards).map(([address, rewards]) => {
    return {
      address,
      rewards,
      id: 'poker',
      type: RewardEventType.Community,
      availableTimestamp: DEC_COMMUNITY_TIMESTAMP,
    }
  })
  console.log('-', pokerRewardEvents.length, 'poker addresses')

  const tradingCompRewards = await getCSVRewards('testnet-trading-comp.csv')
  const tradingCompEvents: RewardEvent[] = Object.entries(tradingCompRewards).map(([address, rewards]) => {
    return {
      address,
      rewards,
      id: 'testnet-trading-comp',
      type: RewardEventType.Community,
      availableTimestamp: DEC_COMMUNITY_TIMESTAMP,
    }
  })
  console.log('-', tradingCompEvents.length, 'POAP addresses')

  const rewardEvents = [...discordRewardEvents, ...poapRewardEvents, ...pokerRewardEvents, ...tradingCompEvents]
  await insertOrUpdateRewardEvents(RewardEventType.Community, rewardEvents)
}
