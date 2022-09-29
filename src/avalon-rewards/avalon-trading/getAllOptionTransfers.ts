import { Deployments } from '../../utils'
import axios from 'axios'
import { ethers } from 'ethers'
import { lookupContractForDeployment } from '../../utils/parseFiles'

const BATCH_SIZE = 1000;

export type AllTransfers = {[marketName: string]: TransferDetails[]}

export type TransferDetails = {
  oldOwner: string
  newOwner: string
  positionId: number
  timestamp: number
  strikeId: number
  isLong: boolean
  isCall: boolean
}

export async function getAllOptionTransfers(deployment: Deployments): Promise<AllTransfers> {
  const contractLookup: any = {};

  const results: {[id: string]: any } = {};

  let res;
  let latestTimestamp=0;
  let batch = 0;
  let lastSeen = '';
  let newLastSeen = '-';
  console.log(`Getting all option transfers... deployment ${deployment}`)
  while (lastSeen != newLastSeen) {
    lastSeen = newLastSeen;
    console.log(`= batch ${++batch}`);
    const query = `{
    optionTransfers(first:${BATCH_SIZE}, orderBy:timestamp, orderDirection: asc, where: { timestamp_gte: ${latestTimestamp} }) {
      id
      oldOwner
      newOwner
      timestamp
      position {
        isLong
        strike {
          strikeId
        }
        option {
          isCall
        }
      }
    }
  } 
  `;
    res = await axios({
      url: 'https://api.thegraph.com/subgraphs/name/lyra-finance/' + (deployment == "mainnet-ovm-avalon" ? 'mainnet' : 'kovan'),
      method: 'post',
      data: {
        query: query,
      },
    });

    res.data.data.optionTransfers.forEach((x: any) => {
      const [marketAddr, positionId, ] = x.id.split('-');

      if (!contractLookup[marketAddr]) {
        const [contract, market] = lookupContractForDeployment(deployment, marketAddr);
        if (contract != 'OptionMarket') {
          throw Error("Got non option market address from subgraph query")
        }
        contractLookup[marketAddr] = market
      }

      results[x.id] = {
        oldOwner: x.oldOwner,
        newOwner: x.newOwner,
        positionId: parseInt(positionId),
        market: contractLookup[marketAddr],
        timestamp: parseInt(x.timestamp),
        isLong: x.position.isLong,
        strikeId: parseInt(x.position.strike.strikeId),
        isCall: x.position.option.isCall,
      }
      latestTimestamp = parseInt(x.timestamp);
    });

    newLastSeen = (res.data.data.optionTransfers[res.data.data.optionTransfers.length - 1].id);
  }

  const finalResult: AllTransfers = {};
  for (const item of Object.values(results)) {
    if (!finalResult[item.market]) {
      finalResult[item.market] = []
    }
    finalResult[item.market].push({
      positionId: item.positionId,
      oldOwner: ethers.utils.getAddress(item.oldOwner),
      newOwner: ethers.utils.getAddress(item.newOwner),
      timestamp: item.timestamp,
      isLong: item.isLong,
      isCall: item.isCall,
      strikeId: item.strikeId
    })
  }
  return finalResult;
}



// getAllOptionTransfers('mainnet-ovm-avalon').then(x => console.log(x['sETH']));