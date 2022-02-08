import objectsToCsv from 'objects-to-csv'
import cacheETHLYRALPEvents from './cacheETHLYRALPEvents'
import CONFIG from './config'
import getETHLYRALPRewards from './getETHLYRALPRewards'

const OUT_FILE = './out/eth-lyra-lp.csv'

export default async function exportDAISUSDLPRewards() {
  if (process.argv.includes('--cache-events')) {
    await cacheETHLYRALPEvents(CONFIG)
  }

  const rows: Record<string, any>[] = []
  const rewardsPerAddress = await getETHLYRALPRewards(CONFIG)
  for (const [address, rewards] of Object.entries(rewardsPerAddress)) {
    rows.push({ address, rewards })
  }
  console.log(rows.length, 'addresses')

  const csv = new objectsToCsv(rows)
  await csv.toDisk(OUT_FILE, { allColumns: true })

  console.log('Exported to', OUT_FILE)
}
