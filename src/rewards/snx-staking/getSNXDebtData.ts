import sqlite3 from 'better-sqlite3'
import path from 'path'
import axios from 'axios'
import { SNXStakingConfig } from './config'

async function getOldDebtDB() {
  const db = sqlite3(path.join(__dirname, '../../../data/snx-staking/snxDebt-preRegenesis.sqlite'))
  await createDebtTables(db)
  return db
}

async function getDebtDB() {
  const db = sqlite3(path.join(__dirname, '../../../data/snx-staking/snxDebt.sqlite'))
  await createDebtTables(db)
  return db
}

async function createDebtTables(db: any) {
  await db.exec(`CREATE TABLE IF NOT EXISTS DebtSnapshots (
      id TEXT PRIMARY KEY NOT NULL,
      block INTEGER NOT NULL,
      timestamp INTEGER NOT NULL,
      account TEXT NOT NULL,
      balanceOf REAL NOT NULL,
      collateral REAL NOT NULL,
      debtBalanceOf REAL NOT NULL
    );`)

  await db.exec(`CREATE TABLE IF NOT EXISTS DebtStates (
      id TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      debtEntry REAL NOT NULL,
      totalIssuedSynths REAL NOT NULL,
      debtRatio REAL NOT NULL
    );`)
}

async function insertToDebtSnapshots(db: any, data: any[]) {
  const insertStmt = db.prepare(
    'INSERT OR IGNORE INTO DebtSnapshots (id, block, timestamp, account, balanceOf, collateral, debtBalanceOf) VALUES (?, ?, ?, ?, ?, ?, ?)'
  )
  await db.transaction((x: any) => {
    for (const item of x) {
      insertStmt.run(
        item.id,
        item.block,
        item.timestamp,
        item.account,
        item.balanceOf,
        item.collateral,
        item.debtBalanceOf
      )
    }
  })(data)
}

async function selectAllFromDebtSnapshots(db: any) {
  const statement = `SELECT * FROM DebtSnapshots`
  return db.prepare(statement).all()
}

async function selectMaxBlockFromDebtSnapshots(db: any) {
  const statement = `SELECT MAX(block) as maxBlock FROM DebtSnapshots`
  return db.prepare(statement).get().maxBlock || 0
}

export async function syncSNXDebtSnapshots(params: SNXStakingConfig) {
  const oldData = await selectAllFromDebtSnapshots(await getOldDebtDB())
  const db = await getDebtDB()

  let result: any[] = await selectAllFromDebtSnapshots(db)

  // Can only skip a max of 5000, so we need to break apart the calls via some parameters
  let startBlock = await selectMaxBlockFromDebtSnapshots(db)

  while (true) {
    const res = await axios.post('https://api.thegraph.com/subgraphs/name/synthetixio-team/optimism-issuance', {
      query: `
    query DebtSnapshots {
      debtSnapshots(first: 1000, where: {block_gt: ${startBlock}, timestamp_lte: ${params.stakingEndDate}}, orderBy: block) {
        id
        block
        timestamp
        account
        balanceOf
        collateral
        debtBalanceOf
      }
    }`,
    })
    const data = res.data?.data?.debtSnapshots || []
    result = result.concat(...data)
    await insertToDebtSnapshots(db, data)
    startBlock = Math.max(...data.map((x: any) => parseInt(x.block)))
    if (data.length < 1000) {
      break
    }
  }

  return [...oldData, ...result]
}

export async function getSNXDebtSnapshots() {
  const oldData = await selectAllFromDebtSnapshots(await getOldDebtDB())
  const newData = await selectAllFromDebtSnapshots(await getDebtDB())
  return [...oldData, ...newData]
}

async function insertToDebtStates(db: any, data: any[]) {
  const insertStmt = db.prepare(
    'INSERT INTO DebtStates (id, timestamp, debtEntry, totalIssuedSynths, debtRatio) VALUES (?, ?, ?, ?, ?)'
  )
  await db.transaction((x: any) => {
    for (const item of x) {
      insertStmt.run(item.id, item.timestamp, item.debtEntry, item.totalIssuedSynths, item.debtRatio)
    }
  })(data)
}

async function selectMaxTimestampFromDebtStates(db: any) {
  const statement = `SELECT MAX(timestamp) as maxTimestamp FROM DebtStates`
  return (await db.prepare(statement).get())?.maxTimestamp || 0
}

async function selectAllDebtStates(db: any) {
  const statement = `SELECT * FROM DebtStates`
  return db.prepare(statement).all()
}

export async function syncSNXDebtStates(params: SNXStakingConfig) {
  const oldData = await selectAllDebtStates(await getOldDebtDB())
  const db = await getDebtDB()
  let result = await selectAllDebtStates(db)

  while (true) {
    const maxTimestamp = await selectMaxTimestampFromDebtStates(db)
    const res = await axios.post('https://api.thegraph.com/subgraphs/name/synthetixio-team/optimism-global-debt', {
      query: `
      query DebtState {
        debtStates(first: 1000, orderBy: timestamp, where: {timestamp_gt: ${maxTimestamp}, timestamp_lte: ${params.stakingEndDate}}) {
          id
          timestamp
          debtEntry
          totalIssuedSynths
          debtRatio
        }
      }`,
    })
    const data = res.data?.data?.debtStates || []
    result = result.concat(...data)
    await insertToDebtStates(db, data)
    if (data.length < 1000) {
      break
    }
  }

  return [...oldData, ...result]
}

export async function getSNXDebtStates() {
  const oldData = await selectAllDebtStates(await getOldDebtDB())
  const newData = await selectAllDebtStates(await getDebtDB())
  return [...oldData, ...newData]
}
