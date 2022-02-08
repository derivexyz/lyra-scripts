import { loadArgsAndEnv } from '../utils'
import cacheEventsAndBlocks from './cacheEventsAndBlocks'
import * as Sentry from '@sentry/node'

loadArgsAndEnv(process.argv)

if (process.env.SENTRY_DSN && process.env.NODE_ENV === 'production') {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    tracesSampleRate: 1.0,
  })
}

cacheEventsAndBlocks()
  .then(() => {
    console.log('Success')
    process.exit(0)
  })
  .catch(e => {
    Sentry.captureException(e)
    Sentry.flush(2000)
    throw e
  })
