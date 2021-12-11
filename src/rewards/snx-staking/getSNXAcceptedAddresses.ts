import { ethers } from 'ethers'
import { getEventsFromLyraContract } from '../../utils/events'
import getSNXUniswapAcceptedAddresses from './getSNXUniswapAcceptedAddresses'
import console from 'console'
import getSNXPreRegenesisUniswapAddresses from './getSNXPreRegenesisUniswapAddresses'

export type SNXAcceptedAddress = {
  address: string
  tradedOnLyra: boolean
  wasLyraLP: boolean
  wasUniswapLP: boolean
  soldSUSD: boolean
  activeFrom: number
}

async function getAllLyraTraders() {
  const allCertTransfers = [
    ...(await getEventsFromLyraContract('mainnet-ovm-old', 'OptionMarket', 'PositionOpened', 'sETH')),
    ...(await getEventsFromLyraContract('mainnet-ovm', 'OptionMarket', 'PositionOpened', 'sETH')),
    ...(await getEventsFromLyraContract('mainnet-ovm', 'OptionMarket', 'PositionOpened', 'sBTC')),
    ...(await getEventsFromLyraContract('mainnet-ovm', 'OptionMarket', 'PositionOpened', 'sLINK')),
  ]

  const res: any = {}

  for (const transfer of allCertTransfers) {
    if (!res[transfer.args.trader]) {
      res[transfer.args.trader] = transfer.timestamp
    }

    if (res[transfer.args.trader] > transfer.timestamp) {
      res[transfer.args.trader] = transfer.timestamp
    }
  }

  return res
}

async function getAllLyraLPs() {
  const allCertTransfers = [
    ...(await getEventsFromLyraContract('mainnet-ovm-old', 'LiquidityCertificate', 'Transfer', 'sETH')),
    ...(await getEventsFromLyraContract('mainnet-ovm', 'LiquidityCertificate', 'Transfer', 'sETH')),
    ...(await getEventsFromLyraContract('mainnet-ovm', 'LiquidityCertificate', 'Transfer', 'sLINK')),
    ...(await getEventsFromLyraContract('mainnet-ovm', 'LiquidityCertificate', 'Transfer', 'sBTC')),
  ]

  const res: any = {}

  for (const transfer of allCertTransfers) {
    if (!res[transfer.args.from]) {
      res[transfer.args.from] = transfer.timestamp
    }
    if (!res[transfer.args.to]) {
      res[transfer.args.to] = transfer.timestamp
    }

    if (res[transfer.args.from] > transfer.timestamp) {
      res[transfer.args.from] = transfer.timestamp
    }

    if (res[transfer.args.to] > transfer.timestamp) {
      res[transfer.args.to] = transfer.timestamp
    }
  }

  return res
}

export default async function getSNXAcceptedAddresses(): Promise<Record<string, SNXAcceptedAddress>> {
  console.log('- Collecting addresses')

  // collect lyra traders + LPs pre/post regenesis
  const lyraTraders = await getAllLyraTraders()
  console.log('--', Object.keys(lyraTraders).length, 'lyra traders')
  const lyraLPs = await getAllLyraLPs()
  console.log('--', Object.keys(lyraLPs).length, 'lyra LPs')

  // split up collection for susd sellers and uniswap LPs pre/post regenesis
  const { sUSDSellers: preRegenesisSUSDSellers, uniswapLPs: preRegenesisUniswapLPs } =
    await getSNXPreRegenesisUniswapAddresses()
  console.log('--', Object.keys(preRegenesisSUSDSellers).length, 'pre-regenesis sUSD sellers')
  console.log('--', Object.keys(preRegenesisUniswapLPs).length, 'pre-regenesis uniswap LPs')
  const { sUSDSellers, uniswapLPs } = await getSNXUniswapAcceptedAddresses()
  console.log('--', Object.keys(sUSDSellers).length, 'post-regenesis sUSD sellers')
  console.log('--', Object.keys(uniswapLPs).length, 'post-regenesis uniswap LPs')

  const whitelist: Record<string, SNXAcceptedAddress> = {}

  for (const addressRaw in lyraTraders) {
    const address = ethers.utils.getAddress(addressRaw)
    if (!whitelist[address]) {
      whitelist[address] = {
        address,
        tradedOnLyra: true,
        wasLyraLP: false,
        wasUniswapLP: false,
        soldSUSD: false,
        activeFrom: lyraTraders[addressRaw],
      }
    }
  }

  for (const addressRaw in lyraLPs) {
    const address = ethers.utils.getAddress(addressRaw)
    if (!whitelist[address]) {
      whitelist[address] = {
        address,
        tradedOnLyra: false,
        wasLyraLP: true,
        wasUniswapLP: false,
        soldSUSD: false,
        activeFrom: lyraLPs[addressRaw],
      }
    } else {
      whitelist[address].wasLyraLP = true
      if (whitelist[address].activeFrom > lyraLPs[addressRaw]) {
        whitelist[address].activeFrom = lyraLPs[addressRaw]
      }
    }
  }

  for (const addressRaw in uniswapLPs) {
    const address = ethers.utils.getAddress(addressRaw)
    if (!whitelist[address]) {
      whitelist[address] = {
        address,
        tradedOnLyra: false,
        wasLyraLP: false,
        wasUniswapLP: true, // on any market
        soldSUSD: false,
        activeFrom: uniswapLPs[addressRaw],
      }
    } else {
      whitelist[address].wasUniswapLP = true
      if (whitelist[address].activeFrom > uniswapLPs[addressRaw]) {
        whitelist[address].activeFrom = uniswapLPs[addressRaw]
      }
    }
  }

  for (const addressRaw in sUSDSellers) {
    const address = ethers.utils.getAddress(addressRaw)
    if (!whitelist[address]) {
      whitelist[address] = {
        address,
        tradedOnLyra: false,
        wasLyraLP: false,
        wasUniswapLP: false,
        soldSUSD: true, // on any market
        activeFrom: sUSDSellers[addressRaw],
      }
    } else {
      whitelist[address].soldSUSD = true
      if (whitelist[address].activeFrom > sUSDSellers[addressRaw]) {
        whitelist[address].activeFrom = sUSDSellers[addressRaw]
      }
    }
  }

  for (const addressRaw in preRegenesisUniswapLPs) {
    const address = ethers.utils.getAddress(addressRaw)
    if (!whitelist[address]) {
      whitelist[address] = {
        address,
        tradedOnLyra: false,
        wasLyraLP: false,
        wasUniswapLP: true, // on any market
        soldSUSD: false,
        activeFrom: preRegenesisUniswapLPs[addressRaw],
      }
    } else {
      whitelist[address].wasUniswapLP = true
      if (whitelist[address].activeFrom > preRegenesisUniswapLPs[addressRaw]) {
        whitelist[address].activeFrom = preRegenesisUniswapLPs[addressRaw]
      }
    }
  }

  for (const addressRaw in preRegenesisSUSDSellers) {
    const address = ethers.utils.getAddress(addressRaw)
    if (!whitelist[address]) {
      whitelist[address] = {
        address,
        tradedOnLyra: false,
        wasLyraLP: false,
        wasUniswapLP: false, // on any market
        soldSUSD: true,
        activeFrom: preRegenesisSUSDSellers[addressRaw],
      }
    } else {
      whitelist[address].soldSUSD = true
      if (whitelist[address].activeFrom > preRegenesisSUSDSellers[addressRaw]) {
        whitelist[address].activeFrom = preRegenesisSUSDSellers[addressRaw]
      }
    }
  }

  console.log('--', Object.keys(whitelist).length, 'unique addresses')

  return whitelist
}
