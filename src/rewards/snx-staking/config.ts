export type SNXStakingConfig = {
  retroRewardAmount: number
  retroStartDate: number
  retroEndDate: number
  stakingRewardAmount: number
  stakingStartDate: number
  stakingEndDate: number
  stakingEndBlock: number
  epochDuration: number
}

const CONFIG: SNXStakingConfig = {
  retroStartDate: 1631491200,
  retroEndDate: 1634256000,
  retroRewardAmount: 1000000,
  stakingStartDate: 1635465600,
  stakingEndDate: 1639094400,
  stakingRewardAmount: 19000000,
  stakingEndBlock: 985147,
  epochDuration: 10800,
}

export default CONFIG
