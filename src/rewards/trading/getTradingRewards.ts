import { TradingRoundConfig } from './config'
import getUserTradingStats, { UserTradingStats } from './getUserTradingStats'

type TradingRewardsUser = {
  rewards: number
  fees: number
  feeRewards: number
  shortCollateralRewards: number
} & UserTradingStats

export default async function getTradingRewards(roundParams: TradingRoundConfig) {
  const rewardsPerAddress: Record<string, TradingRewardsUser> = {}

  for (const market of Object.keys(roundParams.markets)) {
    const marketParams = roundParams.markets[market]
    const shortPutRatePerSec = marketParams.shortPutDailyRewardRate / (60 * 60 * 24)
    const shortCallRatePerSec = marketParams.shortCallDailyRewardRate / (60 * 60 * 24)

    const allUserTradingStats = await getUserTradingStats(market, roundParams.roundMaxExpiryTimestamp)

    for (const userTradingStats of allUserTradingStats) {
      // determine rewards
      const address = userTradingStats.address
      const feeRewards =
        marketParams.longFeeRewardRate * userTradingStats.totalLongFee +
        marketParams.shortFeeRewardRate * userTradingStats.totalShortFee
      const shortCollateralRewards =
        userTradingStats.shortCallCollateralBalanceTime * shortCallRatePerSec +
        userTradingStats.shortPutCollateralValueTime * shortPutRatePerSec
      const rewards = feeRewards + shortCollateralRewards
      const fees = userTradingStats.totalLongFee + userTradingStats.totalShortFee

      // sum rewards across multiple markets
      if (!rewardsPerAddress[address]) {
        rewardsPerAddress[address] = {
          ...userTradingStats,
          fees,
          rewards,
          feeRewards,
          shortCollateralRewards,
        }
      } else {
        rewardsPerAddress[address].fees += fees
        rewardsPerAddress[address].rewards += rewards
        rewardsPerAddress[address].feeRewards += feeRewards
        rewardsPerAddress[address].shortCollateralRewards += shortCollateralRewards
        rewardsPerAddress[address].shortCallCollateralBalanceTime += userTradingStats.shortCallCollateralBalanceTime
        rewardsPerAddress[address].shortCallCollateralValueTime += userTradingStats.shortCallCollateralValueTime
        rewardsPerAddress[address].shortPutCollateralValueTime += userTradingStats.shortPutCollateralValueTime
        rewardsPerAddress[address].totalLongFee += userTradingStats.totalLongFee
        rewardsPerAddress[address].totalShortFee += userTradingStats.totalShortFee
      }
    }
  }

  const totalRewards = Object.values(rewardsPerAddress).reduce((sum, user) => sum + user.rewards, 0)

  // slash rewards if reward cap is exceeded
  if (totalRewards > roundParams.rewardCap) {
    const reductionFactor = roundParams.rewardCap / totalRewards
    for (const user in rewardsPerAddress) {
      rewardsPerAddress[user].rewards *= reductionFactor
      rewardsPerAddress[user].feeRewards *= reductionFactor
      rewardsPerAddress[user].shortCollateralRewards *= reductionFactor
    }
  }

  return rewardsPerAddress
}
