import objectsToCsv from "objects-to-csv";
import getRetroTradingRewards from "./getRetroTradingRewards";
import CONFIG from "./config";

const OUT_FILE = "./out/retro-traders.csv";

export default async function exportRetroTradingRewards() {
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

  const rows = Object.entries(rewardsPerUser).map(
    ([address, { rewards, score, premiums }]) => {
      return {
        address,
        premiums,
        score,
        rewards,
      };
    }
  );

  const csv = new objectsToCsv(rows);
  await csv.toDisk(OUT_FILE, { allColumns: true });

  console.log("- Exported to", OUT_FILE);
}
