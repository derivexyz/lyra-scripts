import chalk from 'chalk'
import { getEventsFromLyraContract } from '../utils/events'
import { Deployments, getNetworkProvider, loadArgsAndEnv } from '../utils'
import initializeDB, { getDB } from '../utils/mongo'
import nullthrows from 'nullthrows'
import { PRE_REGENESIS_ADD } from '../utils/isPostRegenesis'
import { optionPrices } from '../utils/blackScholes'
import { Collections } from '../constants/collections'
import * as Sentry from '@sentry/node'

enum TradeType {
  LONG_CALL,
  SHORT_CALL,
  LONG_PUT,
  SHORT_PUT,
}

// TODO: fetch this from LyraGlobals and use most recently updated value at the time of computing stats
const RATE_AND_CARRY = 0.15
const SNAPSHOT_LENGTH = 60 * 60
const MIN_MAX_EXPIRY_TIMESTAMP = 1635235200
const IGNORE_MAX_EXPIRY_TIMESTAMPS = [1635724800]

const EMPTY_STATS = {
  longCallExposure: 0,
  longCallVolume: 0,
  longPutExposure: 0,
  longPutVolume: 0,
  shortCallExposure: 0,
  shortCallVolume: 0,
  shortPutExposure: 0,
  shortPutVolume: 0,
  totalPremiumsCollected: 0,
  totalPremiumsPaid: 0,
  netDelta: 0,
  netStdVega: 0,
  baseBalance: 0,
  paidForBasePurchases: 0,
  receivedFromBaseSales: 0,
  openInterestValue: 0,
  baseValue: 0,
  quoteValue: 0,
  totalValue: 0,
  roundPnL: 0,
  queuedForWithdraw: 0,
  queuedForDeposit: 0,
}

export default async function getPoolSnapshot(
  positionOpenedEvents: any[],
  positionClosedEvents: any[],
  globalCacheUpdatedEvents: any[],
  listingCacheUpdatedEvents: any[],
  basePurchasedEvents: any[],
  baseSoldEvents: any[],
  signalWithdrawEvents: any[],
  unSignalWithdrawEvents: any[],
  depositEvents: any[],
  withdrawEvents: any[],
  roundStarted: any,
  listings: any,
  endTimestamp: number
) {
  const roundStartBlock = roundStarted.block
  const roundStartValue = roundStarted.args.totalTokenSupply * roundStarted.args.tokenValue
  const stats = {
    ...EMPTY_STATS,
    totalValue: roundStartValue,
  }

  const perListingExposure: {
    [key: string]: { callExposure: number; putExposure: number }
  } = {}

  const latestWithdrawEvent = unSignalWithdrawEvents
    .concat(signalWithdrawEvents)
    .filter(x => x.block >= roundStartBlock && x.timestamp <= endTimestamp)
    .sort((a, b) => b.timestamp - a.timestamp)[0] // most recent

  const tokensBurnableForRound = latestWithdrawEvent?.args.tokensBurnableForRound ?? 0

  const depositCertificates = new Set()

  depositEvents.forEach(x => {
    if (x.block >= roundStartBlock && x.timestamp <= endTimestamp) {
      stats.queuedForDeposit += x.args.amount
      depositCertificates.add(x.args.certificateId)
    }
  })

  depositCertificates.forEach(certificateId => {
    const withdrawnAfterDeposit = withdrawEvents
      .filter(x => x.args.certificateId === certificateId)
      .reduce((sum, x) => sum + x.args.value, 0)
    stats.queuedForDeposit -= withdrawnAfterDeposit
  })

  positionOpenedEvents.forEach(x => {
    if (x.block >= roundStartBlock && x.timestamp <= endTimestamp) {
      if (x.args.tradeType == TradeType.LONG_CALL) {
        stats.longCallExposure += x.args.amount
        stats.longCallVolume += x.args.totalCost
        stats.totalPremiumsCollected += x.args.totalCost
      } else if (x.args.tradeType == TradeType.SHORT_CALL) {
        stats.shortCallExposure += x.args.amount
        stats.shortCallVolume += x.args.totalCost
        stats.totalPremiumsPaid += x.args.totalCost
      } else if (x.args.tradeType == TradeType.LONG_PUT) {
        stats.longPutExposure += x.args.amount
        stats.longPutVolume += x.args.totalCost
        stats.totalPremiumsCollected += x.args.totalCost
      } else if (x.args.tradeType == TradeType.SHORT_PUT) {
        stats.shortPutExposure += x.args.amount
        stats.shortPutVolume += x.args.totalCost
        stats.totalPremiumsPaid += x.args.totalCost
      }

      if (!perListingExposure[x.args.listingId]) {
        perListingExposure[x.args.listingId] = {
          callExposure: 0,
          putExposure: 0,
        }
      }

      const isLong = x.args.tradeType == TradeType.LONG_CALL || x.args.tradeType == TradeType.LONG_PUT
      if (x.args.tradeType == TradeType.LONG_CALL || x.args.tradeType == TradeType.SHORT_CALL) {
        perListingExposure[x.args.listingId].callExposure += x.args.amount * (isLong ? -1 : 1)
      } else {
        perListingExposure[x.args.listingId].putExposure += x.args.amount * (isLong ? -1 : 1)
      }
    }
  })

  positionClosedEvents.forEach(x => {
    if (x.block >= roundStartBlock && x.timestamp <= endTimestamp) {
      if (x.args.tradeType == TradeType.LONG_CALL) {
        stats.longCallExposure -= x.args.amount
        stats.longCallVolume += x.args.totalCost
        stats.totalPremiumsPaid += x.args.totalCost
      } else if (x.args.tradeType == TradeType.SHORT_CALL) {
        stats.shortCallExposure -= x.args.amount
        stats.shortCallVolume += x.args.totalCost
        stats.totalPremiumsCollected += x.args.totalCost
      } else if (x.args.tradeType == TradeType.LONG_PUT) {
        stats.longPutExposure -= x.args.amount
        stats.longPutVolume += x.args.totalCost
        stats.totalPremiumsPaid += x.args.totalCost
      } else if (x.args.tradeType == TradeType.SHORT_PUT) {
        stats.shortPutExposure -= x.args.amount
        stats.shortPutVolume += x.args.totalCost
        stats.totalPremiumsCollected += x.args.totalCost
      }
      if (!perListingExposure[x.args.listingId]) {
        perListingExposure[x.args.listingId] = {
          callExposure: 0,
          putExposure: 0,
        }
      }

      const isLong = x.args.tradeType == TradeType.LONG_CALL || x.args.tradeType == TradeType.LONG_PUT
      if (x.args.tradeType == TradeType.LONG_CALL || x.args.tradeType == TradeType.SHORT_CALL) {
        perListingExposure[x.args.listingId].callExposure -= x.args.amount * (isLong ? -1 : 1)
      } else {
        perListingExposure[x.args.listingId].putExposure -= x.args.amount * (isLong ? -1 : 1)
      }
    }
  })

  stats.totalValue += stats.totalPremiumsCollected - stats.totalPremiumsPaid

  let lastSeenNetDelta = {
    seenTimestamp: 0,
    netDelta: 0,
    netStdVega: 0,
  }

  globalCacheUpdatedEvents.forEach(x => {
    if (x.timestamp < endTimestamp) {
      if (lastSeenNetDelta.seenTimestamp < x.timestamp) {
        lastSeenNetDelta = {
          seenTimestamp: x.timestamp,
          netDelta: x.args.netDelta,
          netStdVega: x.args.netStdVega,
        }
      }
    }
  })

  stats.netDelta = lastSeenNetDelta.netDelta
  stats.netStdVega = lastSeenNetDelta.netStdVega

  basePurchasedEvents.forEach(x => {
    if (x.block >= roundStartBlock && x.timestamp <= endTimestamp) {
      stats.baseBalance += x.args.amountPurchased
      stats.paidForBasePurchases += x.args.quoteSpent
    }
  })

  baseSoldEvents.forEach(x => {
    if (x.block >= roundStartBlock && x.timestamp <= endTimestamp) {
      stats.baseBalance -= x.args.amountSold
      stats.receivedFromBaseSales += x.args.quoteReceived
    }
  })

  let latestBasePrice = [PRE_REGENESIS_ADD, 0] // [block, price]

  for (const listingId of Object.keys(perListingExposure)) {
    const listing = nullthrows(listings[listingId])
    // get BS price
    // multiply by exposure

    let timeToExpiry = listing.expiry - endTimestamp
    if (timeToExpiry <= 0) {
      timeToExpiry = 1
    }

    let lastCacheUpdate = nullthrows(
      listingCacheUpdatedEvents.find((x: any) => x.block >= roundStartBlock && x.timestamp <= endTimestamp)
    )
    listingCacheUpdatedEvents.forEach(x => {
      if (x.block >= lastCacheUpdate.block && x.timestamp <= endTimestamp) {
        lastCacheUpdate = x
      }
      if (x.block >= latestBasePrice[0] && x.timestamp <= endTimestamp) {
        latestBasePrice = [x.block, x.args.price]
      }
    })

    const [callPrice, putPrice] = optionPrices(
      timeToExpiry / (60 * 60 * 24 * 365), // annualized
      lastCacheUpdate.args.baseIv * lastCacheUpdate.args.skew,
      lastCacheUpdate.args.price,
      listing.strike,
      RATE_AND_CARRY
    )
    if (isNaN(callPrice)) {
      throw Error('NaN callPrice')
    }

    if (isNaN(putPrice)) {
      throw Error('NaN putPrice')
    }

    stats.openInterestValue +=
      perListingExposure[listingId].callExposure * callPrice + perListingExposure[listingId].putExposure * putPrice
  }

  stats.baseValue = stats.baseBalance * latestBasePrice[1]

  stats.totalValue += stats.openInterestValue
  stats.totalValue += stats.receivedFromBaseSales
  stats.totalValue -= stats.paidForBasePurchases
  stats.totalValue += stats.baseValue

  // derive quote from open interest + base components
  stats.quoteValue = stats.totalValue - stats.openInterestValue - stats.baseValue

  stats.roundPnL = stats.totalValue / roundStartValue

  stats.queuedForWithdraw = stats.roundPnL * tokensBurnableForRound

  if (isNaN(stats.roundPnL)) {
    console.log(stats)
    throw Error('NaN roundPnL')
  }

  return stats
}

export async function syncPoolStats(deployment: Deployments = 'mainnet-ovm') {
  const startTime = Date.now()

  let documents: any[] = []

  const currentTime = (await getNetworkProvider(deployment).getBlock('latest')).timestamp

  for (const market of ['sETH', 'sBTC', 'sLINK']) {
    const roundStartedEvents = (await getEventsFromLyraContract(deployment, 'LiquidityPool', 'RoundStarted', market))
      .map(x => {
        return {
          ...x,
          args: {
            totalTokenSupply: parseInt(x.args.totalTokenSupply) / 1e18,
            tokenValue: parseInt(x.args.tokenValue) / 1e18,
            newMaxExpiryTimestamp: parseInt(x.args.newMaxExpiryTimestamp),
          },
        }
      })
      .filter(
        x =>
          x.args.newMaxExpiryTimestamp >= MIN_MAX_EXPIRY_TIMESTAMP &&
          !IGNORE_MAX_EXPIRY_TIMESTAMPS.includes(x.args.newMaxExpiryTimestamp)
      )

    const positionOpenedEvents = (
      await getEventsFromLyraContract(deployment, 'OptionMarket', 'PositionOpened', market)
    ).map(x => {
      return {
        ...x,
        args: {
          listingId: parseInt(x.args.listingId),
          tradeType: parseInt(x.args.tradeType),
          amount: parseInt(x.args.amount) / 1e18,
          totalCost: parseInt(x.args.totalCost) / 1e18,
        },
      }
    })
    const positionClosedEvents = (
      await getEventsFromLyraContract(deployment, 'OptionMarket', 'PositionClosed', market)
    ).map(x => {
      return {
        ...x,
        args: {
          listingId: parseInt(x.args.listingId),
          tradeType: parseInt(x.args.tradeType),
          amount: parseInt(x.args.amount) / 1e18,
          totalCost: parseInt(x.args.totalCost) / 1e18,
        },
      }
    })

    const signalWithdrawEvents = (
      await getEventsFromLyraContract(deployment, 'LiquidityPool', 'WithdrawSignaled', market)
    ).map(x => {
      return {
        ...x,
        args: {
          certificateId: parseInt(x.args.certificateId),
          tokensBurnableForRound: parseInt(x.args.tokensBurnableForRound) / 1e18,
        },
      }
    })

    const unSignalWithdrawEvents = (
      await getEventsFromLyraContract(deployment, 'LiquidityPool', 'WithdrawUnSignaled', market)
    ).map(x => {
      return {
        ...x,
        args: {
          certificateId: parseInt(x.args.certificateId),
          tokensBurnableForRound: parseInt(x.args.tokensBurnableForRound) / 1e18,
        },
      }
    })

    const depositEvents = (await getEventsFromLyraContract(deployment, 'LiquidityPool', 'Deposit', market)).map(x => {
      return {
        ...x,
        args: {
          certificateId: parseInt(x.args.certificateId),
          beneficiary: x.args.beneficiary,
          amount: parseInt(x.args.amount) / 1e18,
        },
      }
    })

    const withdrawEvents = (await getEventsFromLyraContract(deployment, 'LiquidityPool', 'Withdraw', market)).map(x => {
      return {
        ...x,
        args: {
          certificateId: parseInt(x.args.certificateId),
          beneficiary: x.args.beneficiary,
          value: parseInt(x.args.value) / 1e18,
          totalQuoteAmountReserved: parseInt(x.args.totalQuoteAmountReserved) / 1e18,
        },
      }
    })

    const globalCacheUpdatedEvents = (
      await getEventsFromLyraContract(deployment, 'OptionGreekCache', 'GlobalCacheUpdated', market)
    ).map(x => {
      return {
        ...x,
        args: {
          netDelta: parseInt(x.args.netDelta) / 1e18,
          netStdVega: parseInt(x.args.netStdVega) / 1e18,
        },
      }
    })
    const listingCacheUpdatedEvents = (
      await getEventsFromLyraContract(deployment, 'OptionGreekCache', 'ListingGreeksUpdated', market)
    ).map(x => {
      return {
        ...x,
        args: {
          listingId: parseInt(x.args.listingId),
          price: parseInt(x.args.price) / 1e18,
          baseIv: parseInt(x.args.baseIv) / 1e18,
          skew: parseInt(x.args.skew) / 1e18,
        },
      }
    })
    const basePurchasedEvents = (
      await getEventsFromLyraContract(deployment, 'LiquidityPool', 'BasePurchased', market)
    ).map(x => {
      return {
        ...x,
        args: {
          amountPurchased: parseInt(x.args.amountPurchased) / 1e18,
          quoteSpent: parseInt(x.args.quoteSpent) / 1e18,
        },
      }
    })
    const baseSoldEvents = (await getEventsFromLyraContract(deployment, 'LiquidityPool', 'BaseSold', market)).map(x => {
      return {
        ...x,
        args: {
          amountSold: parseInt(x.args.amountSold) / 1e18,
          quoteReceived: parseInt(x.args.quoteReceived) / 1e18,
        },
      }
    })

    const boardCreatedEvents = await getEventsFromLyraContract(deployment, 'OptionMarket', 'BoardCreated', market)
    const listings: Record<string, { strike: number; expiry: number }> = {}
    ;(await getEventsFromLyraContract(deployment, 'OptionMarket', 'ListingAdded', market)).forEach(
      listingAddedEvent => {
        const { boardId, listingId, strike } = listingAddedEvent.args
        const boardCreatedEvent = nullthrows(boardCreatedEvents.find(event => event.args.boardId === boardId))
        listings[listingId.toString()] = {
          strike: parseInt(strike) / 1e18,
          expiry: parseInt(boardCreatedEvent.args.expiry),
        }
      }
    )

    const roundStartedSortedEvents = roundStartedEvents.sort((a, b) => a.timestamp - b.timestamp)

    for (const roundStarted of roundStartedSortedEvents) {
      let snapshotTimestamp = roundStarted.timestamp

      const maxExpiryTimestamp = roundStarted.args.newMaxExpiryTimestamp

      const roundDocuments = []

      while (true) {
        const res = await getPoolSnapshot(
          positionOpenedEvents,
          positionClosedEvents,
          globalCacheUpdatedEvents,
          listingCacheUpdatedEvents,
          basePurchasedEvents,
          baseSoldEvents,
          signalWithdrawEvents,
          unSignalWithdrawEvents,
          depositEvents,
          withdrawEvents,
          roundStarted,
          listings,
          snapshotTimestamp
        )

        if (snapshotTimestamp === maxExpiryTimestamp) {
          res.quoteValue += res.openInterestValue
          res.openInterestValue = 0
        }

        roundDocuments.push({
          ...res,
          market,
          maxExpiryTimestamp,
          snapshotTimestamp,
        })

        if (snapshotTimestamp >= currentTime || snapshotTimestamp >= maxExpiryTimestamp) {
          break
        }

        snapshotTimestamp = Math.min(snapshotTimestamp + SNAPSHOT_LENGTH, currentTime, maxExpiryTimestamp)
      }

      console.log('- Round:', market, maxExpiryTimestamp)
      console.log('--', roundDocuments.length, 'documents')
      documents = documents.concat(roundDocuments)
    }
  }

  const db = await getDB()

  const statsC = db.collection(Collections.PoolStatsSnapshots)
  await statsC.createIndex({ market: 1 })
  await statsC.createIndex({ maxExpiryTimestamp: 1 })
  await statsC.createIndex({ snapshotTimestamp: 1 })

  console.log('-', 'Update', Collections.PoolStatsSnapshots, documents.length, 'items')

  const bulk = statsC.initializeOrderedBulkOp()
  bulk.find({}).delete()
  for (const doc of documents) {
    bulk
      .find({
        market: doc.market,
        maxExpiryTimestamp: doc.maxExpiryTimestamp,
        snapshotTimestamp: doc.snapshotTimestamp,
      })
      .upsert()
      .replaceOne(doc)
  }

  const res = await bulk.execute()
  console.log('--', 'Remove', res.nRemoved, 'items')
  console.log('--', 'Insert', res.nUpserted, 'items')

  console.log(`- Done in ${chalk.yellow((Date.now() - startTime) / 1000)} sec`)
}

if (process.env.SENTRY_DSN && process.env.NODE_ENV === 'production') {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    tracesSampleRate: 1.0,
  })
  console.log('init sentry')
}

loadArgsAndEnv(process.argv)
initializeDB()
  .then(async () => await syncPoolStats())
  .then(() => {
    console.log('Done')
    process.exit(0)
  })
  .catch(e => {
    Sentry.captureException(e)
    Sentry.flush(2000)
    throw e
  })
