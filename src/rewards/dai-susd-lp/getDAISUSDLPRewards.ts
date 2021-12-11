import { getBlockEpochs } from '../../utils/blocks'
import getDAISUSDUniswapEvents from './getDAISUSDUniswapEvents'
import { PRE_REGENESIS_ADD } from '../../utils/isPostRegenesis'
import { DaiSUSDLPConfig } from './config'

enum NotEarningReason {
  IsEarning,
  LiquidityChanged,
  Transferred,
  Minted,
  Burnt,
  LiquidityAtZero,
}

export default async function getDAISUSDLPRewards(params: DaiSUSDLPConfig): Promise<Record<string, number>> {
  const snapshotBlocks = await getBlockEpochs('mainnet-ovm', params.startDate, params.endDate, params.epochDuration)

  const { mints, transfers, increaseEvents, decreaseEvents } = await getDAISUSDUniswapEvents()

  // Ensure no duplicate transfer at same block number - manually handle if it is an issue
  // Only one example on a different pool (token id 7314)...
  const seen: { [key: number]: any } = {}
  for (const transfer of transfers) {
    if (!!seen[transfer.blockNumber] && seen[transfer.blockNumber].tokenId !== transfer.tokenId) {
      console.log('-- Warn: Duplicate transfer for token:', transfer.tokenId)
    }
    seen[transfer.blockNumber] = transfer
  }

  const mintBlockNumbers = mints.map((x: any) => x.blockNumber)
  const mintTransfers = transfers.filter((x: any) => mintBlockNumbers.includes(x.blockNumber))
  const tokenIds = mintTransfers.map((x: any) => x.tokenId)

  const tokens: { [key: number]: any } = {}

  let currentBlockNum = PRE_REGENESIS_ADD
  let currentTransferIndex = 0
  let currentIncreaseIndex = 0
  let currentDecreaseIndex = 0
  while (true) {
    if (
      !transfers[currentTransferIndex] &&
      !increaseEvents[currentIncreaseIndex] &&
      !decreaseEvents[currentDecreaseIndex]
    ) {
      break
    }

    while (!!transfers[currentTransferIndex] && transfers[currentTransferIndex].blockNumber <= currentBlockNum) {
      const transfer = transfers[currentTransferIndex]
      currentTransferIndex += 1

      if (!tokenIds.includes(transfer.tokenId)) {
        continue
      }

      if (!tokens[transfer.tokenId]) {
        const mint = mints.find(x => x.blockNumber == transfer.blockNumber)
        if (!mint) {
          console.log({ transfer, mint })
          throw Error()
        }
        tokens[transfer.tokenId] = {
          id: transfer.tokenId,
          createdBlock: transfer.blockNumber,
          liquidityChanges: [],
          transfers: [transfer],
          tickLower: mint.tickLower,
          tickUpper: mint.tickUpper,
        }
      } else {
        tokens[transfer.tokenId].transfers.push(transfer)
      }
    }

    while (
      !!increaseEvents[currentIncreaseIndex] &&
      increaseEvents[currentIncreaseIndex].blockNumber <= currentBlockNum
    ) {
      const increase = increaseEvents[currentIncreaseIndex]
      currentIncreaseIndex += 1

      if (!tokenIds.includes(increase.tokenId)) {
        continue
      }

      tokens[increase.tokenId].liquidityChanges.push({
        ...increase,
        sign: 1,
      })
    }

    while (
      !!decreaseEvents[currentDecreaseIndex] &&
      decreaseEvents[currentDecreaseIndex].blockNumber <= currentBlockNum
    ) {
      const decrease = decreaseEvents[currentDecreaseIndex]
      currentDecreaseIndex += 1

      if (!tokenIds.includes(decrease.tokenId)) {
        continue
      }

      tokens[decrease.tokenId].liquidityChanges.push({
        ...decrease,
        sign: -1,
      })
    }

    currentBlockNum += 1
  }

  const results: {
    [snapId: string]: {
      totalLiquidity: number
      perToken: {
        [tokenId: string]: {
          isEarning: boolean
          isPending: boolean
          inRange: boolean
          notEarningReason: NotEarningReason
          owner: string
          tokenLiquidity: number
        }
      }
    }
  } = {}

  const perUserData: any = {}
  const numEpochs = Math.floor((params.endDate - params.startDate) / params.epochDuration)
  const lyraPerEpoch = params.totalRewards / numEpochs
  console.log('--', numEpochs, 'epochs')
  console.log('--', lyraPerEpoch, 'lyra per epoch')

  for (const i of snapshotBlocks) {
    const startSnap = i[0][0]
    const endSnap = i[1][0]

    const resId = `${startSnap}-${endSnap}`
    results[resId] = {
      totalLiquidity: 0,
      perToken: {},
    }

    for (const tokenId in tokens) {
      const token = tokens[tokenId]

      let isEarning = true
      let isPending = false
      let inRange = true
      let notEarningReason = NotEarningReason.IsEarning

      let lastTransfer: any = { blockNumber: PRE_REGENESIS_ADD }

      for (const transfer of token.transfers) {
        if (!!endSnap && transfer.blockNumber > endSnap) {
          // Ignore any transfers that happened after the period
          continue
        }
        if (transfer.blockNumber > lastTransfer.blockNumber) {
          lastTransfer = transfer
        }
      }

      if (lastTransfer.blockNumber === PRE_REGENESIS_ADD) {
        // Token doesn't exist yet
        continue
      }
      const ownerAtEnd = lastTransfer.toAddr

      if (lastTransfer.blockNumber > startSnap) {
        // does not get a reward for period, so skip rest of calculation
        isEarning = false
        notEarningReason = NotEarningReason.Transferred
        if (lastTransfer.fromAddr === '0x0000000000000000000000000000000000000000') {
          notEarningReason = NotEarningReason.Minted
        }
        if (lastTransfer.toAddr === '0x0000000000000000000000000000000000000000') {
          notEarningReason = NotEarningReason.Burnt
        }
      }

      // Get the token's liquidity by summing all liquidity change events
      let tokenLiquidity = 0
      for (const liquidityChange of token.liquidityChanges) {
        if (!!endSnap && liquidityChange.blockNumber > endSnap) {
          continue
        }
        if (liquidityChange.blockNumber > startSnap) {
          isEarning = false
          if (notEarningReason == NotEarningReason.IsEarning) {
            notEarningReason = NotEarningReason.LiquidityChanged
          }
        }
        tokenLiquidity += (liquidityChange.liquidity / 1e18) * liquidityChange.sign
      }

      // We ignore any liquidity that is not in the specified range
      if (token.tickLower != params.minTick || token.tickUpper != params.maxTick) {
        isEarning = false
        inRange = false
      }

      // Ignore any values less than 1 gwei worth of liquidity (dust)
      if (tokenLiquidity < 0.000000001) {
        isEarning = false
        notEarningReason = NotEarningReason.LiquidityAtZero
      }

      // If we are in the current round, don't calculate the share yet
      if (endSnap == null) {
        isPending = true
        if (isEarning && inRange) {
          results[resId].totalLiquidity += tokenLiquidity
        }
      }

      if (!isEarning || isPending || !inRange) {
        results[resId].perToken[tokenId] = {
          isEarning,
          isPending,
          inRange,
          notEarningReason,
          owner: ownerAtEnd,
          tokenLiquidity,
        }
        continue
      }

      results[resId].totalLiquidity += tokenLiquidity
      results[resId].perToken[tokenId] = {
        isEarning,
        isPending,
        inRange,
        notEarningReason,
        owner: ownerAtEnd,
        tokenLiquidity,
      }
    }

    // now allocate the lyra tokens given we have the total liquidity
    for (const tokenId in results[resId].perToken) {
      const tokenInfo = results[resId].perToken[tokenId]
      const owner = tokenInfo.owner
      if (!perUserData[owner]) {
        perUserData[owner] = {
          totalAmount: 0,
          periods: {},
        }
      }
      if (!perUserData[owner].periods[resId]) {
        perUserData[owner].periods[resId] = {
          totalEarningLiquidity: 0,
          totalLiquidity: 0,
          totalShare: 0,
          totalRewardForPeriod: 0,
          positions: [],
        }
      }

      if (tokenInfo.isEarning && !tokenInfo.isPending) {
        const amountTokens = (lyraPerEpoch * tokenInfo.tokenLiquidity) / results[resId].totalLiquidity
        perUserData[owner].totalAmount += amountTokens
        perUserData[owner].periods[resId].totalRewardForPeriod += amountTokens
        perUserData[owner].periods[resId].totalEarningLiquidity += tokenInfo.tokenLiquidity
        perUserData[owner].periods[resId].totalShare += tokenInfo.tokenLiquidity / results[resId].totalLiquidity
      }

      perUserData[owner].periods[resId].totalLiquidity += tokenInfo.tokenLiquidity
      perUserData[owner].periods[resId].positions.push({
        id: tokenId,
        liquidity: tokenInfo.tokenLiquidity,
        currentShare: tokenInfo.isEarning ? tokenInfo.tokenLiquidity / results[resId].totalLiquidity : 0,
        rewardsForPeriod: tokenInfo.isEarning
          ? (lyraPerEpoch * tokenInfo.tokenLiquidity) / results[resId].totalLiquidity
          : 0,
        isEarning: tokenInfo.isEarning,
        inRange: tokenInfo.inRange,
        isPending: tokenInfo.isPending,
        notEarningReason: tokenInfo.notEarningReason,
      })
    }
  }

  const rewardsPerUser: Record<string, number> = {}
  for (const i in perUserData) {
    if (perUserData[i].totalAmount > 0) {
      rewardsPerUser[i] = perUserData[i].totalAmount
    }
  }

  return rewardsPerUser
}
