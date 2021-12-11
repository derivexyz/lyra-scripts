import { Collections } from "../constants/collections";
import { getDB } from "./mongo";

export enum RewardEventType {
  LyraLP = "lyra-lp",
  Trading = "trading",
  RetroTrading = "retro-trading",
  Community = "community",
  UniDaiSUSDLP = "dai-susd-lp",
  SNXStaking = "snx-staking",
}

export type RewardEvent = {
  address: string;
  id: string;
  rewards: number;
  type: RewardEventType;
  availableTimestamp: number;
  context?: Record<string, string | number | boolean>;
};

export async function insertOrUpdateRewardEvents(
  type: RewardEventType,
  events: RewardEvent[]
) {
  console.log("-", "Update", Collections.RewardEvents, events.length, "items");
  if (events.length === 0) {
    return;
  }
  const db = await getDB();
  const rewardEventsCollection = db.collection(Collections.RewardEvents);
  await rewardEventsCollection.createIndex({ address: 1 });
  await rewardEventsCollection.createIndex({ id: 1 });
  await rewardEventsCollection.createIndex({ type: 1 });
  const bulk = rewardEventsCollection.initializeOrderedBulkOp();
  bulk.find({ type }).delete();
  events.forEach((event) => {
    bulk
      .find({ address: event.address, id: event.id, type })
      .upsert()
      .replaceOne(event);
  });
  const res = await bulk.execute();
  console.log("--", "Remove", res.nRemoved, "items");
  console.log("--", "Insert", res.nUpserted, "items");
}

export async function getRewardEvents(): Promise<RewardEvent[]> {
  const db = await getDB();
  const rewardEventsCollection = db.collection(Collections.RewardEvents);
  return await rewardEventsCollection.find({}).toArray();
}

export async function purgeRewardEvents(): Promise<void> {
  console.log("- Remove", Collections.RewardEvents);
  const db = await getDB();
  const rewardEventsCollection = db.collection(Collections.RewardEvents);
  const beforeCount = (await getRewardEvents()).length;
  await rewardEventsCollection.deleteMany({});
  const afterCount = (await getRewardEvents()).length;
  console.log("--", "Remove", beforeCount - afterCount, "items");
}
