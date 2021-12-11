import { getEventsFromLyraContract } from "../../utils/events";
import isIgnoredAddress from "../../utils/isIgnoredAddress";

// user market #trades volume
const MARKETS = ["sETH", "sBTC", "sLINK"];

const boxCoxScore = (x: number, lambda: number) => {
  if (x > 0) {
    return (Math.pow(x, lambda) - 1) / lambda;
  } else {
    return Math.log(x);
  }
};

export default async function getRetroTradingRewards(
  totalRewards: number,
  maxTimestamp: number,
  minPremiums: number,
  lambda: number
) {
  const premiumsPerUser: Record<string, number> = {};

  for (const market of MARKETS) {
    const positionOpened = (
      await Promise.all([
        getEventsFromLyraContract(
          "mainnet-ovm-old",
          "OptionMarket",
          "PositionOpened",
          market
        ),
        getEventsFromLyraContract(
          "mainnet-ovm",
          "OptionMarket",
          "PositionOpened",
          market
        ),
      ])
    )
      .flat()
      .filter((event) => event.timestamp <= maxTimestamp);
    const positionClosed = (
      await Promise.all([
        getEventsFromLyraContract(
          "mainnet-ovm-old",
          "OptionMarket",
          "PositionClosed",
          market
        ),
        getEventsFromLyraContract(
          "mainnet-ovm",
          "OptionMarket",
          "PositionClosed",
          market
        ),
      ])
    )
      .flat()
      .filter((event) => event.timestamp <= maxTimestamp);
    const events = [...positionOpened, ...positionClosed].sort(
      (a, b) => b.timestamp - a.timestamp
    );
    for (const event of events) {
      const address = event.args.trader;

      if (isIgnoredAddress(address)) {
        continue;
      }

      const premium = parseInt(event.args.totalCost) / 1e18;
      premiumsPerUser[address] =
        premiumsPerUser[address] != null
          ? premiumsPerUser[address] + premium
          : premium;
    }
  }

  const boxCoxScorePerUser: Record<string, number> = Object.keys(
    premiumsPerUser
  ).reduce((boxCoxScorePerUser, address) => {
    const premiums = premiumsPerUser[address];
    if (premiums < minPremiums) {
      // skip users below threshold
      return boxCoxScorePerUser;
    }
    return {
      ...boxCoxScorePerUser,
      [address]: boxCoxScore(premiums, lambda),
    };
  }, {});

  const totalBoxCoxScore = Object.values(boxCoxScorePerUser).reduce(
    (sum, val) => sum + val,
    0
  );

  const rewardsPerUser: Record<
    string,
    {
      premiums: number;
      score: number;
      rewards: number;
    }
  > = Object.keys(boxCoxScorePerUser).reduce((rewardsPerUser, address) => {
    return {
      ...rewardsPerUser,
      [address]: {
        premiums: premiumsPerUser[address],
        score: boxCoxScorePerUser[address],
        rewards: Math.ceil(
          (boxCoxScorePerUser[address] / totalBoxCoxScore) * totalRewards
        ),
      },
    };
  }, {});

  return rewardsPerUser;
}
