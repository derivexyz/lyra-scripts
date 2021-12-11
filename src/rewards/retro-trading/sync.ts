import {
  insertOrUpdateRewardEvents,
  RewardEvent,
  RewardEventType,
} from "../../utils/rewards";
import getRetroTradingRewards from "./getRetroTradingRewards";
import CONFIG from "./config";

export default async function syncRetroTradingRewards() {
  const rewardsPerUser = await getRetroTradingRewards(
    CONFIG.rewards,
    CONFIG.maxTimestamp,
    CONFIG.minPremiums,
    CONFIG.lambda
  );

  console.log("-", Object.keys(rewardsPerUser).length, "traders");

  const totalRewards = Object.values(rewardsPerUser).reduce(
    (sum, user) => sum + user.rewards,
    0
  );
  console.log("-", totalRewards, "rewards distributed");

  const rewardEvents: RewardEvent[] = Object.entries(rewardsPerUser).map(
    ([address, { rewards, premiums, score }]) => {
      return {
        address,
        rewards,
        id: "",
        type: RewardEventType.RetroTrading,
        availableTimestamp: CONFIG.maxTimestamp,
        context: {
          premiums,
          score,
        },
      };
    }
  );

  await insertOrUpdateRewardEvents(RewardEventType.RetroTrading, rewardEvents);
}
