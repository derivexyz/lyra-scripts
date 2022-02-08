import nullthrows from "nullthrows";
import objectsToCsv from "objects-to-csv";
import { loadArgsAndEnv } from "../utils";
import initializeDB from "../utils/mongo";
import { getRewardEvents } from "../utils/rewards";

export default async function exportTotalRewards(): Promise<void> {
  const argIndex = process.argv.findIndex((arg) => arg === "--timestamp");
  if (argIndex === -1) {
    throw Error("Missing --timestamp argument");
  }
  const timestamp = parseInt(
    nullthrows(process.argv[argIndex + 1], "Missing --timestamp argument")
  );
  console.log("-", "Calculating rewards before", timestamp);

  const rewardEvents = await getRewardEvents();
  console.log("-", rewardEvents.length, "reward events");

  const rewardsPerAddress: Record<string, Record<string, number>> = {};

  for (const rewardEvent of rewardEvents) {
    const address = rewardEvent.address;
    if (
      rewardEvent.rewards === 0 ||
      rewardEvent.availableTimestamp > timestamp
    ) {
      continue;
    }
    const rewardEventID = rewardEvent.id
      ? `${rewardEvent.type.toString()}-${rewardEvent.id}`
      : rewardEvent.type.toString();
    if (!rewardsPerAddress[address]) {
      rewardsPerAddress[address] = {
        "total-rewards": 0,
      };
    }
    if (typeof rewardEvent.rewards === "string") {
      console.log(rewardEvent);
      process.exit(1);
    }
    rewardsPerAddress[address][rewardEventID] = rewardEvent.rewards;
    rewardsPerAddress[address]["total-rewards"] += rewardEvent.rewards;
  }

  console.log(
    "-",
    Object.entries(rewardsPerAddress).length,
    "unique addresses"
  );

  const rows = Object.entries(rewardsPerAddress).map(([address, rewards]) => {
    return {
      address,
      ...rewards,
    };
  });

  const totals: Record<string, number> = {};
  for (const row of rows) {
    const entries = Object.entries(row);
    for (const [key, value] of entries) {
      if (key === "address") {
        continue;
      }
      if (totals[key] == null) {
        totals[key] = parseInt(value);
      } else {
        totals[key] += parseInt(value);
      }
    }
  }

  for (const [key, value] of Object.entries(totals)) {
    if (key === "total-rewards") {
      continue;
    }
    console.log("--", key, value, "rewards distributed");
  }

  console.log("-", totals["total-rewards"], "total rewards");

  const outFile = "./out/total-rewards-" + timestamp + ".csv";

  const csv1 = new objectsToCsv(rows);
  await csv1.toDisk(outFile, { allColumns: true });

  console.log("- Exported to", outFile);
}

loadArgsAndEnv(process.argv);
initializeDB()
  .then(async () => await exportTotalRewards())
  .then(() => process.exit(0))
  .catch((e) => {
    console.log(e)
    process.exit(1)
  });
