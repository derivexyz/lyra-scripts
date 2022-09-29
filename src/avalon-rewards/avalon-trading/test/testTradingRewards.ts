import { getTradingRewards } from '../getTradingRewards'
import { data } from './data'

getTradingRewards(
  data.startTs,
  data.endTs,
  data.latestTs,
  data.enabledTradingRewardMarkets,
  data.rewardsConfig,
  data.cooldownEvents,
  data.allTrades,
  data.allDeltaSnapshots,
  data.allStrikeDetails,
  data.allTransfers
).then(x => {
  console.log(x);
  console.log("done")
})
