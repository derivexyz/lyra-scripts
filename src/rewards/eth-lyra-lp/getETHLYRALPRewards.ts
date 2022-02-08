import { getAll, getBlockEpochs, getBlocksDb } from '../../utils/blocks'
import getETHLYRAUniswapEvents from './getETHLYRAUniswapEvents'
import { EthLyraLPConfig } from './config'

export enum NotEarningReason {
  IsEarning,
  OutOfRange,
  Transferred,
  LiquidityAtZero,
}

type Transfer = {
  id: number
  blockNumber: number
  tokenId: number
  fromAddr: string
  toAddr: string
}

type IncreaseOrDecrease = {
  id: number
  blockNumber: number
  tokenId: number
  liquidity: number
  timestamp: number
  sign: number
}

type TokenData = {
  id: number
  createdBlock: number
  createdTimestamp: number
  liquidityChanges: IncreaseOrDecrease[]
  transfers: Transfer[]
  tickLower: number
  tickUpper: number
}

type TokenSnapshot = {
  totalLiquidity: number
  perToken: {
    [tokenId: string]: {
      isEarning: boolean
      isPending: boolean
      inRange: boolean
      notEarningReason: NotEarningReason
      owner: string
      tokenLiquidity: number
      createdTimestamp: number
      lastUpdatedTimestamp: number
      epochEndLiquidity: number
      tickLower: number
      tickUpper: number
    }
  }
}

type TokenSnapshots = {
  [snapId: string]: TokenSnapshot
}

type UserSnapshot = {
  totalRewards: number
  periods: {
    [snapId: string]: {
      totalEarningLiquidity: number
      totalEpochEndLiquidity: number
      totalEpochEndShare: number
      totalLiquidity: number
      totalShare: number
      totalRewardForPeriod: number
      positions: {
        id: number
        liquidity: number
        epochEndLiquidity: number
        currentShare: number
        rewardsForPeriod: number
        isEarning: boolean
        inRange: boolean
        isPending: boolean
        notEarningReason: NotEarningReason
        lastUpdatedTimestamp: number
        createdTimestamp: number
        tickLower: number
        tickUpper: number
      }[]
    }
  }
}

type UserSnapshots = {
  [snapId: string]: UserSnapshot
}

export default async function getEthLyraLPRewards(params: EthLyraLPConfig): Promise<{
  epochs: any[][][]
  tokenSnapshots: TokenSnapshots
  userSnapshots: UserSnapshots
}> {
  const epochs = await getBlockEpochs('mainnet-ovm', params.startTimestamp, params.endTimestamp, params.epochDuration)
  const blockTimestamps = await getAll(getBlocksDb('mainnet'))

  const { mints, transfers, increaseEvents, decreaseEvents } = await getETHLYRAUniswapEvents()

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

  const tokens: { [key: number]: TokenData } = {}

  let currentBlockNum = 0
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
          throw Error('No mint found for first transfer event')
        }
        tokens[transfer.tokenId] = {
          id: transfer.tokenId,
          createdBlock: transfer.blockNumber,
          createdTimestamp: transfer.timestamp,
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
        timestamp: blockTimestamps[increase.blockNumber],
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
        timestamp: blockTimestamps[decrease.blockNumber],
        sign: -1,
      })
    }

    currentBlockNum += 1
  }

  const tokenSnapshots: TokenSnapshots = {}

  const userSnapshots: UserSnapshots = {}
  const numEpochs = Math.floor((params.endTimestamp - params.startTimestamp) / params.epochDuration)
  const lyraPerEpoch = params.totalRewards / numEpochs
  console.log('--', numEpochs, 'epochs')
  console.log('--', lyraPerEpoch, 'lyra per epoch')

  for (const i of epochs) {
    const startSnap = i[0][0]
    const epochStartTimestamp = i[0][1]
    const endSnap = i[1][0]
    const epochEndTimestamp = i[1][1]

    const resId = `${startSnap}-${endSnap}`
    tokenSnapshots[resId] = {
      totalLiquidity: 0,
      perToken: {},
    }

    for (const tokenId in tokens) {
      const token = tokens[tokenId]

      let isEarning = true
      let isPending = false
      let inRange = true
      let notEarningReason = NotEarningReason.IsEarning

      let lastTransfer: any = { blockNumber: 0 }

      for (const transfer of token.transfers) {
        if (!!endSnap && transfer.blockNumber > endSnap) {
          // Ignore any transfers that happened after the period
          continue
        }
        if (transfer.blockNumber > lastTransfer.blockNumber) {
          lastTransfer = transfer
        }
      }

      if (lastTransfer.blockNumber === 0) {
        // Token doesn't exist yet
        continue
      }
      const ownerAtEnd = lastTransfer.toAddr

      if (
        lastTransfer.blockNumber > startSnap &&
        lastTransfer.fromAddr !== '0x0000000000000000000000000000000000000000' &&
        lastTransfer.toAddr !== '0x0000000000000000000000000000000000000000'
      ) {
        // does not get a reward for period if the token was transferred
        isEarning = false
        notEarningReason = NotEarningReason.Transferred
      }

      // Get the token's liquidity by summing all liquidity change events
      let epochStartTokenLiquidity = 0
      let tokenLiquidityCounter = 0
      let lastUpdatedTimestamp = token.createdTimestamp
      let epochEndLiquidity = 0
      for (const liquidityChange of token.liquidityChanges) {
        if (!!endSnap && liquidityChange.blockNumber > endSnap) {
          continue
        }
        epochEndLiquidity += (liquidityChange.liquidity / 1e18) * liquidityChange.sign

        if (liquidityChange.blockNumber > startSnap) {
          tokenLiquidityCounter +=
            (liquidityChange.liquidity / 1e18) * liquidityChange.sign * (epochEndTimestamp - liquidityChange.timestamp)
          continue
        }
        epochStartTokenLiquidity += (liquidityChange.liquidity / 1e18) * liquidityChange.sign
        lastUpdatedTimestamp = liquidityChange.timestamp
      }

      const averagedTokenLiquidity =
        epochStartTokenLiquidity + tokenLiquidityCounter / (epochEndTimestamp - epochStartTimestamp)

      if (epochEndTimestamp - epochStartTimestamp <= 0) {
        console.log({ epochEndTimestamp, epochStartTimestamp })
        throw Error('0 length (or negative) epoch')
      }

      // We ignore any liquidity that is not in the specified range
      if (token.tickLower != params.minTick || token.tickUpper != params.maxTick) {
        isEarning = false
        inRange = false
        notEarningReason = NotEarningReason.OutOfRange
      }

      // Ignore any values less than 1 gwei worth of liquidity (dust)
      if (averagedTokenLiquidity < 0.000000001) {
        isEarning = false
        notEarningReason = NotEarningReason.LiquidityAtZero
      }

      // If we are in the current round, don't calculate the share yet
      if (endSnap == null) {
        isPending = true
        if (isEarning && inRange) {
          tokenSnapshots[resId].totalLiquidity += averagedTokenLiquidity
        }
      }

      if (!isEarning || isPending || !inRange) {
        tokenSnapshots[resId].perToken[tokenId] = {
          isEarning,
          isPending,
          inRange,
          notEarningReason,
          owner: ownerAtEnd,
          tokenLiquidity: averagedTokenLiquidity,
          createdTimestamp: token.createdTimestamp,
          lastUpdatedTimestamp,
          epochEndLiquidity,
          tickLower: token.tickLower,
          tickUpper: token.tickUpper,
        }
        continue
      }

      tokenSnapshots[resId].totalLiquidity += averagedTokenLiquidity
      tokenSnapshots[resId].perToken[tokenId] = {
        isEarning,
        isPending,
        inRange,
        notEarningReason,
        owner: ownerAtEnd,
        tokenLiquidity: averagedTokenLiquidity,
        epochEndLiquidity,
        createdTimestamp: token.createdTimestamp,
        lastUpdatedTimestamp,
        tickLower: token.tickLower,
        tickUpper: token.tickUpper,
      }
    }

    // now allocate the lyra tokens given we have the total liquidity
    for (const tokenId in tokenSnapshots[resId].perToken) {
      const tokenInfo = tokenSnapshots[resId].perToken[tokenId]
      const owner = tokenInfo.owner
      if (!userSnapshots[owner]) {
        userSnapshots[owner] = {
          totalRewards: 0,
          periods: {},
        }
      }
      if (!userSnapshots[owner].periods[resId]) {
        userSnapshots[owner].periods[resId] = {
          totalEarningLiquidity: 0,
          totalLiquidity: 0,
          totalShare: 0,
          totalRewardForPeriod: 0,
          totalEpochEndLiquidity: 0,
          totalEpochEndShare: 0,
          positions: [],
        }
      }

      if (tokenInfo.isEarning && !tokenInfo.isPending) {
        const amountTokens = (lyraPerEpoch * tokenInfo.tokenLiquidity) / tokenSnapshots[resId].totalLiquidity
        userSnapshots[owner].totalRewards += amountTokens
        userSnapshots[owner].periods[resId].totalRewardForPeriod += amountTokens
        userSnapshots[owner].periods[resId].totalEarningLiquidity += tokenInfo.tokenLiquidity
        userSnapshots[owner].periods[resId].totalShare +=
          tokenInfo.tokenLiquidity / tokenSnapshots[resId].totalLiquidity
      }

      if (tokenInfo.isEarning) {
        userSnapshots[owner].periods[resId].totalEpochEndLiquidity += tokenInfo.epochEndLiquidity
        userSnapshots[owner].periods[resId].totalEpochEndShare +=
          tokenInfo.epochEndLiquidity / tokenSnapshots[resId].totalLiquidity
      }
      userSnapshots[owner].periods[resId].totalLiquidity += tokenInfo.tokenLiquidity

      userSnapshots[owner].periods[resId].positions.push({
        id: parseInt(tokenId),
        liquidity: tokenInfo.tokenLiquidity,
        epochEndLiquidity: tokenInfo.epochEndLiquidity,
        currentShare: tokenInfo.isEarning ? tokenInfo.tokenLiquidity / tokenSnapshots[resId].totalLiquidity : 0,
        rewardsForPeriod: tokenInfo.isEarning
          ? (lyraPerEpoch * tokenInfo.tokenLiquidity) / tokenSnapshots[resId].totalLiquidity
          : 0,
        isEarning: tokenInfo.isEarning,
        inRange: tokenInfo.inRange,
        isPending: tokenInfo.isPending,
        notEarningReason: tokenInfo.notEarningReason,
        lastUpdatedTimestamp: tokenInfo.lastUpdatedTimestamp,
        createdTimestamp: tokenInfo.createdTimestamp,
        tickLower: tokenInfo.tickLower,
        tickUpper: tokenInfo.tickUpper,
      })
    }
  }

  return {
    epochs,
    userSnapshots,
    tokenSnapshots,
  }
}
