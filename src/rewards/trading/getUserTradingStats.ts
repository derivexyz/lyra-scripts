import { getEventsFromLyraContract } from '../../utils/events'
import { optionPrices } from '../../utils/blackScholes'
import nullthrows from 'nullthrows'

enum TradeType {
  LONG_CALL,
  SHORT_CALL,
  LONG_PUT,
  SHORT_PUT,
}

export type TradingCollateralStats = {
  shortCallCollateralBalanceTime: number
  shortCallCollateralValueTime: number
  shortPutCollateralValueTime: number
}

export type UserTradingStats = {
  address: string
  totalLongFee: number
  totalShortFee: number
} & TradingCollateralStats

const RATE_AND_CARRY = 0.15

export type ListingGreeksUpdatedEvent = {
  block: number
  txHash: string
  timestamp: number
  args: {
    listingId: string
    callDelta: string
    putDelta: string
    vega: string
    price: string
    baseIv: string
    skew: string
  }
}

export default async function getUserTradingStats(
  market: string,
  maxExpiryTimestamp: number
): Promise<UserTradingStats[]> {
  const listingGreeksUpdated: ListingGreeksUpdatedEvent[] = await getEventsFromLyraContract(
    'mainnet-ovm',
    'OptionGreekCache',
    'ListingGreeksUpdated',
    market
  )
  listingGreeksUpdated.sort((a, b) => b.timestamp - a.timestamp)
  const currSpotPrice = parseInt(listingGreeksUpdated[0].args.price) / 1e18

  // get start block time for round
  const roundStartedEvents = await getEventsFromLyraContract('mainnet-ovm', 'LiquidityPool', 'RoundStarted', market)

  const roundStartEvent = nullthrows(
    roundStartedEvents.find(event => parseInt(event.args.newMaxExpiryTimestamp) === maxExpiryTimestamp)
  )
  const startTimestamp = roundStartEvent.timestamp

  // get strike + expiry for each listingId
  const listingAddedEvents = (
    await getEventsFromLyraContract('mainnet-ovm', 'OptionMarket', 'ListingAdded', market)
  ).filter(event => event.timestamp >= startTimestamp && event.timestamp <= maxExpiryTimestamp)
  const boardCreatedEvents = await getEventsFromLyraContract('mainnet-ovm', 'OptionMarket', 'BoardCreated', market)
  const listings: Record<string, { strike: number; expiry: number }> = {}
  listingAddedEvents.forEach(listingAddedEvent => {
    const { boardId, listingId, strike } = listingAddedEvent.args
    const boardCreatedEvent = nullthrows(boardCreatedEvents.find(event => event.args.boardId === boardId))
    listings[listingId.toString()] = {
      strike: parseInt(strike) / 1e18,
      expiry: parseInt(boardCreatedEvent.args.expiry),
    }
  })

  const [positionOpened, positionClosed] = await Promise.all([
    getEventsFromLyraContract('mainnet-ovm', 'OptionMarket', 'PositionOpened', market),
    getEventsFromLyraContract('mainnet-ovm', 'OptionMarket', 'PositionClosed', market),
  ])

  positionOpened.forEach(e => {
    e.isOpen = true
  })

  const positionEvents = [...positionOpened, ...positionClosed]
    // filter for round
    .filter(event => event.timestamp >= startTimestamp && event.timestamp <= maxExpiryTimestamp)
    .sort((a, b) => a.timestamp - b.timestamp)

  const traderPositions: Record<
    string,
    Record<
      string,
      {
        tradeType: TradeType
        amount: number
        fees: number
        listingId: string
        collateralCounter: number
      }
    >
  > = positionEvents.reduce((traderPositions, event) => {
    const { listingId, tradeType: tradeTypeStr, trader, amount: amountStr } = event.args
    const tradeType = parseInt(tradeTypeStr)
    const positionID = `${listingId}-${tradeType}`
    const isOpen = event.isOpen // injected
    const isLong = tradeType === TradeType.LONG_CALL || tradeType === TradeType.LONG_PUT
    const isCall = tradeType === TradeType.LONG_CALL || tradeType === TradeType.SHORT_CALL
    const amount = parseInt(amountStr) / 1e18

    // fees
    const greeks = nullthrows(listingGreeksUpdated.find(({ txHash }) => txHash === event.txHash))
    const baseIv = parseInt(greeks.args.baseIv) / 1e18
    const skew = parseInt(greeks.args.skew) / 1e18
    const vol = baseIv * skew
    const spotPrice = parseInt(greeks.args.price) / 1e18
    const listing = nullthrows(listings[listingId.toString()])
    const timeToExpiry = listing.expiry - event.timestamp
    const strike = listing.strike
    const [callPrice, putPrice] = optionPrices(
      timeToExpiry / (60 * 60 * 24 * 365), // annualized
      vol,
      spotPrice,
      strike,
      RATE_AND_CARRY
    )
    const price = isCall ? callPrice : putPrice
    const totalCost = parseInt(event.args.totalCost) / 1e18
    const fees = Math.abs(totalCost - price * amount)

    // short collateral
    let collateralCounter = 0
    let collateralAmount = isOpen ? amount : -amount
    if (!isLong) {
      if (isCall) {
        collateralCounter = collateralAmount * timeToExpiry
      } else {
        collateralCounter = collateralAmount * timeToExpiry * strike
      }
    }

    if (traderPositions[trader] == null) {
      traderPositions[trader] = {}
    }
    const currPosition = traderPositions[trader][positionID]

    if (currPosition != null) {
      // add / subtract to position
      currPosition.fees += fees
      currPosition.collateralCounter += collateralCounter
      if (isOpen) {
        currPosition.amount += amount
      } else {
        currPosition.amount -= amount
      }
    } else {
      // initialize position
      traderPositions[trader][positionID] = {
        listingId,
        tradeType,
        amount,
        fees,
        collateralCounter,
      }
    }
    return traderPositions
  }, {})

  const result: UserTradingStats[] = Object.keys(traderPositions).map(address => {
    const positions = Object.values(traderPositions[address])
    const totalLongFee = positions
      .filter(({ tradeType }) => tradeType === TradeType.LONG_CALL || tradeType === TradeType.LONG_PUT)
      .reduce((totalLongFee, { fees }) => totalLongFee + fees, 0)
    const totalShortFee = positions
      .filter(({ tradeType }) => !(tradeType === TradeType.LONG_CALL || tradeType === TradeType.LONG_PUT))
      .reduce((totalShortFee, { fees }) => totalShortFee + fees, 0)
    const shortCallCollateralBalanceTime = positions
      .filter(({ tradeType }) => tradeType === TradeType.SHORT_CALL)
      .reduce((shortCallCollateralCounter, { collateralCounter }) => shortCallCollateralCounter + collateralCounter, 0)
    const shortPutCollateralValueTime = positions
      .filter(({ tradeType }) => tradeType === TradeType.SHORT_PUT)
      .reduce((shortPutCollateralCounter, { collateralCounter }) => shortPutCollateralCounter + collateralCounter, 0)
    return {
      address,
      totalLongFee,
      totalShortFee,
      shortCallCollateralBalanceTime,
      shortCallCollateralValueTime: shortCallCollateralBalanceTime * currSpotPrice,
      shortPutCollateralValueTime,
    }
  })

  return result
}
