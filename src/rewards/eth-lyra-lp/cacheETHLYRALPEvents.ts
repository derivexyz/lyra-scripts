import {
  initETHLYRATables,
  syncETHLYRADecreaseEvents,
  syncETHLYRAIncreaseEvents,
  syncETHLYRAMintEvents,
  syncETHLYRATransfers,
} from './getETHLYRAUniswapEvents'
import { getBlocksDb, getCachedMax } from '../../utils/blocks'

const START_BLOCK = 990376

export default async function cacheETHLYRALPEvents() {
  const endBlock = await getCachedMax(getBlocksDb('mainnet'))

  // TODO: add flag to clear data in tables
  await initETHLYRATables()
  console.log('- Initialized LP sqlite databases')

  // sync uniswap data
  console.log('- Caching mint events')
  const mints = await syncETHLYRAMintEvents(START_BLOCK, endBlock)
  console.log('-- Total', mints.length, 'events')
  console.log('-- Done')

  // sync uniswap data
  console.log('- Caching transfer events')
  const transfers = await syncETHLYRATransfers(START_BLOCK, endBlock)
  console.log('-- Total', transfers.length, 'events')
  console.log('-- Done')

  // sync debt snapshots
  console.log('- Caching increase events')
  const increase = await syncETHLYRAIncreaseEvents(START_BLOCK, endBlock)
  console.log('-- Total', increase.length, 'events')
  console.log('-- Done')

  // sync debt states
  console.log('- Caching decrease events')
  const decrease = await syncETHLYRADecreaseEvents(START_BLOCK, endBlock)
  console.log('-- Total', decrease.length, 'events')
  console.log('-- Done')

  return endBlock
}
