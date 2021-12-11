import objectsToCsv from "objects-to-csv";
import CONFIG from "./config";
import getDAISUSDLPRewards from "./getDAISUSDLPRewards";

const OUT_FILE = "./out/dai-susd-lp.csv";

export default async function exportDAISUSDLPRewards() {
  const rows: Record<string, any>[] = [];
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
  for (const [address, rewards] of Object.entries(totalRewardsPerAddress)) {
    rows.push({ address, rewards });
  }

  console.log("-", rows.length, "addresses");

  const csv = new objectsToCsv(rows);
  await csv.toDisk(OUT_FILE, { allColumns: true });

  console.log("- Exported to", OUT_FILE);
}
