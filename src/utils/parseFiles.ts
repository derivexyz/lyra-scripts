/* tslint:disable */
/* eslint-disable */
import path from 'path';
import {Deployments} from "./index";

function getLyraFilePath(network: string) {
  if (network.split("-")[0] == 'kovan') {
    return path.join(__dirname, '../../deployments/', network, '/lyra.realPricing.json');
  }
  return path.join(__dirname, '../../deployments/', network, '/lyra.json');
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

export function lookupContractForDeployment(
  network: Deployments, address: string
): [string, string | undefined] { // [contract name, market]
  const filePath = getLyraFilePath(network);
  const data = require(filePath);
  try {
    for (const key of Object.keys(data.targets)) {
      if (key === "markets") {
        for (const market of Object.keys(data.targets.markets)) {
          for (const contract of Object.keys(data.targets.markets[market])) {
            if (data.targets.markets[market][contract].address.toLowerCase() == address.toLowerCase()) {
              return [contract, market];
            }
          }
        }
      } else {
        if (data.targets[key].address.toLowerCase() == address.toLowerCase()) {
          return [key, undefined];
        }
      }
    }
    throw Error("contract not found");
  } catch (e) {
    console.log({ filePath, name });
    throw e;
  }
}

/* tslint:enable */
/* eslint-enable */
