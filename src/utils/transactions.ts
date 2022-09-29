import { Contract } from 'ethers';
import {Deployments, getNetworkProvider} from './index';
import { loadLyraContractData } from './parseFiles';

const contracts: {
  [network: string]: {
    markets: {
      [ticker: string]: {
        [contractName: string]: Contract
      }
    },
    global: {
      [contractName: string]: Contract
    }
  }
} = {};

export async function getLyraContract(deployment: Deployments, contractName: string, market?: string): Promise<Contract> {
  if (!contracts[deployment]) {
    contracts[deployment] = { markets: {}, global: {} }
  }
  if (!!market && !contracts[deployment].markets[market]) {
    contracts[deployment].markets[market] = {}
  }

  if (!!market && !!contracts[deployment].markets[market][contractName]) {
    return contracts[deployment].markets[market][contractName]
  }

  if (!market && !!contracts[deployment].global[contractName]) {
    return contracts[deployment].global[contractName];
  }

  const data = loadLyraContractData(deployment, contractName, market);

  const contract = new Contract(
    data.target.address,
    data.source.abi,
    getNetworkProvider(deployment),
  );

  if (market) {
    contracts[deployment].markets[market][contractName] = contract;
  } else {
    contracts[deployment].global[contractName] = contract;
  }

  return contract;
}
