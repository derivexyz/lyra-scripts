import {
  insertOrUpdateRewardEvents,
  RewardEvent,
  RewardEventType,
} from "../../utils/rewards";
import CONFIG from "./config";
import getSNXStakingRewards from "./getSNXStakingRewards";

export default async function syncSNXStakingRewards() {
  const statsPerUser = await getSNXStakingRewards(CONFIG);
  // create reward events
  const rewardEvents: RewardEvent[] = [];
  for (const [address, stats] of Object.entries(statsPerUser)) {
    if (stats.retroRewards > 0) {
      rewardEvents.push({
        address,
        type: RewardEventType.SNXStaking,
        id: "retro",
        rewards: stats.retroRewards,
        availableTimestamp: CONFIG.retroEndDate,
        context: {
          ...stats.conditions,
          activeFrom: stats.activeFrom ?? 0,
        },
      });
    }
    if (stats.stakingRewards > 0) {
      rewardEvents.push({
        address,
        type: RewardEventType.SNXStaking,
        id: "staking",
        rewards: stats.stakingRewards,
        availableTimestamp: CONFIG.stakingEndDate,
        context: {
          ...stats.conditions,
          activeFrom: stats.activeFrom ?? 0,
        },
      });
    }
  }
  await insertOrUpdateRewardEvents(RewardEventType.SNXStaking, rewardEvents);
}
