import { TradingRewardsConfig } from './avalon-trading'
import { AvalonMMVConfig } from './mmv'
import { AvalonStakingConfig } from './stkLyra'

export type AvalonConfig = {
  id: string;
  startTimestamp: number;
  endTimestamp: number;
  globalIgnoreList: string[];
  enabledTradingRewardMarkets: string[];
  tradingConfig: TradingRewardsConfig;
  MMVConfig: AvalonMMVConfig;
  stakingConfig: AvalonStakingConfig;
}

export type CooldownEvent = {
  user: string;
  cooldownTimestamp: number;
  balance: number;
  timestamp: number;
  block: number;
}

export type LPEvent = {
  from: string;
  to: string;
  value: number;
  timestamp: number;
  block: number;
}


export const AVALON_CONFIG: { [deployment: string]: AvalonConfig[] } = {
  ['mainnet-ovm-avalon']: [
    {
      id: 'epoch-1',
      startTimestamp: 1659488400,
      // NOTE: endTimestamp must equal startTimestamp of next epoch otherwise you could miss trades/double count trades
      endTimestamp: 1660694400,
      globalIgnoreList: ['0xB6DACAE4eF97b4817d54df8e005269f509f803f9', '0xD4C00FE7657791C2A43025dE483F05E49A5f76A6', '0x64AA025819321E97Cd829b9b6c45A1424eF9a80b'],
      enabledTradingRewardMarkets: [],
      tradingConfig: {
        useRebateTable: false,
        rebateRateTable: [],
        maxRebatePercentage: 0,
        netVerticalStretch: 1, // param a
        verticalShift: 1, // param b
        vertIntercept: 0, // param c, minReward
        stretchiness: 1, // param d
        rewards: {
          lyraRewardsCap: 0,
          opRewardsCap: 0,
          floorTokenPriceOP: 0.1,
          floorTokenPriceLyra: 0.05,
          lyraPortion: 0.25,
          fixedLyraPrice: 0.15,
          fixedOpPrice: 1.5,
        },
        shortCollatRewards: {
          tenDeltaRebatePerOptionDay: 0,
          ninetyDeltaRebatePerOptionDay: 0,
          longDatedPenalty: 0.5,
        },
      },
      MMVConfig: {
        sETH: {
          LYRA: 0,
          OP: 37500,
          x: 0.5,
          totalStkScaleFactor: 0.2,
          ignoreList: ['0x9644a6920bd0a1923c2c6c1dddf691b7a42e8a65'],
        },
      },
      stakingConfig: {
        totalRewards: {
          LYRA: 460273.9726027397,
          OP: 11506.8493150685,
        },
      },
    },
    {
      id: 'epoch-2',
      startTimestamp: 1660694400,
      // NOTE: endTimestamp must equal startTimestamp of next epoch otherwise you could miss trades/double count trades
      endTimestamp: 1661904000,
      globalIgnoreList: ['0xB6DACAE4eF97b4817d54df8e005269f509f803f9', '0xD4C00FE7657791C2A43025dE483F05E49A5f76A6', '0x64AA025819321E97Cd829b9b6c45A1424eF9a80b'],
      enabledTradingRewardMarkets: ['sETH', 'sBTC'],
      tradingConfig: {
        useRebateTable: false,
        rebateRateTable: [],
        maxRebatePercentage: 0.6,
        netVerticalStretch: 0.043, // param a // netVerticalStretch
        verticalShift: 9.3, // param b // verticalShift
        vertIntercept: 0.2, // param c // minReward // vertIntercept
        stretchiness: 3_000_000, // param d // stretchiness
        rewards: {
          lyraRewardsCap: 200000,
          opRewardsCap: 40000,
          floorTokenPriceOP: 0.1,
          floorTokenPriceLyra: 0.05,
          lyraPortion: 0.25,
          fixedLyraPrice: 0.11,
          fixedOpPrice: 1.14,
        },
        shortCollatRewards: {
          tenDeltaRebatePerOptionDay: 0,
          ninetyDeltaRebatePerOptionDay: 0,
          longDatedPenalty: 0.5,
        },
      },
      MMVConfig: {
        sETH: {
          LYRA: 0,
          OP: 37500,
          x: 0.5,
          totalStkScaleFactor: 0.2,
          ignoreList: [],
        },
        sBTC: {
          LYRA: 0,
          OP: 6250,
          x: 0.5,
          totalStkScaleFactor: 0.1,
          ignoreList: [],
        },
      },
      stakingConfig: {
        totalRewards: {
          LYRA: 460273.9726027397,
          OP: 11506.8493150685,
        },
      },
    },
    {
      id: 'epoch-3',
      startTimestamp: 1661904000,
      // NOTE: endTimestamp must equal startTimestamp of next epoch otherwise you could miss trades/double count trades
      endTimestamp: 1663113600,
      globalIgnoreList: ['0xB6DACAE4eF97b4817d54df8e005269f509f803f9', '0xD4C00FE7657791C2A43025dE483F05E49A5f76A6', '0x64AA025819321E97Cd829b9b6c45A1424eF9a80b'],
      enabledTradingRewardMarkets: ['sETH', 'sBTC'],
      tradingConfig: {
        useRebateTable: false,
        rebateRateTable: [],
        maxRebatePercentage: 0.6,
        netVerticalStretch: 0.043, // param a // netVerticalStretch
        verticalShift: 9.3, // param b // verticalShift
        vertIntercept: 0.2, // param c // minReward // vertIntercept
        stretchiness: 3_000_000, // param d // stretchiness
        rewards: {
          lyraRewardsCap: 200000,
          opRewardsCap: 40000,
          floorTokenPriceOP: 0.1,
          floorTokenPriceLyra: 0.05,
          lyraPortion: 0.10,
          fixedLyraPrice: 0.114,
          fixedOpPrice: 1.20,
        },
        shortCollatRewards: {
          tenDeltaRebatePerOptionDay: 0.1,
          ninetyDeltaRebatePerOptionDay: 0.2,
          longDatedPenalty: 0.5,
        },
      },
      MMVConfig: {
        sETH: {
          LYRA: 0,
          OP: 37500,
          x: 0.5,
          totalStkScaleFactor: 0.2,
          ignoreList: [],
        },
        sBTC: {
          LYRA: 0,
          OP: 6250,
          x: 0.5,
          totalStkScaleFactor: 0.1,
          ignoreList: [],
        },
      },
      stakingConfig: {
        totalRewards: {
          LYRA: 460273.9726027397,
          OP: 11506.8493150685,
        },
      },
    },
    {
      id: 'epoch-4',
      startTimestamp: 1663113600,
      // NOTE: endTimestamp must equal startTimestamp of next epoch otherwise you could miss trades/double count trades
      endTimestamp: 1664323200,
      globalIgnoreList: ['0xB6DACAE4eF97b4817d54df8e005269f509f803f9', '0xD4C00FE7657791C2A43025dE483F05E49A5f76A6', '0x64AA025819321E97Cd829b9b6c45A1424eF9a80b'],
      enabledTradingRewardMarkets: ['sETH', 'sBTC'],
      tradingConfig: {
        useRebateTable: true,
        rebateRateTable: [
          { cutoff: 0, returnRate: 0.05 },
          { cutoff: 1000, returnRate: 0.2 },
          { cutoff: 5000, returnRate: 0.3 },
          { cutoff: 10000, returnRate: 0.35 },
          { cutoff: 20000, returnRate: 0.40 },
          { cutoff: 50000, returnRate: 0.45 },
          { cutoff: 100000, returnRate: 0.475 },
          { cutoff: 250000, returnRate: 0.50 },
          { cutoff: 500000, returnRate: 0.525 },
          { cutoff: 1000000, returnRate: 0.55 },
          { cutoff: 2000000, returnRate: 0.575 },
          { cutoff: 3000000, returnRate: 0.60 },
        ],
        maxRebatePercentage: 0,
        netVerticalStretch: 0,
        verticalShift: 0,
        vertIntercept: 0,
        stretchiness: 0,
        rewards: {
          lyraRewardsCap: 200000,
          opRewardsCap: 40000,
          floorTokenPriceOP: 0.1,
          floorTokenPriceLyra: 0.05,
          lyraPortion: 0.10,
          fixedLyraPrice: 0.114,
          fixedOpPrice: 1.20,
        },
        shortCollatRewards: {
          tenDeltaRebatePerOptionDay: 0.1,
          ninetyDeltaRebatePerOptionDay: 0.2,
          longDatedPenalty: 0.5,
        },
      },
      MMVConfig: {
        sETH: {
          LYRA: 0,
          OP: 37500,
          x: 0.5,
          totalStkScaleFactor: 0.2,
          ignoreList: [],
        },
        sBTC: {
          LYRA: 0,
          OP: 6250,
          x: 0.5,
          totalStkScaleFactor: 0.1,
          ignoreList: [],
        },
      },
      stakingConfig: {
        totalRewards: {
          LYRA: 460273.9726027397,
          OP: 11506.8493150685,
        },
      },
    },
    {
      id: 'epoch-5',
      startTimestamp: 1664323200,
      // NOTE: endTimestamp must equal startTimestamp of next epoch otherwise you could miss trades/double count trades
      endTimestamp: 1665532800,
      globalIgnoreList: ['0xB6DACAE4eF97b4817d54df8e005269f509f803f9', '0xD4C00FE7657791C2A43025dE483F05E49A5f76A6', '0x64AA025819321E97Cd829b9b6c45A1424eF9a80b'],
      enabledTradingRewardMarkets: ['sETH', 'sBTC', 'sSOL'],
      tradingConfig: {
        useRebateTable: true,
        rebateRateTable: [
          { cutoff: 0, returnRate: 0.05 },
          { cutoff: 1000, returnRate: 0.2 },
          { cutoff: 5000, returnRate: 0.3 },
          { cutoff: 10000, returnRate: 0.35 },
          { cutoff: 20000, returnRate: 0.40 },
          { cutoff: 50000, returnRate: 0.45 },
          { cutoff: 100000, returnRate: 0.475 },
          { cutoff: 250000, returnRate: 0.50 },
          { cutoff: 500000, returnRate: 0.525 },
          { cutoff: 1000000, returnRate: 0.55 },
          { cutoff: 2000000, returnRate: 0.575 },
          { cutoff: 3000000, returnRate: 0.60 },
        ],
        maxRebatePercentage: 0,
        netVerticalStretch: 0,
        verticalShift: 0,
        vertIntercept: 0,
        stretchiness: 0,
        rewards: {
          lyraRewardsCap: 200000,
          opRewardsCap: 40000,
          floorTokenPriceOP: 0.1,
          floorTokenPriceLyra: 0.05,
          lyraPortion: 0.10,
          fixedLyraPrice: 0.114,
          fixedOpPrice: 1.20,
        },
        shortCollatRewards: {
          tenDeltaRebatePerOptionDay: 0.1,
          ninetyDeltaRebatePerOptionDay: 0.2,
          longDatedPenalty: 0.5,
        },
      },
      MMVConfig: {
        sETH: {
          LYRA: 0,
          OP: 37500,
          x: 0.5,
          totalStkScaleFactor: 0.2,
          ignoreList: [],
        },
        sBTC: {
          LYRA: 0,
          OP: 6250,
          x: 0.5,
          totalStkScaleFactor: 0.1,
          ignoreList: [],
        },
        sSOL: {
          LYRA: 0,
          OP: 4375,
          x: 0.5,
          totalStkScaleFactor: 0.1,
          ignoreList: [],
        },
      },
      stakingConfig: {
        totalRewards: {
          LYRA: 460273.9726027397,
          OP: 11506.8493150685,
        },
      },
    },
  ],
}
