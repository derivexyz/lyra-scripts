import getLyraLPRewards from './getLyraLPRewards'
import CONFIG from './config'
import objectsToCsv from 'objects-to-csv'

const OUT_FILE = './out/lyra-lp.csv'

export default async function exportLyraLPRewards() {
  const rows: Record<string, any>[] = []

  for (const market in CONFIG) {
    console.log('-', market)
    for (const params of CONFIG[market]) {
      console.log(
        '--',
        'Round:',
        new Date(params.maxExpiryTimestamp * 1000).toDateString(),
        `(${params.maxExpiryTimestamp})`
      )
      const result = await getLyraLPRewards(market, params)
      const totalRewards = Object.values(result).reduce((sum, user) => sum + user.rewards, 0)
      const initialLiquidity = Object.values(result).reduce((sum, user) => sum + user.liquidity, 0)
      console.log('---', totalRewards, '/', params.totalRewards, 'rewards distributed')
      console.log('---', initialLiquidity, 'initial liquidity')
      console.log('---', 'Found', Object.keys(result).length, 'LPs')
      for (const [address, { rewards, liquidity, share }] of Object.entries(result)) {
        rows.push({
          address,
          market,
          maxExpiryTimestamp: params.maxExpiryTimestamp,
          rewards,
          liquidity,
          share,
        })
      }
    }
  }

  const csv = new objectsToCsv(rows)
  await csv.toDisk(OUT_FILE, { allColumns: true })

  console.log('-- Exported to', OUT_FILE)
}
