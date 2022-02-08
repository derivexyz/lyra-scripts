import gtDiscordRewards from './getDiscordRewards'
import objectsToCsv from 'objects-to-csv'
import { loadArgsAndEnv } from '../../utils'
import initializeDB from '../../utils/mongo'

const OUT_FILE = './data/community/discord.csv'

export default async function exportDiscordRewards() {
  const discordRewards = await gtDiscordRewards()
  const discordRows: Record<string, any>[] = Object.entries(discordRewards).map(
    ([address, { rewards, discordUserId }]) => {
      return {
        address,
        rewards,
        discordUserId,
      }
    }
  )
  console.log('-', discordRows.length, 'discord addresses')

  const communityCSV = new objectsToCsv(discordRows)
  await communityCSV.toDisk(OUT_FILE, { allColumns: true })

  console.log('- Exported to', OUT_FILE)
}

loadArgsAndEnv(process.argv)
initializeDB()
  .then(async () => await exportDiscordRewards())
  .then(() => process.exit(0))
  .catch(e => {
    console.log(e)
    throw e
  })
