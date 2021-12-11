import { Collections } from "../../constants/collections";
import { getDB } from "../../utils/mongo";
import {
  insertOrUpdateRewardEvents,
  RewardEvent,
  RewardEventType,
} from "../../utils/rewards";
import CONFIG from "./config";
import getTradingRewards from "./getTradingRewards";

export default async function syncTradingRewards() {
  const db = await getDB();

  const rewardEvents: RewardEvent[] = [];

  const userC = db.collection(Collections.TradingRewardsUser);
  const statsC = db.collection(Collections.TradingRewardsStats);

  await userC.createIndex({ address: 1 });
  await statsC.createIndex({ expiryTimestamp: 1 });

  const userBulkOps = userC.initializeOrderedBulkOp();
  const statsBulkOps = statsC.initializeOrderedBulkOp();

  userBulkOps.find({}).delete();
  statsBulkOps.find({}).delete();

  for (const params of CONFIG) {
    console.log(
      "-",
      "Round:",
      new Date(params.roundMaxExpiryTimestamp * 1000).toDateString(),
      `(${params.roundMaxExpiryTimestamp})`
    );
    const result = await getTradingRewards(params);
    const totalRewards = Object.values(result).reduce(
      (sum, user) => sum + user.rewards,
      0
    );
    console.log("--", Object.keys(result).length, "traders");
    console.log(
      "--",
      totalRewards,
      "/",
      params.rewardCap,
      "rewards distributed"
    );

    statsBulkOps
      .find({ expiryTimestamp: params.roundMaxExpiryTimestamp })
      .upsert()
      .replaceOne({
        totalRewards,
        expiryTimestamp: params.roundMaxExpiryTimestamp,
        updatedTime: Date.now() / 1000,
      });

    for (const address in result) {
      // create round expiry
      userBulkOps
        .find({ address, expiryTimestamp: params.roundMaxExpiryTimestamp })
        .upsert()
        .replaceOne({
          ...result[address],
          address,
          expiryTimestamp: params.roundMaxExpiryTimestamp,
        });

      // create rewards entry
      rewardEvents.push({
        address,
        id: params.roundMaxExpiryTimestamp.toString(),
        rewards: result[address].rewards,
        type: RewardEventType.Trading,
        // trading rewards available at end of round
        availableTimestamp: params.roundMaxExpiryTimestamp,
        context: {
          maxExpiryTimestamp: params.roundMaxExpiryTimestamp,
        },
      });
    }
  }

  console.log("-", "Update", Collections.TradingRewardsStats);
  const statsRes = await statsBulkOps.execute();
  console.log("--", "Remove", statsRes.nRemoved, "items");
  console.log("--", "Insert", statsRes.nUpserted, "items");

  console.log("-", "Update", Collections.TradingRewardsUser);
  const userRes = await userBulkOps.execute();
  console.log("--", "Remove", userRes.nRemoved, "items");
  console.log("--", "Insert", userRes.nUpserted, "items");

  await insertOrUpdateRewardEvents(RewardEventType.Trading, rewardEvents);
}
