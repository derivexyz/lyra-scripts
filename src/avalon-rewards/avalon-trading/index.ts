export type TradingRewardsConfig = {
  useRebateTable: boolean
  rebateRateTable: {cutoff: number, returnRate: number}[]
  maxRebatePercentage: number
  netVerticalStretch: number // param a // netVerticalStretch
  verticalShift: number // param b // verticalShift
  vertIntercept: number // param c // minReward // vertIntercept
  stretchiness: number // param d // stretchiness
  rewards: {
    lyraRewardsCap: number
    opRewardsCap: number
    floorTokenPriceOP: number
    floorTokenPriceLyra: number
    lyraPortion: number // % split of rebates in stkLyra vs OP (in dollar terms)
    fixedLyraPrice: number // override market rate after epoch is over, if 0 just use market rate
    fixedOpPrice: number
  }
  shortCollatRewards: {
    [market: string]: {
      tenDeltaRebatePerOptionDay: number,
      ninetyDeltaRebatePerOptionDay: number,
      longDatedPenalty: number
    }
  }
}

export type userRewardsCol = {
  [user: string] : {
    tradingFees: number
    baseFeeRebate: number
    boostedFeeRebate: number
    totalExpectedRebate: number // in dollars
    totalLyraRebate: number,
    totalOpRebate: number
  };
}
