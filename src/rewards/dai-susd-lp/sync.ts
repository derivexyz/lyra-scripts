import {
  insertOrUpdateRewardEvents,
  RewardEvent,
  RewardEventType,
} from "../../utils/rewards";
import CONFIG from "./config";
import getDAISUSDLPRewards from "./getDAISUSDLPRewards";

export default async function syncDAISUSDLPRewards() {
  const totalRewardsPerAddress: Record<string, number> = {};
  for (const params of CONFIG) {
    console.log(
      "- Round:",
      new Date(params.startDate * 1000).toDateString(),
      `(${params.startDate})`
    );
    const rewardsPerAddress = await getDAISUSDLPRewards(params);
    const totalRewards = Object.values(rewardsPerAddress).reduce(
      (sum, rewards) => sum + rewards,
      0
    );
    console.log("--", Object.keys(rewardsPerAddress).length, "addresses");
    console.log(
      "--",
      totalRewards,
      "/",
      params.totalRewards,
      "rewards distributed"
    );
    for (const address in rewardsPerAddress) {
      if (totalRewardsPerAddress[address] == null) {
        totalRewardsPerAddress[address] = 0;
      }
      totalRewardsPerAddress[address] += rewardsPerAddress[address];
    }
  }
  const rewardEvents: RewardEvent[] = Object.entries(
    totalRewardsPerAddress
  ).map(([address, rewards]) => {
    return {
      address,
      rewards,
      id: "",
      type: RewardEventType.UniDaiSUSDLP,
      availableTimestamp: CONFIG[CONFIG.length - 1].endDate,
    };
  });
  console.log("-", rewardEvents.length, "addresses");
  await insertOrUpdateRewardEvents(RewardEventType.UniDaiSUSDLP, rewardEvents);
}
