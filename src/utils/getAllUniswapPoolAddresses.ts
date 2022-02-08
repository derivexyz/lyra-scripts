import chalk from 'chalk'
import { ethers } from 'ethers'
import { getNetworkProvider } from '.'

import { abi as FACTORY_ABI } from '@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json'

const sUSD = '0x8c6f28f2F1A3C87F0f938b96d27520d9751ec8d9'

const allTokens: any = {
  Synthetix: '0x8700daec35af8ff88c16bdf0418774cb3d7599b4',
  'Dai stable coin': '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1',
  'Tether USD': '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58',
  'Wrapped Bitcoin': '0x68f180fcCe6836688e9084f035309E29Bf0A2095',
  '0xBitcoin': '0xe0BB0D3DE8c10976511e5030cA403dBf4c25165B',
  Chainlink: '0x350a791bfc2c21f9ed5d10980dad2e2638ffa7f6',
  'Ethereum Name Service': '0x65559aA14915a70190438eF90104769e5E890A00',
  // "Synthetix USD":         "0x8c6f28f2F1A3C87F0f938b96d27520d9751ec8d9",
  'USD Coin': '0x7F5c764cBc14f9669B88837ca1490cCa17c31607',
  'Synthetic Ether': '0xE405de8F52ba7559f9df3C368500B6E6ae6Cee49',
  'Synthetic Bitcoin': '0x298B9B95708152ff6968aafd889c6586e9169f1D',
  'Synthetic Chainlink': '0xc5Db22719A06418028A40A9B5E9A7c02959D0d08',
  Uniswap: '0x6fd9d7ad17242c41f7131d257212c54a0e816691',
  'LUSD Stablecoin': '0xc40f949f8a4e094d1b49a23ea9241d289b7b2819',
  'Rari Governance Token': '0xb548f63d4405466b36c0c0ac3318a22fdcec711a',
  'Rai Reflex Index': '0x7FB688CCf682d58f86D7e38e03f9D22e7705448B',
  'Rocket Pool ETH': '0x9bcef72be871e61ed4fbbc7630889bee758eb81d',
  Paper: '0x00F932F0FE257456b32dedA4758922E56A4F4b42',
  Sarcophagus: '0x7c6b91d9be155a6db01f749217d76ff02a7227f2',
  BitANT: '0x5029C236320b8f15eF0a657054B84d90bfBEDED3',
  wETH: '0x4200000000000000000000000000000000000006',
}

async function main() {
  const provider = getNetworkProvider('mainnet-ovm')

  const factory = new ethers.Contract('0x1F98431c8aD98523631AE4a59f267346ea31F984', FACTORY_ABI, provider)
  //
  // for (const token in allTokens) {
  //   for (const feeRate of [500, 3000, 10000]) {
  //     let x = await factory.getPool(sUSD, allTokens[token], feeRate);
  //     console.log(token, feeRate, x);
  //   }
  // }

  let x = await factory.getPool(allTokens.wETH, '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb', 10000)
  console.log(x)

  console.log(chalk.greenBright('\n=== Successfully seeded! ===\n'))
}

main().then(() => process.exit(0))
