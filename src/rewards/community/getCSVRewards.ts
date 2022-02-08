import csv from "csvtojson";
import { ethers } from "ethers";

export default async function getCSVRewards(
  csvFileName: string
): Promise<Record<string, number>> {
  const data: { address: string; rewards: number }[] = await csv().fromFile(
    "./data/community/" + csvFileName
  );
  return data.reduce(
    (rewardsPerAddress: Record<string, number>, { address, rewards }) => ({
      ...rewardsPerAddress,
      [ethers.utils.getAddress(address)]:
        (rewardsPerAddress[address] ?? 0) + parseInt(rewards.toString()),
    }),
    {}
  );
}
