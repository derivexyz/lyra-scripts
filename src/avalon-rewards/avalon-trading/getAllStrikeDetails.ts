import { Deployments } from '../../utils'
import axios from 'axios'
import { lookupContractForDeployment } from '../../utils/parseFiles'

const BATCH_SIZE = 1000;

export type AllStrikeDetails = {[marketName: string]: { [strikeId: string]: StrikeDetails }}

export type StrikeDetails = {
  strikeId: number
  expiryTimestamp: number
  strikePrice: number
}

export async function getAllStrikeDetails(deployment: Deployments): Promise<AllStrikeDetails> {
  const contractLookup: any = {};

  const results: {[id: string]: any } = {};

  let res;
  let latestStrikeId=0;
  let batch = 0;
  let lastSeen = '';
  let newLastSeen = '-';
  console.log(`Getting all strike details... deployment ${deployment}`)
  while (lastSeen != newLastSeen) {
    lastSeen = newLastSeen;
    console.log(`= batch ${++batch}`);
    const query = `{
    strikes(first:${BATCH_SIZE}, orderBy:strikeId, orderDirection: asc, where: { strikeId_gte: ${latestStrikeId} }) {
      id
      strikePrice
      board {
        expiryTimestamp
      }
    }
  } 
  `;
    // console.log('query', query);
    res = await axios({
      url: 'https://api.thegraph.com/subgraphs/name/lyra-finance/' + ((deployment == "mainnet-ovm-avalon") ? 'mainnet' : 'kovan'),
      method: 'post',
      data: {
        query: query,
      },
    });

    res.data.data.strikes.forEach((x: any) => {
      const [marketAddr, strikeId] = x.id.split('-');

      if (!contractLookup[marketAddr]) {
        const [contract, market] = lookupContractForDeployment(deployment, marketAddr);
        if (contract != 'OptionMarket') {
          throw Error("Got non option market address from subgraph query")
        }
        contractLookup[marketAddr] = market
      }

      results[x.id] = {
        expiryTimestamp: x.board.expiryTimestamp,
        strikePrice: parseFloat(x.strikePrice) / 1e18,
        strikeId: parseInt(strikeId),
        market: contractLookup[marketAddr]
      }
      latestStrikeId = parseInt(strikeId);
    });

    newLastSeen = (res.data.data.strikes[res.data.data.strikes.length - 1].id);
  }

  const finalResult: AllStrikeDetails = {};
  for (const item of Object.values(results)) {
    if (!finalResult[item.market]) {
      finalResult[item.market] = {}
    }
    finalResult[item.market][item.strikeId] = {
      strikeId: item.strikeId,
      expiryTimestamp: item.expiryTimestamp,
      strikePrice: item.strikePrice
    }
  }
  return finalResult;
}



// getAllStrikeDetails('mainnet-ovm-avalon').then(x => console.log(x['sETH']));