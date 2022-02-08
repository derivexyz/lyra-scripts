import { getDB } from '../../utils/mongo'
import { Collections } from '../../constants/collections'
import { ethers } from 'ethers'
import csv from 'csvtojson'
import { DEC_COMMUNITY_TIMESTAMP, JAN_COMMUNITY_TIMESTAMP } from './sync'

type DiscordWallet = {
  discordUserId: string
  address: string
  rewards: string
  pendingDistribution: boolean
}

type CommunityRewards = {
  discordUserId: string
  rewards: number
  availableTimestamp: number
}

export default async function getDiscordRewards(): Promise<Record<string, CommunityRewards>> {
  const db = await getDB()
  const distributedRewards: {
    address: string
    rewards: string
    discordUserId: string
  }[] = await csv().fromFile('./data/community/discord_distributed.csv')

  const snapshottedRewards: Record<string, { rewards: number; address: string }> = {}
  distributedRewards.reduce((snapshot, userReward) => {
    snapshot[userReward.discordUserId] = {
      address: userReward.address,
      rewards: parseInt(userReward.rewards.toString()),
    }
    return snapshot
  }, snapshottedRewards)

  // fetch discord ID to registered address mapping (registered via Orpheus bot)
  const retroCommunityRewardsC = db.collection(Collections.RetroCommunityRewards)
  const retroCommunityRewards: DiscordWallet[] = await retroCommunityRewardsC.find().toArray()
  const rewardsPerAddress: Record<string, CommunityRewards> = {}
  // Add rewards that haven't been distributed yet
  retroCommunityRewards.reduce((rewardsPerAddress, { address, rewards, discordUserId, pendingDistribution }) => {
    // Only return mapped + hasn't been flagged for distribution + not in distribution snapshot
    if (address != null && !pendingDistribution && !snapshottedRewards[discordUserId]) {
      rewardsPerAddress[ethers.utils.getAddress(address)] = {
        rewards: parseInt(rewards),
        discordUserId,
        availableTimestamp: JAN_COMMUNITY_TIMESTAMP,
      }
    }
    return rewardsPerAddress
  }, rewardsPerAddress)

  // Add rewards that have been distributed (from snapshot)
  Object.entries(snapshottedRewards).forEach(([discordUserId, { rewards, address }]) => {
    rewardsPerAddress[address] = {
      rewards,
      discordUserId,
      availableTimestamp: DEC_COMMUNITY_TIMESTAMP,
    }
  })

  return rewardsPerAddress
}
