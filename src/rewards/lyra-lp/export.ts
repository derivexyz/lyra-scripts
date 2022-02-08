import getLyraLPRewards from './getLyraLPRewards'
import CONFIG from './config'
import objectsToCsv from 'objects-to-csv'
import getLyraLPRewardsWithLEAP14Bug from './getLyraLPRewardsWithLEAP14Bug'

const OUT_FILE = './out/lyra-lp.csv'

export default async function exportLyraLPRewards() {
  const rows: Record<string, any>[] = []
  const leap14ExtraRewards: Record<string, number> = {}

  for (const market in CONFIG) {
    console.log('-', market)
    for (const params of CONFIG[market]) {
      console.log(
        '--',
        'Round:',
        new Date(params.maxExpiryTimestamp * 1000).toDateString(),
        `(${params.maxExpiryTimestamp})`
      )

      let result
      if (params.bugs?.leap14) {
        // fetch result with leap-14 bug
        result = await getLyraLPRewardsWithLEAP14Bug(market, params)
        // fetch result without leap-14 bug
        const correctResult = await getLyraLPRewards(market, params)
        // calculate extra rewards owed per user
        Object.entries(result).forEach(([address, { rewards: distributedRewards }]) => {
          const correctRewards = correctResult[address]?.rewards
          if (correctRewards != null && correctRewards > distributedRewards) {
            leap14ExtraRewards[address] = (leap14ExtraRewards[address] ?? 0) + correctRewards - distributedRewards
          }
        })
      } else {
        result = await getLyraLPRewards(market, params)
      }

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

  // create events for extra rewards
  const totalLeap14ExtraRewards = Object.values(leap14ExtraRewards).reduce((sum, val) => sum + val, 0)
  console.log('- LEAP-14 bug')
  console.log('--', Object.values(leap14ExtraRewards).length, 'under-rewarded LPs')
  console.log('--', totalLeap14ExtraRewards, 'extra rewards')

  for (const [address, rewards] of Object.entries(leap14ExtraRewards)) {
    rows.push({
      address,
      rewards,
    })
  }

  const csv = new objectsToCsv(rows)
  await csv.toDisk(OUT_FILE, { allColumns: true })

  console.log('-- Exported to', OUT_FILE)
}
