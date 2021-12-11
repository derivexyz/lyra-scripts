import { ethers } from 'ethers'
import { abi as uniNFTAbi } from '../../abis/NonfungiblePositionManager.json'
import { abi as IUniswapV3PoolABI } from '../../abis/IUniswapV3Pool.json'
import sqlite3 from 'better-sqlite3'
import * as path from 'path'
import { queryEvents } from '../../utils/events'
import { getAll, getBlocksDb } from '../../utils/blocks'
import nullthrows from 'nullthrows'
import { SNXStakingConfig } from './config'

const SUSD_POOL_ADDRESSES: string[] = [
  '0xC53f2BE3331926D2F30eE2b10362Bb45fDBE7bF6',
  '0xC0f184C6C4832b3ed861bd5b05722792FFA64aBd',
  '0x25e412992634b93a025e2a538c53222A8C62E2D6',
  '0xAdb35413eC50E0Afe41039eaC8B930d313E94FA4',
  '0xe7eE03b72a89F87d161425e42548bd5492d06679',
  '0x1F2390484dfE2d8900Bc91c7111d274b7b2D63a1',
  '0xf046d8b7365d8aBE5a8F8301C669B4B5284fC21D',
  '0x91ccA461Ee9435848aC0da8fc416Ad0816272786',
  '0x22Fc5Dc36811d15fAfdE7Cc7900AE73a538e59e0',
  '0x9F08065DfC4817A0a56DB7bcab757E86399Bc51D',
  '0x7628784D2C5d47fcD5479bA812343b1aabaD6484',
  '0xceB488E01C8e2E669C40b330bFC1440921c9Ebe2',
  '0xfe1BD31a79163d6277aB8c2917d7857C225DB065',
  '0x8EdA97883a1Bc02Cf68C6B9fb996e06ED8fDb3e5',
  '0xa99638E4ac81D4Ce32C945c1415F89ab8d86bf2c',
  '0x2D6497DD08a1620d386Ce708edac50aAEc332415',
  '0x1fff624960FF9D0556420f3647d6AaF06389aaB1',
  '0xa21262dd366DE3Af463823E20AeD3c4ADeC22e5F',
  '0xd63A79b5fc589F3e3fc6E183d1755F7F6Cbd68c1',
  '0x84eb2c5C23999B3dDc87be10F15cCec5d22c7d97',
  '0x2E80d5A7B3C613d854EE43243Ff09808108561EB',
  '0x3d44CC727fe2f603E4929BE164c70EdB3B498B5f',
]

// The block when the pool contract was created
const START_BLOCK = 0

async function initialiseNFTDB(db: sqlite3.Database) {
  await db.exec(`CREATE TABLE IF NOT EXISTS nftTransfer (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    blockNumber INTEGER NOT NULL,
    tokenId STRING NOT NULL,
    fromAddr STRING NOT NULL,
    toAddr STRING NOT NULL
  )`)
}

async function initialiseDBTables(db: sqlite3.Database) {
  await db.exec(`CREATE TABLE IF NOT EXISTS poolSwaps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    blockNumber INTEGER NOT NULL,
    sender STRING NOT NULL,
    recipient STRING NOT NULL
  )`)
  await db.exec(`CREATE TABLE IF NOT EXISTS poolMints (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    blockNumber INTEGER NOT NULL,
    sender STRING NOT NULL,
    owner STRING NOT NULL
  )`)
}

const provider = new ethers.providers.JsonRpcProvider('https://mainnet.optimism.io')

const poolContract = new ethers.Contract('0xadb35413ec50e0afe41039eac8b930d313e94fa4', IUniswapV3PoolABI, provider)
const uniNftContract = new ethers.Contract('0xc36442b4a4522e871399cd717abdd847ab11fe88', uniNFTAbi, provider)

async function syncTransfers(db: sqlite3.Database, endBlock: number) {
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

async function syncMints(db: sqlite3.Database, endBlock: number) {
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

  const statement = await db.prepare('INSERT INTO poolMints (blockNumber, sender, owner) VALUES (?, ?, ?)')
  for (const item of newResults) {
    statement.run(item.blockNumber, item.args.sender.toString(), item.args.owner.toString())
    results.push({
      blockNumber: item.blockNumber,
      sender: item.args.sender.toString(),
      owner: item.args.owner.toString(),
    })
  }
  return results
}

async function syncSwaps(db: sqlite3.Database, endBlock: number) {
  let results = db.prepare('SELECT * FROM poolSwaps ORDER BY blockNumber').all()
  const startBlock = results[results.length - 1]?.blockNumber + 1 || START_BLOCK

  if (startBlock > endBlock) {
    return results
  }

  console.log(`- Fetching new pool swap events from ${startBlock} to ${endBlock}`)
  const newResults = await queryEvents(
    poolContract,
    poolContract.filters.Swap(null, null, null, null, null, null, null),
    startBlock,
    endBlock
  )

  const statement = await db.prepare('INSERT INTO poolSwaps (blockNumber, sender, recipient) VALUES (?, ?, ?)')
  for (const item of newResults) {
    statement.run(item.blockNumber, item.args.sender.toString(), item.args.recipient.toString())
    results.push({
      blockNumber: item.blockNumber,
      sender: item.args.sender.toString(),
      recipient: item.args.recipient.toString(),
    })
  }
  return results
}

export async function syncSNXUniswapEvents(params: SNXStakingConfig): Promise<{
  mints: any[]
  transfers: any[]
  swaps: any[]
}> {
  const endBlock = params.stakingEndBlock

  const transfersDb = sqlite3(
    path.join(__dirname, '../../../data/snx-staking/0xadb35413ec50e0afe41039eac8b930d313e94fa4-preRegenesis.sqlite')
  )
  await initialiseNFTDB(transfersDb)
  const transfers = await syncTransfers(transfersDb, endBlock)

  let mints: any[] = []
  let swaps: any[] = []

  for (let pool of SUSD_POOL_ADDRESSES) {
    if (endBlock > START_BLOCK) {
      break
    }
    let poolDb = sqlite3(path.join(__dirname, `../../../data/snx-staking/${pool}.sqlite`))
    await initialiseDBTables(poolDb)
    mints = mints.concat(...(await syncMints(poolDb, endBlock)))
    swaps = swaps.concat(...(await syncSwaps(poolDb, endBlock)))
  }

  return { mints, transfers, swaps }
}

async function getSUSDUniswapEvents(): Promise<{
  mints: any[]
  transfers: any[]
  swaps: any[]
}> {
  const transfersDb = sqlite3(
    path.join(__dirname, '../../../data/snx-staking/0xadb35413ec50e0afe41039eac8b930d313e94fa4-preRegenesis.sqlite')
  )
  const transfers = transfersDb.prepare('SELECT * FROM nftTransfer ORDER BY blockNumber').all()

  let mints: any[] = []
  let swaps: any[] = []
  for (let pool of SUSD_POOL_ADDRESSES) {
    const poolDb = sqlite3(path.join(__dirname, `../../../data/snx-staking/${pool}.sqlite`))
    swaps = swaps.concat(poolDb.prepare('SELECT * FROM poolSwaps ORDER BY blockNumber').all())
    mints = mints.concat(poolDb.prepare('SELECT * FROM poolMints ORDER BY blockNumber').all())
  }

  return {
    mints,
    transfers,
    swaps,
  }
}

export default async function getSNXUniswapAcceptedAddresses(): Promise<{
  sUSDSellers: Record<string, number>
  uniswapLPs: Record<string, number>
}> {
  const { mints, transfers, swaps } = await getSUSDUniswapEvents()

  const resLP: any = {}
  const resSeller: any = {}

  const blocksDb = await getBlocksDb('mainnet')
  const blockToTimestamp: Record<number, number> = await getAll(blocksDb);

  const mintBlockNumbers = mints.map((x: any) => x.blockNumber)
  const mintTransfers = transfers.filter((x: any) => mintBlockNumbers.includes(x.blockNumber))

  for (const mintTransfer of mintTransfers) {
    const timestamp = nullthrows(
      blockToTimestamp[mintTransfer.blockNumber],
      `Missing block ${mintTransfer.blockNumber}`
    )
    if (!resLP[mintTransfer.toAddr]) {
      resLP[mintTransfer.toAddr] = timestamp
    }
    if (resLP[mintTransfer.toAddr] > timestamp) {
      resLP[mintTransfer.toAddr] = timestamp
    }
  }

  // Note: this doesn't check the direction of the swap. So it is possible for someone who has bought sUSD instead of
  // sold to pass this check. The amount of users this may impact in even a marginal way is minuscule, so not a concern.
  for (const swap of swaps) {
    const timestamp = nullthrows(blockToTimestamp[swap.blockNumber], `Missing block ${swap.blockNumber}`)
    if (!resSeller[swap.sender]) {
      resSeller[swap.sender] = timestamp
    }

    if (resSeller[swap.sender] > timestamp) {
      resSeller[swap.sender] = timestamp
    }

    if (!resSeller[swap.recipient]) {
      resSeller[swap.recipient] = timestamp
    }

    if (resSeller[swap.recipient] > timestamp) {
      resSeller[swap.recipient] = timestamp
    }
  }

  return { sUSDSellers: resSeller, uniswapLPs: resLP }
}
