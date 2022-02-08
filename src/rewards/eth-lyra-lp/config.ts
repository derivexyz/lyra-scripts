export type EthLyraLPConfig = {
  leap: string
  startTimestamp: number
  endTimestamp: number
  epochDuration: number
  totalRewards: number
  minTick: number
  maxTick: number
}

const CONFIG: EthLyraLPConfig[] = [
  {
    leap: 'leap12',
    startTimestamp: 1639440000,
    endTimestamp: 1642118400,
    epochDuration: 10800,
    totalRewards: 1000000,
    minTick: -887200,
    maxTick: 887200,
  },
  {
    leap: 'leap13.1',
    startTimestamp: 1642118400,
    endTimestamp: 1644206400,
    epochDuration: 10800,
    totalRewards: 753246.753247,
    minTick: -887200,
    maxTick: 887200,
  },
  {
    leap: 'leap13.2',
    startTimestamp: 1644206400,
    endTimestamp: 1646625600,
    epochDuration: 10800,
    totalRewards: 872727.272727,
    minTick: -887200,
    maxTick: 887200,
  },
  {
    leap: 'leap13.3',
    startTimestamp: 1646625600,
    endTimestamp: 1649048400,
    epochDuration: 10800,
    totalRewards: 874025.974026,
    minTick: -887200,
    maxTick: 887200,
  },
]

export default CONFIG
