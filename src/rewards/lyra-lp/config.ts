import { Deployments } from "../../utils";

export type LyraLPRoundConfig = {
  leap: string;
  deployment: Deployments;
  maxExpiryTimestamp: number;
  totalRewards: number;
};

const CONFIG: Record<string, LyraLPRoundConfig[]> = {
  sETH: [
    {
      leap: "leap3",
      deployment: "mainnet-ovm-old",
      maxExpiryTimestamp: 1633075200,
      totalRewards: 1500000,
    },
    {
      leap: "leap6",
      deployment: "mainnet-ovm",
      maxExpiryTimestamp: 1635235200,
      totalRewards: 1500000,
    },
    {
      leap: "leap8.1",
      deployment: "mainnet-ovm",
      maxExpiryTimestamp: 1637308800,
      totalRewards: 2700000,
    },
    {
      leap: "leap8.2",
      deployment: "mainnet-ovm",
      maxExpiryTimestamp: 1639123200,
      totalRewards: 4050000,
    },
    {
      leap: "leap8.3",
      deployment: "mainnet-ovm",
      maxExpiryTimestamp: 1641542400,
      totalRewards: 5400000,
    },
  ],
  sLINK: [
    {
      leap: "leap6",
      deployment: "mainnet-ovm",
      maxExpiryTimestamp: 1635235200,
      totalRewards: 375000,
    },
    {
      leap: "leap8.1",
      deployment: "mainnet-ovm",
      maxExpiryTimestamp: 1637308800,
      totalRewards: 600000,
    },
    {
      leap: "leap8.2",
      deployment: "mainnet-ovm",
      maxExpiryTimestamp: 1639123200,
      totalRewards: 900000,
    },
    {
      leap: "leap8.2",
      deployment: "mainnet-ovm",
      maxExpiryTimestamp: 1641542400,
      totalRewards: 1200000,
    },
  ],
  sBTC: [
    {
      leap: "leap8.1",
      deployment: "mainnet-ovm",
      maxExpiryTimestamp: 1637308800,
      totalRewards: 2700000,
    },
    {
      leap: "leap8.2",
      deployment: "mainnet-ovm",
      maxExpiryTimestamp: 1639123200,
      totalRewards: 4050000,
    },
    {
      leap: "leap8.3",
      deployment: "mainnet-ovm",
      maxExpiryTimestamp: 1641542400,
      totalRewards: 5400000,
    },
  ],
};

export default CONFIG;
