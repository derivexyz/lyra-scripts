import { Deployments } from '../../utils'
import axios from 'axios'
import { lookupContractForDeployment } from '../../utils/parseFiles'

const BATCH_SIZE = 1000;
const frequency = 60 * 60 * 24;

export type AllDeltaSnapshots = {[marketName: string]: { [strikeId: string]: DeltaSnapshot[] }}

export type DeltaSnapshot = {
  timestamp: number
  delta: number
}

export async function getAllOptionCallDeltaSnapshots(deployment: Deployments): Promise<AllDeltaSnapshots> {
  const contractLookup: any = {};

  const results: {[id: string]: any } = {};

  let res;
  let latestBlocknum=0;
  let batch = 0;
  let lastSeen = '';
  let newLastSeen = '-';
  console.log(`Getting all option call delta snapshots... deployment ${deployment}`)
  while (lastSeen != newLastSeen) {
    lastSeen = newLastSeen;
    console.log(`= batch ${++batch}`);
    const query = `{
    optionPriceAndGreeksSnapshots(first:${BATCH_SIZE}, orderBy:blockNumber, orderDirection: asc, where: { blockNumber_gte: ${latestBlocknum}, period_gte: ${frequency} }) {
      delta
      id
      blockNumber
      timestamp
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

    res.data.data.optionPriceAndGreeksSnapshots.forEach((x: any) => {
      const [marketAddr, strikeId, callOrPut] = x.id.split('-');

      if (!contractLookup[marketAddr]) {
        const [contract, market] = lookupContractForDeployment(deployment, marketAddr);
        if (contract != 'OptionMarket') {
          throw Error("Got non option market address from subgraph query")
        }
        contractLookup[marketAddr] = market
      }

      // put delta is callDelta - 1, so we don't need to store both
      // if we wanted option price or other greeks we can't take this shortcut...
      if (callOrPut !== 'call') {
        return;
      }

      results[x.id] = {
        timestamp: x.timestamp,
        delta: parseFloat(x.delta) / 1e18,
        strikeId: parseInt(strikeId),
        market: contractLookup[marketAddr]
      }
      latestBlocknum = x.blockNumber;
    });

    newLastSeen = (res.data.data.optionPriceAndGreeksSnapshots[res.data.data.optionPriceAndGreeksSnapshots.length - 1].id);
  }

  const finalResult: AllDeltaSnapshots = {};
  for (const item of Object.values(results)) {
    if (!finalResult[item.market]) {
      finalResult[item.market] = {}
    }
    if (!finalResult[item.market][item.strikeId]) {
      finalResult[item.market][item.strikeId] = []
    }
    finalResult[item.market][item.strikeId].push({
      timestamp: item.timestamp,
      delta: item.delta
    })
  }
  return finalResult;
}



// getAllOptionCallDeltaSnapshots('mainnet-ovm-avalon').then(x => console.log(x['sETH']));