import nullthrows from 'nullthrows'
import initializeDB from '../utils/mongo'
import { loadArgsAndEnv } from '../utils'
import path from 'path'
import * as Sentry from '@sentry/node'

loadArgsAndEnv(process.argv)

const COMMANDS = ['export', 'sync']
const PROGRAMS = [
  'all',
  'lyra-lp',
  'retro-trading',
  'trading',
  'community',
  'dai-susd-lp',
  'eth-lyra-lp',
  'snx-staking',
]
const command = nullthrows(
  COMMANDS.find(c => c === process.argv[2]),
  'Invalid command: export, sync'
)
const program = nullthrows(
  PROGRAMS.find(p => p === process.argv[3]),
  `Invalid program: ${PROGRAMS.join(', ')}`
)

const exportOrSync = async () => {
  console.log(command.toUpperCase(), '...')
  const startTime = new Date()
  console.log('- Start', startTime.toISOString())
  await initializeDB()
  if (program === 'all') {
    for (const currProgram of PROGRAMS) {
      if (currProgram === 'all') {
        continue
      }
      const programPath = path.join(__dirname, currProgram, command)
      const run = require(programPath).default
      console.log(currProgram.toUpperCase(), '...')
      await run()
    }
  } else {
    const programPath = path.join(__dirname, program, command)
    const run = require(programPath).default
    console.log(program.toUpperCase(), '...')
    await run()
  }
  const endTime = new Date()
  console.log('- End', endTime.toISOString())
}

if (process.env.SENTRY_DSN && process.env.NODE_ENV === 'production') {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    tracesSampleRate: 1.0,
  })
  console.log('init sentry')
}

exportOrSync()
  .then(() => {
    process.exit(0)
  })
  .catch(e => {
    Sentry.captureException(e)
    Sentry.flush(2000)
    throw e
  })
