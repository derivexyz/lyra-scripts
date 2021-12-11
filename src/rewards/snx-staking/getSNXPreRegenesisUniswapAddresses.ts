import sqlite3 from 'better-sqlite3'
import path from 'path'

async function getSwapsDb() {
  const db = sqlite3(path.join(__dirname, '../../../data/snx-staking/uniswapSwaps-preRegenesis.sqlite'))
  await createSwapsTables(db)
  return db
}

async function createSwapsTables(db: any) {
  await db.exec(`CREATE TABLE IF NOT EXISTS sUSDTrades (
      id TEXT PRIMARY KEY NOT NULL,
      timestamp INTEGER NOT NULL,
      origin TEXT NOT NULL,
      amount0 REAL NOT NULL,
      amount1 REAL NOT NULL,
      amountUSD REAL NOT NULL,
      marketDirection INTEGER NOT NULL,
      blockNumber INTEGER NOT NULL
    );`)
  await db.exec(`CREATE TABLE IF NOT EXISTS sUSDPositions (
      id TEXT PRIMARY KEY NOT NULL,
      owner TEXT NOT NULL,
      blockNumber INTEGER NOT NULL,
      timestamp INTEGER NOT NULL,
      depositedToken0 REAL NOT NULL,
      depositedToken1 REAL NOT NULL,
      token0 TEXT NOT NULL,
      token1 TEXT NOT NULL
    );`)
}

async function selectAllFromsUSDTrades(db: any) {
  const statement = `SELECT * FROM sUSDTrades`
  return db.prepare(statement).all()
}

async function selectAllFromPositions(db: any) {
  const statement = `SELECT * FROM sUSDPositions`
  return db.prepare(statement).all()
}

async function getAllSUSDSellers() {
  const sUSDswaps = await selectAllFromsUSDTrades(await getSwapsDb())
  const res: any = {}
  for (const swap of sUSDswaps) {
    if (!res[swap.origin]) {
      res[swap.origin] = swap.timestamp
    }

    // Skip sUSD buys
    if (swap.marketDirection == 1 && swap.amount1 < 0) {
      continue
    }
    if (swap.marketDirection == 0 && swap.amount0 < 0) {
      continue
    }

    if (res[swap.origin] > swap.timestamp) {
      res[swap.origin] = swap.timestamp
    }
  }
  return res
}

async function getAllUniswapLPs() {
  const data = await selectAllFromPositions(await getSwapsDb())
  const res: any = {}

  for (const position of data) {
    if (!res[position.owner]) {
      res[position.owner] = position.timestamp
    }

    if (res[position.owner] > position.timestamp) {
      res[position.owner] = position.timestamp
    }
  }

  return res
}

export default async function getSNXPreRegenesisUniswapAddresses(): Promise<{
  sUSDSellers: Record<string, number>
  uniswapLPs: Record<string, number>
}> {
  const uniswapLPs = await getAllUniswapLPs()
  const sUSDSellers = await getAllSUSDSellers()
  return {
    sUSDSellers,
    uniswapLPs,
  }
}
