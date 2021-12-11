import objectsToCsv from "objects-to-csv";
import { loadArgsAndEnv } from "../utils";
import initializeDB from "../utils/mongo";
import { getRewardEvents } from "../utils/rewards";

const OUT_FILE = "./out/total-rewards.csv";

export default async function exportTotalRewards(): Promise<void> {
  const rewardEvents = await getRewardEvents();

  console.log("-", rewardEvents.length, "reward events");

  const rewardsPerAddress: Record<
    string,
    Record<string, number>
  > = rewardEvents.reduce(
    (
      rewardsPerAddress: Record<string, Record<string, number>>,
      rewardEvent
    ) => {
      const address = rewardEvent.address;
      const totalRewards = rewardsPerAddress[address]?.totalRewards ?? 0;
      return {
        ...rewardsPerAddress,
        [address]: {
          ...rewardsPerAddress[address],
          [rewardEvent.id
            ? `${rewardEvent.type.toString()}-${rewardEvent.id}`
            : rewardEvent.type.toString()]: rewardEvent.rewards,
          totalRewards: totalRewards + rewardEvent.rewards,
        },
      };
    },
    {}
  );

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

  const csv1 = new objectsToCsv(rows);
  await csv1.toDisk(OUT_FILE, { allColumns: true });

  console.log("- Exported to", OUT_FILE);
}

loadArgsAndEnv(process.argv);
initializeDB()
  .then(async () => await exportTotalRewards())
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
