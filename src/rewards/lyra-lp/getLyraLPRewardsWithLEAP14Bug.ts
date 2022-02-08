import { PRE_REGENESIS_ADD } from '../../utils/isPostRegenesis'
import { LyraLPRoundConfig } from './config'
import { getEventsFromLyraContract } from '../../utils/events'

// ignore LP positions from DAO + burn address
const DAO_ADDRESS = '0xB6DACAE4eF97b4817d54df8e005269f509f803f9'
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

export default async function getLyraLPRewardsWithLEAP14Bug(
  market: string,
  params: LyraLPRoundConfig
): Promise<
  Record<
    string,
    {
      liquidity: number
      share: number
      rewards: number
    }
  >
> {
  const roundStartedEvents = await getEventsFromLyraContract(params.deployment, 'LiquidityPool', 'RoundStarted', market)
  const roundEndedEvents = await getEventsFromLyraContract(params.deployment, 'LiquidityPool', 'RoundEnded', market)
  const dataModifiedEvents = await getEventsFromLyraContract(
    params.deployment,
    'LiquidityCertificate',
    'CertificateDataModified',
    market
  )
  const transferEvents = await getEventsFromLyraContract(params.deployment, 'LiquidityCertificate', 'Transfer', market)

  // get RoundStarted event matching maxExpiryTimestamp
  const roundStartedEvent = roundStartedEvents.find(x => {
    return (x.args.newMaxExpiryTimestamp || x.args.newMaxExpiryTimestmp) == params.maxExpiryTimestamp
  })
  if (!roundStartedEvent) {
    console.log(`- WARNING: round with expiryTimestamp ${params.maxExpiryTimestamp} has not started`)
    return {}
  }

  // store map of expiry to token value
  const expiryToTokenValue: { [key: number]: number } = {}
  roundEndedEvents.forEach((x: any) => {
    expiryToTokenValue[x.args.maxExpiryTimestamp] = x.args.pricePerToken / 1e18
  })

  // calculate all liquidity certificate balances for the RoundStarted block
  const certificates: {
    [key: number]: { value: number; owner: string; lastTransfer: number }
  } = {}

  for (const dataModifiedEvent of dataModifiedEvents) {
    if (dataModifiedEvent.block <= roundStartedEvent.block) {
      certificates[dataModifiedEvent.args.certificateId] = {
        value:
          ((dataModifiedEvent.args.liquidity / expiryToTokenValue[dataModifiedEvent.args.enteredAt]) *
            expiryToTokenValue[
              roundStartedEvent.args.lastMaxExpiryTimestamp || roundStartedEvent.args.lastMaxExpiryTimestmp
            ]) /
          1e18,
        owner: '',
        lastTransfer: PRE_REGENESIS_ADD,
      }
    }
  }

  for (const transfer of transferEvents) {
    if (transfer.block > roundStartedEvent.block) {
      continue
    }
    if (certificates[transfer.args.tokenId].lastTransfer < transfer.block) {
      certificates[transfer.args.tokenId].lastTransfer = transfer.block
      certificates[transfer.args.tokenId].owner = transfer.args.to
    }
  }

  // calculate liquidity and rewards for all owners
  const liquidityPerOwner: Record<string, number> = {}
  for (const certificateId in certificates) {
    const certificate = certificates[certificateId]
    if ([DAO_ADDRESS, ZERO_ADDRESS].includes(certificate.owner)) {
      continue
    }
    if (!liquidityPerOwner[certificate.owner]) {
      liquidityPerOwner[certificate.owner] = 0
    }
    liquidityPerOwner[certificate.owner] += certificate.value
  }

  const totalLiquidity = Object.values(liquidityPerOwner).reduce((sum, liquidity) => sum + liquidity, 0)

  return Object.keys(liquidityPerOwner).reduce((rewardsPerAddress, owner) => {
    const liquidity = liquidityPerOwner[owner]
    const share = liquidity / totalLiquidity
    const rewards = share * params.totalRewards
    if (rewards === 0) {
      return rewardsPerAddress
    }
    return {
      ...rewardsPerAddress,
      [owner]: {
        liquidity,
        share,
        rewards,
      },
    }
  }, {})
}
