/* tslint:disable */
/* eslint-disable */
import path from 'path';
import {Deployments} from "./index";

function getLyraFilePath(network: string) {
  if (network == 'kovan-ovm' || network == 'kovan-ovm-testnet-comp') {
    return path.join(__dirname, '../../deployments/', network, '/lyra.realPricing.json');
  }
  return path.join(__dirname, '../../deployments/', network, '/lyra.json');
}

export function loadContractNamesForDeployment(network: Deployments) {
  const filePath = getLyraFilePath(network);
  const data = require(filePath);

  const result: { market?: string, contractName: string }[] = []

  for (const target in data.targets) {
    if (target === "markets") {
      for (const market in data.targets.markets) {
        for (const mTarget in data.targets.markets[market]) {
          result.push({market, contractName: mTarget})
        }
      }
    } else {
      result.push({contractName: target});
    }
  }
  return result;
}


export function loadLyraContractData(network: Deployments, name: string, market?: string) {
  const filePath = getLyraFilePath(network);
  const data = require(filePath);
  try {
    if (market) {
      return {
        target: data.targets.markets[market][name],
        source: data.sources[data.targets.markets[market][name].source],
      };
    }
    return {
      target: data.targets[name],
      source: data.sources[data.targets[name].source],
    };
  } catch (e) {
    console.log({ filePath, name, market });
    throw e;
  }
}

export function loadLyraContractDeploymentBlock(network: Deployments, name: string, market?: string) {
  const filePath = getLyraFilePath(network);
  const data = require(filePath);
  try {
    if (market) {
      return data.targets.markets[market][name].blockNumber;
    }
    return data.targets[name].blockNumber;
  } catch (e) {
    console.log({ filePath, name, market });
    throw e;
  }
}

/* tslint:enable */
/* eslint-enable */
