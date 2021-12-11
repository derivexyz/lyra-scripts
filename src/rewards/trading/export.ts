import objectsToCsv from 'objects-to-csv'
import CONFIG from './config'
import getTradingRewards from './getTradingRewards'

const OUT_FILE = './out/trading.csv'

export default async function exportTradingRewards() {
  const rows: Record<string, any>[] = []
  for (const params of CONFIG) {
    console.log(
      '-',
      'Round:',
      new Date(params.roundMaxExpiryTimestamp * 1000).toDateString(),
      `(${params.roundMaxExpiryTimestamp})`
    )
    const result = await getTradingRewards(params)
    const totalRewards = Object.values(result).reduce((sum, user) => sum + user.rewards, 0)
    console.log('--', Object.keys(result).length, 'traders')
    console.log('--', totalRewards, '/', params.rewardCap, 'rewards distributed')
    for (const rewards of Object.values(result)) {
      rows.push({
        maxExpiryTimestamp: params.roundMaxExpiryTimestamp,
        ...rewards,
      })
    }
  }
  const csv = new objectsToCsv(rows)
  await csv.toDisk(OUT_FILE, { allColumns: true })
  console.log('- Exported to', OUT_FILE)
}
