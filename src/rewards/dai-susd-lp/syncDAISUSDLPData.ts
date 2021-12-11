import { loadArgsAndEnv } from '../../utils'
import initializeDB from '../../utils/mongo'
import { MAX_BLOCK } from './config'
import {
  syncDAISUSDDecreaseEvents,
  syncDAISUSDIncreaseEvents,
  syncDAISUSDMintEvents,
  syncDAISUSDTransfers,
} from './getDAISUSDUniswapEvents'

async function syncDAISUSDLPData() {
  const endBlock = MAX_BLOCK

  // sync uniswap data
  console.log('Sync dai-susd mint events')
  await syncDAISUSDMintEvents(endBlock)
  console.log('- Done')

  // sync uniswap data
  console.log('Sync dai-susd transfer events')
  await syncDAISUSDTransfers(endBlock)
  console.log('- Done')

  // sync debt snapshots
  console.log('Sync dai-susd increase events')
  await syncDAISUSDIncreaseEvents(endBlock)
  console.log('- Done')

  // sync debt states
  console.log('Sync dai-susd decrease events')
  await syncDAISUSDDecreaseEvents(endBlock)
  console.log('- Done')
}

loadArgsAndEnv(process.argv)
initializeDB()
  .then(async () => await syncDAISUSDLPData())
  .then(() => process.exit(0))
  .catch(() => process.exit(1))
