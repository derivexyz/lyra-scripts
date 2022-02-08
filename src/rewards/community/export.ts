import objectsToCsv from 'objects-to-csv'
import getCSVRewards from './getCSVRewards'
import getDiscordRewards from './getDiscordRewards'

const OUT_FILE = './out/community.csv'

export default async function exportCommunityRewards() {
  const discordRewards = await getDiscordRewards()
  const discordRows: Record<string, any>[] = Object.entries(discordRewards).map(([address, { rewards }]) => {
    return {
      address,
      rewards,
    }
  })
  console.log('-', discordRows.length, 'discord addresses')

  const poapRewards = await getCSVRewards('poaps.csv')
  const poapRows: Record<string, any>[] = Object.entries(poapRewards).map(([address, rewards]) => {
    return {
      address,
      rewards,
    }
  })
  console.log('-', poapRows.length, 'POAP addresses')

  const pokerRewards = await getCSVRewards('poker.csv')
  const pokerRows: Record<string, any>[] = Object.entries(pokerRewards).map(([address, rewards]) => {
    return {
      address,
      rewards,
    }
  })
  console.log('-', pokerRows.length, 'poker addresses')

  const tradingCompRewards = await getCSVRewards('testnet-trading-comp.csv')
  const tradingCompRows: Record<string, any>[] = Object.entries(tradingCompRewards).map(([address, rewards]) => {
    return {
      address,
      rewards,
    }
  })
  console.log('-', tradingCompRows.length, 'testnet trading comp addresses')

  const communityCSV = new objectsToCsv([...discordRows, ...poapRows, ...pokerRows, ...tradingCompRows])
  await communityCSV.toDisk(OUT_FILE, { allColumns: true })

  console.log('- Exported to', OUT_FILE)
}
