import {
  insertOrUpdateRewardEvents,
  RewardEvent,
  RewardEventType,
} from "../../utils/rewards";
import getLyraLPRewards from "./getLyraLPRewards";
import CONFIG from "./config";

export default async function syncLyraLPRewards() {
  const rewardEvents: RewardEvent[] = [];

  for (const market in CONFIG) {
    console.log("-", market);
    for (const params of CONFIG[market]) {
      console.log(
        "--",
        "Round:",
        new Date(params.maxExpiryTimestamp * 1000).toDateString(),
        `(${params.maxExpiryTimestamp})`
      );
      const result = await getLyraLPRewards(market, params);
      const totalRewards = Object.values(result).reduce(
        (sum, user) => sum + user.rewards,
        0
      );
      const initialLiquidity = Object.values(result).reduce(
        (sum, user) => sum + user.liquidity,
        0
      );
      console.log(
        "---",
        totalRewards,
        "/",
        params.totalRewards,
        "rewards distributed"
      );
      console.log("---", initialLiquidity, "initial liquidity");
      console.log("---", "Found", Object.keys(result).length, "LPs");
      Object.entries(result).forEach(
        ([address, { rewards, liquidity, share }]) => {
          rewardEvents.push({
            address,
            rewards,
            id: `${market}-${params.maxExpiryTimestamp}`,
            type: RewardEventType.LyraLP,
            availableTimestamp: params.maxExpiryTimestamp,
            context: {
              market,
              maxExpiryTimestamp: params.maxExpiryTimestamp,
              liquidity,
              share,
            },
          });
        }
      );
    }
  }

  await insertOrUpdateRewardEvents(RewardEventType.LyraLP, rewardEvents);
}
