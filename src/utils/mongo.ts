import { MongoClient, Db, MongoClientOptions } from 'mongodb'
import nullthrows from 'nullthrows'
import { sleep } from '.'

let db: Db

const mongoConfig: MongoClientOptions = {
  numberOfRetries: 5,

  useNewUrlParser: true,
  poolSize: 200,
  useUnifiedTopology: true,
}

const initializeDB = async () => {
  const MONGO_URI: any =
    process.env.NODE_ENV === 'development'
      ? `mongodb://${process.env.MONGO_USERNAME}:${process.env.MONGO_PASSWORD}@${process.env.MONGO_URL}`
      : `mongodb+srv://${process.env.MONGO_USERNAME}:${process.env.MONGO_PASSWORD}@${process.env.MONGO_URL}`
  const DB_NAME: string = nullthrows(process.env.MONGO_DB_NAME, 'Missing MONGO_DB_NAME env var')
  if (db != null) {
    return db
  }
  try {
    const client = await MongoClient.connect(MONGO_URI, mongoConfig)
    db = await client.db(DB_NAME)
    console.log('- Initialized DB')
  } catch (e) {
    console.log(e)
  }
}

export default initializeDB

export const getDB = async () => {
  let count = 0
  while (!db) {
    await sleep(500)
    count++
    if (count > 10) {
      throw Error('DB not connected')
    }
  }
  return db
}
