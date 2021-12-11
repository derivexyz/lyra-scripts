import { loadArgsAndEnv } from '../../utils'
import initializeDB from '../../utils/mongo'
import CONFIG from './config'
import { syncSNXDebtSnapshots, syncSNXDebtStates } from './getSNXDebtData'
import { syncSNXUniswapEvents } from './getSNXUniswapAcceptedAddresses'

async function syncSNXData() {
  // sync uniswap data
  console.log('Sync uniswap events')
  await syncSNXUniswapEvents(CONFIG)
  console.log('- Done')

  // sync debt snapshots
  console.log('Sync debt snapshots')
  await syncSNXDebtSnapshots(CONFIG)
  console.log('- Done')

  // sync debt states
  console.log('Sync debt states')
  await syncSNXDebtStates(CONFIG)
  console.log('- Done')
}

loadArgsAndEnv(process.argv)
initializeDB()
  .then(async () => await syncSNXData())
  .then(() => process.exit(0))
  .catch(() => process.exit(1))
