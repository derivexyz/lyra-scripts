import getSNXDebtEpochs from './getSNXDebtEpochs'
import { SNXStakingConfig } from './config'
import getSNXAcceptedAddresses from './getSNXAcceptedAddresses'
import { ethers } from 'ethers'

type SNXUserStats = {
  address: string
  conditions: {
    tradedOnLyra: boolean
    wasLyraLP: boolean
    soldSUSD: boolean
    wasUniswapLP: boolean
  }
  totalDebt: number
  totalDebtShare: number
  activeFrom: number | null
  mostRecentEpoch: number
  stakingRewards: number
  retroRewards: number
}

export default async function getSNXStakingRewards(params: SNXStakingConfig): Promise<Record<string, SNXUserStats>> {
  const acceptedAddresses = await getSNXAcceptedAddresses()

  console.log('- Calculating epochs')
  const epochs = await getSNXDebtEpochs(acceptedAddresses, params)
  console.log('--', Object.keys(epochs).length, 'epochs')

  // calculate the rewards each staker gets in the retro period
  const retroRewardPerEpoch =
    params.retroRewardAmount / ((params.retroEndDate - params.retroStartDate) / params.epochDuration)

  // calculate the rewards each staker gets in the staking period
  const stakingRewardPerEpoch =
    params.stakingRewardAmount / ((params.stakingEndDate - params.stakingStartDate) / params.epochDuration)

  const lastRetroEpochIndex = (params.retroEndDate - params.retroStartDate) / params.epochDuration - 1

  const debtTotals: Record<string, number> = {}
  const userDebtTotals: Record<string, Record<string, number>> = {}

  let previousDebtState = null
  let currentDebtState = null
  for (let epoch in epochs) {
    const debtSnapshots = epochs[epoch].snapshots
    currentDebtState = epochs[epoch].state
    if (!previousDebtState) {
      previousDebtState = currentDebtState
    }
    for (const addressRaw in debtSnapshots) {
      const address = ethers.utils.getAddress(addressRaw)
      const debtSnapshot = debtSnapshots[address]
      const userDebtTotal = (debtSnapshot.debtBalanceOf * previousDebtState.debtRatio) / currentDebtState.debtRatio
      userDebtTotals[address] = userDebtTotals[address] || {}
      userDebtTotals[address][epoch] = userDebtTotal
      if (debtTotals[epoch]) {
        debtTotals[epoch] += userDebtTotal
      } else {
        debtTotals[epoch] = userDebtTotal
      }
    }
    previousDebtState = currentDebtState
  }

  const statsPerUser: Record<string, SNXUserStats> = {}

  for (let address in userDebtTotals) {
    const userDebtTotalsAllEpochs = userDebtTotals[address]
    for (let epoch in userDebtTotalsAllEpochs) {
      const userDebtCurrentEpoch = userDebtTotalsAllEpochs[epoch]
      const totalDebt = debtTotals[epoch]
      const totalDebtShare = userDebtCurrentEpoch / totalDebt

      const isRetro = parseInt(epoch) <= lastRetroEpochIndex

      if (!statsPerUser[address]) {
        const user = acceptedAddresses[address]
        statsPerUser[address] = {
          address: user.address,
          conditions: {
            tradedOnLyra: !!user?.tradedOnLyra,
            wasLyraLP: !!user?.wasLyraLP,
            soldSUSD: !!user?.soldSUSD,
            wasUniswapLP: !!user?.wasUniswapLP,
          },
          activeFrom: user?.activeFrom ?? null,
          mostRecentEpoch: parseInt(epoch),
          stakingRewards: 0,
          retroRewards: 0,
          totalDebt: 0,
          totalDebtShare: 0,
        }
      }

      const rewards = (isRetro ? retroRewardPerEpoch : stakingRewardPerEpoch) * totalDebtShare
      if (isRetro) {
        statsPerUser[address].retroRewards += rewards
      } else {
        statsPerUser[address].stakingRewards += rewards
      }
      statsPerUser[address].totalDebt = userDebtCurrentEpoch
      statsPerUser[address].totalDebtShare = totalDebtShare
      statsPerUser[address].mostRecentEpoch = parseInt(epoch)
    }
  }

  const totalRetroRewards = Object.values(statsPerUser).reduce((sum, stats) => stats.retroRewards + sum, 0)
  const totalStakingRewards = Object.values(statsPerUser).reduce((sum, stats) => stats.stakingRewards + sum, 0)

  console.log('- Retro')
  console.log('--', (params.retroEndDate - params.retroStartDate) / params.epochDuration, 'epochs')
  console.log('--', retroRewardPerEpoch, 'lyra per epoch')
  console.log('--', totalRetroRewards, '/', params.retroRewardAmount, 'rewards distributed')

  console.log('- Staking')
  console.log('--', (params.stakingEndDate - params.stakingStartDate) / params.epochDuration, 'epochs')
  console.log('--', stakingRewardPerEpoch, 'lyra per epoch')
  console.log('--', totalStakingRewards, '/', params.stakingRewardAmount, 'rewards distributed')

  return statsPerUser
}
