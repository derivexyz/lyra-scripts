import { ethers } from 'ethers'
import { getSNXDebtSnapshots, getSNXDebtStates } from './getSNXDebtData'
import { SNXStakingConfig } from './config'
import { SNXAcceptedAddress } from './getSNXAcceptedAddresses'
import groupBy from 'lodash/groupBy'
import findIndex from 'lodash/findIndex'

const REGENESIS_TIMESTAMP = 1636652717

type DebtSnapshot = {
  id: string
  block: number
  timestamp: number
  account: string
  balanceOf: number
  collateral: number
  debtBalanceOf: number
}

type DebtSnapshots = DebtSnapshot[]

type DebtState = {
  id: string
  timestamp: number
  debtEntry: number
  totalIssuedSynths: number
  debtRatio: number
}

type SNXStakingEpochs = {
  [epoch: number]: {
    snapshots: {
      [address: string]: DebtSnapshot
    }
    state: DebtState
  }
}

export default async function getSNXDebtEpochs(
  acceptedAddresses: Record<string, SNXAcceptedAddress>,
  params: SNXStakingConfig
): Promise<SNXStakingEpochs> {
  const debtSnapshots = (await getSNXDebtSnapshots()).sort(
    (x: DebtSnapshot, y: DebtSnapshot) => x.timestamp - y.timestamp
  )
  const debtStates = (await getSNXDebtStates()).sort((x: DebtState, y: DebtState) => x.timestamp - y.timestamp)
  const snxDebtData: SNXStakingEpochs = {}

  // create a debt state to debt snapshot map keyed on account
  const debtStateToDebtSnapshotMap: any = {}
  debtSnapshots.forEach((debtSnapshot: any) => {
    const account = debtSnapshot.account
    let debtStateIndex =
      findIndex(debtStates, (ds: any) => ds.timestamp >= debtSnapshot.timestamp) || debtStates.length - 1
    debtStateIndex = debtStateIndex >= 0 ? debtStateIndex : debtStates.length - 1
    const debtState = debtStates[debtStateIndex]
    const debtStateId = debtState.id
    const debtSnapshotId = debtSnapshot.id
    debtStateToDebtSnapshotMap[debtStateId] = debtStateToDebtSnapshotMap[debtStateId] || {}
    debtStateToDebtSnapshotMap[debtStateId][account] = debtSnapshotId
  })

  // create a map of epochs to debtState
  let epochToDebtState: { [key: string]: any } = {}
  let epochIndex = 0
  let retroEpochTimestamp = params.retroStartDate
  let stakingEpochTimestamp = params.stakingStartDate

  // retro epochs
  while (retroEpochTimestamp < params.retroEndDate) {
    let debtStateIndex = findIndex(debtStates, (ds: any) => ds.timestamp > retroEpochTimestamp) - 1
    const debtState = debtStates[debtStateIndex - 1]
    epochToDebtState[epochIndex] = debtState
    epochIndex++
    retroEpochTimestamp += params.epochDuration
  }

  // staking epochs
  while (stakingEpochTimestamp < params.stakingEndDate) {
    let debtStateIndex = findIndex(debtStates, (ds: any) => ds.timestamp > stakingEpochTimestamp) - 1
    const debtState = debtStates[debtStateIndex - 1]
    epochToDebtState[epochIndex] = debtState
    epochIndex++
    stakingEpochTimestamp += params.epochDuration
  }

  for (let key in epochToDebtState) {
    const epoch = parseInt(key)
    if (!snxDebtData[epoch]) {
      snxDebtData[epoch] = { snapshots: {}, state: epochToDebtState[key] }
    }
  }

  // group debt snapshots by user
  const debtSnapshotsByUser = groupBy(debtSnapshots, 'account')

  // repair the debtSnapshot data between pre and post-regenesis
  for (let [addressRaw, snapshots] of Object.entries(debtSnapshotsByUser)) {
    const address = ethers.utils.getAddress(addressRaw)
    const isEligibleAddress =
      acceptedAddresses[address] &&
      (acceptedAddresses[address]?.tradedOnLyra ||
        acceptedAddresses[address]?.wasLyraLP ||
        acceptedAddresses[address]?.soldSUSD ||
        acceptedAddresses[address]?.wasUniswapLP)

    if (!isEligibleAddress) {
      continue
    }

    // if debt snapshots are pre regenesis just fill it in until you see the first post regenesis debt snapshot
    let debtSnapshots = snapshots as DebtSnapshots
    let filledDebtSnapshots: any = []
    const firstPostRegenesisIndex = findIndex(
      debtSnapshots,
      (debtSnapshot: any) => debtSnapshot.timestamp >= REGENESIS_TIMESTAMP
    )
    const firstPostRegenesis = firstPostRegenesisIndex ? debtSnapshots[firstPostRegenesisIndex] : null
    const firstPostRegenesisTimestamp = firstPostRegenesis ? firstPostRegenesis.timestamp : null
    let lastPreRegenesisDebtSnapshot: any = null
    debtSnapshots.forEach(debtSnapshot => {
      const debtSnapshotTimestamp = debtSnapshot.timestamp
      if (debtSnapshotTimestamp < REGENESIS_TIMESTAMP) {
        lastPreRegenesisDebtSnapshot = debtSnapshot
      }
    })

    debtSnapshots.forEach(debtSnapshot => {
      filledDebtSnapshots.push(debtSnapshot)

      const debtSnapshotId = debtSnapshot.id
      let debtSnapshotTimestamp = debtSnapshot.timestamp
      if (debtSnapshotId === lastPreRegenesisDebtSnapshot?.id) {
        if (firstPostRegenesisTimestamp) {
          while (debtSnapshotTimestamp < firstPostRegenesisTimestamp) {
            filledDebtSnapshots.push(debtSnapshot)
            debtSnapshotTimestamp += params.epochDuration
          }
        } else {
          while (debtSnapshotTimestamp < params.stakingEndDate) {
            filledDebtSnapshots.push(debtSnapshot)
            debtSnapshotTimestamp += params.epochDuration
          }
        }
      }
    })

    for (let key in epochToDebtState) {
      const epoch = parseInt(key)
      // for each epoch find the debt snapshot closest to that debt state
      if (!epochToDebtState[epoch]) {
        continue
      }
      const debtState = epochToDebtState[epoch]
      const debtStateTimestamp = debtState.timestamp

      // find the first debt snapshot index that has a timestamp smaller than the current debtState timestamp
      // that will be the debt snapshot closest to the debt state
      let newestToOldestDebtSnapshots = filledDebtSnapshots.sort((a: any, b: any) => b.timestamp - a.timestamp)
      let debtSnapshotIndex = findIndex(
        newestToOldestDebtSnapshots,
        (debtSnapshot: any) => debtSnapshot.timestamp <= debtStateTimestamp
      )

      // if no index is found continue
      if (debtSnapshotIndex < 0) {
        continue
      }

      debtSnapshotIndex = debtSnapshotIndex >= 0 ? debtSnapshotIndex : filledDebtSnapshots.length - 1
      const debtSnapshot = filledDebtSnapshots[debtSnapshotIndex]
      snxDebtData[epoch]['snapshots'][address] = debtSnapshot
    }
  }

  return snxDebtData
}
