import initializeDB, { getDB } from '../utils/mongo'
import { Deployments, getEventCollectionName, getStatsCollectionName } from '../utils'
import console from 'console'
import { ethers } from 'ethers'
import { Db } from 'mongodb'
import { getLyraContract } from '../utils/transactions'
import { loadContractNamesForDeployment, loadLyraContractDeploymentBlock } from '../utils/parseFiles'
import { getBlocksDb, updateBlocksToLatest } from '../utils/blocks'
import { getIsPostRegenesis, PRE_REGENESIS_ADD } from '../utils/isPostRegenesis'

const EVENT_BATCH_SIZE = 1
const EVENT_BLOCK_BATCH = 10000

const CLEAR_OLD = false

async function insertEventsToDb(
  db: Db,
  deployment: Deployments,
  contractName: string,
  eventName: string,
  latestBlock: number,
  events: any[],
  indexedFields: string[],
  market?: string
) {
  const eventCollection = db.collection(getEventCollectionName(deployment, contractName, eventName, market))
  if (CLEAR_OLD) {
    await eventCollection.deleteMany({})
  }

  // check if event entry exists
  const currentEntry = await eventCollection.find().limit(1).toArray()

  if (currentEntry.length == 0) {
    for (const index of ['_id', 'txHash', 'block', ...indexedFields.map(x => `args.${x}`)]) {
      await eventCollection.createIndex(index)
    }
  }

  if (events.length > 0) {
    await eventCollection.insertMany(events)
  }

  const statsCollection = db.collection(getStatsCollectionName(deployment))
  await statsCollection.updateOne(
    { contractName, eventName, market },
    { $set: { contractName, eventName, latestBlock, market } },
    { upsert: true }
  )
}

async function getLatestCachedBlock(
  db: Db,
  deployment: Deployments,
  contractName: string,
  eventName: string,
  market?: string
) {
  const statsCollection = db.collection(getStatsCollectionName(deployment))

  // check if event entry exists
  const currentEntry = await statsCollection.findOne({
    contractName,
    eventName,
    market,
  })

  if (!currentEntry) {
    return loadLyraContractDeploymentBlock(deployment, contractName, market)
  } else {
    return currentEntry.latestBlock + 1
  }
}

async function retryUntilPass(fn: () => Promise<any>) {
  while (true) {
    try {
      return await fn()
    } catch (e) {
      console.log('--- retry', (e as any).message)
    }
  }
}

async function getAllEvents(
  blockTimestamps: any,
  deployment: Deployments,
  contract: ethers.Contract,
  filter: ethers.EventFilter,
  startBlock: number,
  endBlock: number,
  nameTypes: [string, string][],
  isPostRegenesis: boolean
) {
  let eventBatch = []
  let results: any[] = []
  let current = startBlock - (isPostRegenesis ? 0 : PRE_REGENESIS_ADD)
  const endBlockNumber = endBlock - (isPostRegenesis ? 0 : PRE_REGENESIS_ADD)
  while (current < endBlockNumber) {
    console.log(`--- [${current}/${endBlockNumber}]`)
    const toBlock = current + EVENT_BLOCK_BATCH - 1
    eventBatch.push(
      retryUntilPass(async () => {
        return await contract.queryFilter(filter, current, toBlock > endBlockNumber ? endBlockNumber : toBlock)
      })
    )
    if (eventBatch.length >= EVENT_BATCH_SIZE) {
      const res = await Promise.all(eventBatch)
      results = results.concat(...res)
      eventBatch = []
    }
    current += EVENT_BLOCK_BATCH
  }
  if (eventBatch.length > 0) {
    const res = await Promise.all(eventBatch)
    results = results.concat(...res)
  }
  return await Promise.all(
    results.map(async x => {
      const res: { [key: string]: any } = {
        block: x.blockNumber + (isPostRegenesis ? 0 : PRE_REGENESIS_ADD),
        txHash: x.transactionHash,
        timestamp: blockTimestamps[x.blockNumber + (isPostRegenesis ? 0 : PRE_REGENESIS_ADD)],
        args: {},
      }
      x.args.forEach((x: any, i: number) => {
        res.args[nameTypes[i][0]] = x.toString()
      })
      return res
    })
  )
}

export async function cacheAllEventsForLyraContract(
  db: Db,
  blockTimestamps: { number: number },
  deployment: Deployments,
  contractName: string,
  endBlock: number,
  market?: string
) {
  console.log(`- Caching all events for ${contractName}`)

  const contract = await getLyraContract(deployment, contractName, market)

  const promises = []

  const isPostRegenesis = await getIsPostRegenesis()

  for (const event in contract.interface.events) {
    promises.push(
      (async () => {
        const eventData = contract.interface.events[event]

        const nameTypes: [string, string][] = eventData.inputs.map(x => [x.name, 'STRING'])
        const indexedFields: string[] = eventData.inputs.filter(x => x.indexed).map(x => x.name)

        const filter = contract.filters[event](...eventData.inputs.map(_ => null))

        let startBlock = await getLatestCachedBlock(db, deployment, contractName, eventData.name, market)
        if (isPostRegenesis && startBlock < 0) {
          startBlock = 0
        }

        console.log(
          `-- Getting all ${market ? `${market} ` : ''}${contractName} ${
            eventData.name
          } events from ${startBlock} to ${endBlock}`
        )

        const newEvents = await getAllEvents(
          blockTimestamps,
          deployment,
          contract,
          filter,
          startBlock,
          endBlock,
          nameTypes,
          isPostRegenesis
        )

        console.log(`-- Inserting ${market ? `${market} ` : ''}${contractName} ${eventData.name} events into db`)
        await insertEventsToDb(db, deployment, contractName, eventData.name, endBlock, newEvents, indexedFields, market)
        console.log(`-- ${market ? `${market} ` : ''}${contractName} ${eventData.name} done`)
      })()
    )
  }
  await Promise.all(promises)
}

export default async function cacheEventsAndBlocks() {
  const startTime = Date.now()
  await initializeDB()
  const db = await getDB()

  // To cache all events (kovan and old mainnet deployment
  // for (const deployment of deployments) {
  for (const deployment of ['mainnet-ovm'] as Deployments[]) {
    const network = deployment.split('-')[0]

    let blocksDb = getBlocksDb(network)
    const endBlock = await updateBlocksToLatest(blocksDb, deployment)
    let res = blocksDb.prepare('SELECT blockNumber, timestamp FROM blockNums').all()
    console.log(res[0])
    console.log(res[res.length - 1])
    let timestamps: any = {}
    res.forEach((x: any) => {
      timestamps[x.blockNumber] = x.timestamp
    })

    if (CLEAR_OLD) {
      const statsCollection = db.collection(getStatsCollectionName(deployment))
      await statsCollection.deleteMany({})
    }

    const innerStartTime = Date.now()
    console.log('==============')
    console.log(`= Deployment: ${deployment}`)
    console.log('==============')

    const contracts = loadContractNamesForDeployment(deployment)
    for (const contract of contracts) {
      await cacheAllEventsForLyraContract(db, timestamps, deployment, contract.contractName, endBlock, contract.market)
    }
    console.log(`- Done in ${(Date.now() - innerStartTime) / 1000} sec`)
  }
  console.log(`Done in ${(Date.now() - startTime) / 1000} sec`)
}
