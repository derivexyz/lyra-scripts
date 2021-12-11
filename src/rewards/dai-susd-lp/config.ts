export type DaiSUSDLPConfig = {
  leap: string
  startDate: number
  endDate: number
  epochDuration: number
  minTick: number
  maxTick: number
  totalRewards: number
}

export const MAX_BLOCK = 333534

const CONFIG: DaiSUSDLPConfig[] = [
  {
    leap: 'leap3',
    startDate: 1631491200,
    endDate: 1632700800,
    epochDuration: 10800,
    minTick: -100,
    maxTick: 2620,
    totalRewards: 375000,
  },
  {
    leap: 'leap4',
    startDate: 1632700800,
    endDate: 1633910400,
    epochDuration: 10800,
    minTick: -2230,
    maxTick: 1820,
    totalRewards: 300000,
  },
  {
    leap: 'leap4.2.0',
    startDate: 1633910400,
    endDate: 1634515200,
    epochDuration: 10800,
    minTick: -1630,
    maxTick: 1400,
    totalRewards: 112500,
  },
  {
    leap: 'leap4.2.1',
    startDate: 1634515200,
    endDate: 1635120000,
    epochDuration: 10800,
    minTick: -1630,
    maxTick: 1400,
    totalRewards: 93750,
  },
  {
    leap: 'leap4.2.2',
    startDate: 1635120000,
    endDate: 1635724800,
    epochDuration: 10800,
    minTick: -1630,
    maxTick: 1400,
    totalRewards: 75000,
  },
  {
    leap: 'leap4.2.3',
    startDate: 1635724800,
    endDate: 1636329600,
    epochDuration: 10800,
    minTick: -510,
    maxTick: 490,
    totalRewards: 56250,
  },
  {
    leap: 'leap4.2.4',
    startDate: 1636329600,
    endDate: 1636416000,
    epochDuration: 10800,
    minTick: -510,
    maxTick: 490,
    totalRewards: 5357.1428571429,
  },
  {
    leap: 'leap4.2.5',
    startDate: 1636416000,
    endDate: 1636934400,
    epochDuration: 10800,
    minTick: -50,
    maxTick: 50,
    totalRewards: 32142.8571428571,
  },
  {
    leap: 'leap4.2.6',
    startDate: 1636934400,
    endDate: 1637539200,
    epochDuration: 10800,
    minTick: -50,
    maxTick: 50,
    totalRewards: 18750,
  },
]

export default CONFIG
