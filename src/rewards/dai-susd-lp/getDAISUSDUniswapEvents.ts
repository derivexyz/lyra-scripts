import { ethers } from 'ethers'
import { abi as uniNFTAbi } from '../../abis/NonfungiblePositionManager.json'
import { abi as IUniswapV3PoolABI } from '../../abis/IUniswapV3Pool.json'
import sqlite3 from 'better-sqlite3'
import * as path from 'path'
import { PRE_REGENESIS_ADD } from '../../utils/isPostRegenesis'
import { queryEvents } from '../../utils/events'

const START_BLOCK = 0

export async function initUniswapTables(db: sqlite3.Database) {
  await db.exec(`CREATE TABLE IF NOT EXISTS nftTransfer (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    blockNumber INTEGER NOT NULL,
    tokenId STRING NOT NULL,
    fromAddr STRING NOT NULL,
    toAddr STRING NOT NULL
  )`)
  await db.exec(`CREATE TABLE IF NOT EXISTS nftIncreaseLiquidity (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    blockNumber INTEGER NOT NULL,
    tokenId STRING NOT NULL,
    liquidity STRING NOT NULL
  )`)
  await db.exec(`CREATE TABLE IF NOT EXISTS nftDecreaseLiquidity (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    blockNumber INTEGER NOT NULL,
    tokenId STRING NOT NULL,
    liquidity STRING NOT NULL
  )`)
  await db.exec(`CREATE TABLE IF NOT EXISTS poolMints (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    blockNumber INTEGER NOT NULL,
    tickLower INTEGER NOT NULL,
    tickUpper INTEGER NOT NULL
  )`)
}

const provider = new ethers.providers.JsonRpcProvider('https://mainnet.optimism.io')

const poolContract = new ethers.Contract('0xadb35413ec50e0afe41039eac8b930d313e94fa4', IUniswapV3PoolABI, provider)

const uniNftContract = new ethers.Contract('0xc36442b4a4522e871399cd717abdd847ab11fe88', uniNFTAbi, provider)

export async function syncDAISUSDTransfers(endBlock: number) {
  const db = sqlite3(
    path.join(__dirname, '../../../data/dai-susd-lp/0xadb35413ec50e0afe41039eac8b930d313e94fa4.sqlite')
  )
  let results = db.prepare('SELECT * FROM nftTransfer ORDER BY blockNumber').all()
  const startBlock = results[results.length - 1]?.blockNumber + 1 || START_BLOCK

  if (startBlock > endBlock) {
    return results
  }

  console.log(`- Fetching new nft transfer events from ${startBlock} to ${endBlock}`)
  const newResults = await queryEvents(
    uniNftContract,
    uniNftContract.filters.Transfer(null, null, null),
    startBlock,
    endBlock
  )

  const statement = await db.prepare(
    'INSERT INTO nftTransfer (blockNumber, tokenId, fromAddr, toAddr) VALUES (?, ?, ?, ?)'
  )
  for (const item of newResults) {
    statement.run(item.blockNumber, item.args.tokenId.toString(), item.args.from, item.args.to)
    results.push({
      blockNumber: item.blockNumber,
      tokenId: item.args.tokenId.toString(),
      fromAddr: item.args.from,
      toAddr: item.args.to,
    })
  }
  return results
}

export async function syncDAISUSDIncreaseEvents(endBlock: number) {
  const db = sqlite3(
    path.join(__dirname, '../../../data/dai-susd-lp/0xadb35413ec50e0afe41039eac8b930d313e94fa4.sqlite')
  )
  let results = db.prepare('SELECT * FROM nftIncreaseLiquidity ORDER BY blockNumber').all()
  const startBlock = results[results.length - 1]?.blockNumber + 1 || START_BLOCK

  if (startBlock > endBlock) {
    return results
  }

  console.log(`- Fetching new nft increase liquidity events from ${startBlock} to ${endBlock}`)
  const newResults = await queryEvents(
    uniNftContract,
    uniNftContract.filters.IncreaseLiquidity(null, null, null, null),
    startBlock,
    endBlock
  )

  const statement = await db.prepare(
    'INSERT INTO nftIncreaseLiquidity (blockNumber, tokenId, liquidity) VALUES (?, ?, ?)'
  )
  for (const item of newResults) {
    statement.run(item.blockNumber, item.args.tokenId.toString(), item.args.liquidity.toString())
    results.push({
      blockNumber: item.blockNumber,
      tokenId: item.args.tokenId.toString(),
      liquidity: item.args.liquidity.toString(),
    })
  }
  return results
}

export async function syncDAISUSDDecreaseEvents(endBlock: number) {
  const db = sqlite3(
    path.join(__dirname, '../../../data/dai-susd-lp/0xadb35413ec50e0afe41039eac8b930d313e94fa4.sqlite')
  )
  let results = db.prepare('SELECT * FROM nftDecreaseLiquidity ORDER BY blockNumber').all()
  const startBlock = results[results.length - 1]?.blockNumber + 1 || START_BLOCK

  if (startBlock > endBlock) {
    return results
  }

  console.log(`- Fetching new nft decrease liquidity events from ${startBlock} to ${endBlock}`)
  const newResults = await queryEvents(
    uniNftContract,
    uniNftContract.filters.DecreaseLiquidity(null, null, null, null),
    startBlock,
    endBlock
  )

  const statement = await db.prepare(
    'INSERT INTO nftDecreaseLiquidity (blockNumber, tokenId, liquidity) VALUES (?, ?, ?)'
  )
  for (const item of newResults) {
    statement.run(item.blockNumber, item.args.tokenId.toString(), item.args.liquidity.toString())
    results.push({
      blockNumber: item.blockNumber,
      tokenId: item.args.tokenId.toString(),
      liquidity: item.args.liquidity.toString(),
    })
  }
  return results
}

export async function syncDAISUSDMintEvents(endBlock: number) {
  const db = sqlite3(
    path.join(__dirname, '../../../data/dai-susd-lp/0xadb35413ec50e0afe41039eac8b930d313e94fa4.sqlite')
  )

  let results = db.prepare('SELECT * FROM poolMints ORDER BY blockNumber').all()
  const startBlock = results[results.length - 1]?.blockNumber + 1 || START_BLOCK

  if (startBlock > endBlock) {
    return results
  }

  console.log(`- Fetching new pool mint events from ${startBlock} to ${endBlock}`)
  const newResults = await queryEvents(
    poolContract,
    poolContract.filters.Mint(null, null, null, null, null, null, null),
    startBlock,
    endBlock
  )

  const statement = await db.prepare('INSERT INTO poolMints (blockNumber, tickLower, tickUpper) VALUES (?, ?, ?)')
  for (const item of newResults) {
    statement.run(item.blockNumber, item.args.tickLower.toString(), item.args.tickUpper.toString())
    results.push({
      blockNumber: item.blockNumber,
      tickLower: item.args.tickLower.toString(),
      tickUpper: item.args.tickUpper.toString(),
    })
  }
  return results
}

export default async function getDAISUSDUniswapEvents(): Promise<{
  mints: any[]
  transfers: any[]
  increaseEvents: any[]
  decreaseEvents: any[]
}> {
  const preRegenesisDB = sqlite3(
    path.join(__dirname, '../../../data/dai-susd-lp/0xa14e5b3ba5dd981b536e0950390b03972b795018-preRegenesis.sqlite')
  )
  const db = sqlite3(
    path.join(__dirname, '../../../data/dai-susd-lp/0xadb35413ec50e0afe41039eac8b930d313e94fa4.sqlite')
  )

  const regenesisReduction = (x: any) => {
    return {
      ...x,
      blockNumber: x.blockNumber + PRE_REGENESIS_ADD,
    }
  }

  const mints = [
    ...preRegenesisDB.prepare('SELECT * FROM poolMints ORDER BY blockNumber').all().map(regenesisReduction),
    ...db.prepare('SELECT * FROM poolMints ORDER BY blockNumber').all(),
  ]

  const transfers = [
    ...preRegenesisDB.prepare('SELECT * FROM nftTransfer ORDER BY blockNumber').all().map(regenesisReduction),
    ...db.prepare('SELECT * FROM nftTransfer ORDER BY blockNumber').all(),
  ]

  const increaseEvents = [
    ...preRegenesisDB.prepare('SELECT * FROM nftIncreaseLiquidity ORDER BY blockNumber').all().map(regenesisReduction),
    ...db.prepare('SELECT * FROM nftIncreaseLiquidity ORDER BY blockNumber').all(),
  ]

  const decreaseEvents = [
    ...preRegenesisDB.prepare('SELECT * FROM nftDecreaseLiquidity ORDER BY blockNumber').all().map(regenesisReduction),
    ...db.prepare('SELECT * FROM nftDecreaseLiquidity ORDER BY blockNumber').all(),
  ]

  return {
    mints,
    transfers,
    increaseEvents,
    decreaseEvents,
  }
}
