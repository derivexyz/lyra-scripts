import { Deployments } from '../../utils'

export type LyraLPRoundConfig = {
  leap: string
  deployment: Deployments
  maxExpiryTimestamp: number
  totalRewards: number
  bugs?: Record<string, boolean>
}

const CONFIG: Record<string, LyraLPRoundConfig[]> = {
  sETH: [
    {
      leap: 'leap3',
      deployment: 'mainnet-ovm-old',
      maxExpiryTimestamp: 1633075200,
      totalRewards: 1500000,
      bugs: {
        leap14: true,
      },
    },
    {
      leap: 'leap6',
      deployment: 'mainnet-ovm',
      maxExpiryTimestamp: 1635235200,
      totalRewards: 1500000,
      bugs: {
        leap14: true,
      },
    },
    {
      leap: 'leap8.1',
      deployment: 'mainnet-ovm',
      maxExpiryTimestamp: 1637308800,
      totalRewards: 2700000,
      bugs: {
        leap14: true,
      },
    },
    {
      leap: 'leap8.2',
      deployment: 'mainnet-ovm',
      maxExpiryTimestamp: 1639123200,
      totalRewards: 4050000,
      bugs: {
        leap14: true,
      },
    },
    {
      leap: 'leap8.3',
      deployment: 'mainnet-ovm',
      maxExpiryTimestamp: 1641542400,
      totalRewards: 5400000,
      bugs: {
        leap14: true,
      },
    },
    {
      leap: 'leap13.1',
      deployment: 'mainnet-ovm',
      maxExpiryTimestamp: 1643961600,
      totalRewards: 1800000,
    },
    {
      leap: 'leap13.2',
      deployment: 'mainnet-ovm',
      maxExpiryTimestamp: 1646380800,
      totalRewards: 2600000,
    },
    {
      leap: 'leap13.3',
      deployment: 'mainnet-ovm',
      maxExpiryTimestamp: 1648800000,
      totalRewards: 2600000,
    },
  ],
  sLINK: [
    {
      leap: 'leap6',
      deployment: 'mainnet-ovm',
      maxExpiryTimestamp: 1635235200,
      totalRewards: 375000,
      bugs: {
        leap14: true,
      },
    },
    {
      leap: 'leap8.1',
      deployment: 'mainnet-ovm',
      maxExpiryTimestamp: 1637308800,
      totalRewards: 600000,
      bugs: {
        leap14: true,
      },
    },
    {
      leap: 'leap8.2',
      deployment: 'mainnet-ovm',
      maxExpiryTimestamp: 1639123200,
      totalRewards: 900000,
      bugs: {
        leap14: true,
      },
    },
    {
      leap: 'leap8.2',
      deployment: 'mainnet-ovm',
      maxExpiryTimestamp: 1641542400,
      totalRewards: 1200000,
      bugs: {
        leap14: true,
      },
    },
    {
      leap: 'leap13.1',
      deployment: 'mainnet-ovm',
      maxExpiryTimestamp: 1643961600,
      totalRewards: 400000,
    },
    {
      leap: 'leap13.2',
      deployment: 'mainnet-ovm',
      maxExpiryTimestamp: 1646380800,
      totalRewards: 400000,
    },
    {
      leap: 'leap13.3',
      deployment: 'mainnet-ovm',
      maxExpiryTimestamp: 1648800000,
      totalRewards: 400000,
    },
  ],
  sBTC: [
    {
      leap: 'leap8.1',
      deployment: 'mainnet-ovm',
      maxExpiryTimestamp: 1637308800,
      totalRewards: 2700000,
      bugs: {
        leap14: true,
      },
    },
    {
      leap: 'leap8.2',
      deployment: 'mainnet-ovm',
      maxExpiryTimestamp: 1639123200,
      totalRewards: 4050000,
      bugs: {
        leap14: true,
      },
    },
    {
      leap: 'leap8.3',
      deployment: 'mainnet-ovm',
      maxExpiryTimestamp: 1641542400,
      totalRewards: 5400000,
      bugs: {
        leap14: true,
      },
    },
    {
      leap: 'leap13.1',
      deployment: 'mainnet-ovm',
      maxExpiryTimestamp: 1643961600,
      totalRewards: 1800000,
    },
    {
      leap: 'leap13.2',
      deployment: 'mainnet-ovm',
      maxExpiryTimestamp: 1646380800,
      totalRewards: 1000000,
    },
    {
      leap: 'leap13.3',
      deployment: 'mainnet-ovm',
      maxExpiryTimestamp: 1648800000,
      totalRewards: 1000000,
    },
  ],
}

export default CONFIG
