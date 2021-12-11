import dotenv from "dotenv";
import {ethers} from "ethers";

export type Deployments = "kovan-ovm" | "mainnet-ovm" | "mainnet-ovm-old";
export const deployments: Deployments[] = ['kovan-ovm', 'mainnet-ovm', 'mainnet-ovm-old']

export async function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function loadArgsAndEnv(argv: string[]) {
  let result: {[key: string]: string} = {}
  for (let i=0; i < (argv.length - 1); i++) {
    if (argv[i].substr(0,2) === '--') {
      result[argv[i].substr(2)] = argv[i+1];
    }
  }

  if (result['env'] === undefined) {
    throw Error('Missing --env flag')
  }

  const parsed = dotenv.config({path: __dirname + "/../../.env." + result['env']});

  if (parsed === undefined || parsed.parsed === undefined) {
    throw Error(`Missing .env.${result['env']} file`);
  }

  return result;
}

export function getEventCollectionName(deployment: Deployments, contractName: string, eventName: string, market?: string) {
  // TODO: whoops extra `-`
  return `${deployment}-${market ? `-${market}` : ''}-${contractName}-${eventName}`;
}

export function getStatsCollectionName(deployment: Deployments) {
  return `${deployment}-stats`;
}

export function getOVMRpcUrl(deployment: Deployments) {
  const network = deployment.split("-")[0];

  if (network == "mainnet") {
    if (process.env.USE_INFURA === 'true') {
      return "https://optimism-mainnet.infura.io/v3/" + process.env.INFURA_KEY;
    } else {
      return "https://mainnet.optimism.io";
    }
  } else if (network == "kovan") {
    if (process.env.USE_INFURA === 'true') {
      return "https://optimism-kovan.infura.io/v3/" + process.env.INFURA_KEY;
    } else {
      return "https://kovan.optimism.io";
    }
  }
  throw Error(`Invalid network/deployment chosen: ${deployment}`);
}

export function getNetworkProvider(deployment: Deployments) {
  return new ethers.providers.JsonRpcProvider(getOVMRpcUrl(deployment));
}