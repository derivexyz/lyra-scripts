import { Deployments } from '../../utils'
import axios from 'axios'
import { ethers } from 'ethers'

export type AllTrades = { [market: string]: TradeResult[] };

export type TradeResult = {
  trader: string;
  strikeId: number;
  positionId: number;
  spotPriceFee: number;
  vegaUtilFee: number;
  optionPriceFee: number;
  varianceFee: number;
  timestamp: number;
  isLong: boolean;
  isCall: boolean;
  size: number;
}

const BATCH_SIZE = 1000;

export async function getAllTrades(deployment: Deployments): Promise<AllTrades> {
  const trades: {[marketName: string]: { [tradeId: string]: TradeResult }} = {};

  let res;
  let latestBlocknum=0;
  let batch = 0;
  let addedNew = false;
  console.log(`Getting all trades... deployment ${deployment}`)
  do {
    addedNew = false;
    console.log(`= batch ${++batch}`);
    const query = `{
    trades(first: ${BATCH_SIZE}, orderBy: blockNumber, orderDirection: asc, where: { blockNumber_gte: ${latestBlocknum}}) {
      id
      trader
      market {
        name
      }
      position {
        positionId
        isLong
        option {
          isCall
        }
      }
      strike {
        strikeId
      }
      spotPriceFee
      vegaUtilFee
      optionPriceFee
      varianceFee
      timestamp
      blockNumber
      isOpen
      size
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

    res.data.data.trades.forEach((x: any) => {
      if (!trades[x.market.name]) {
        trades[x.market.name] = {};
      }

      if (!trades[x.market.name][x.id]) {
        trades[x.market.name][x.id] = {
          trader: ethers.utils.getAddress(x.trader),
          spotPriceFee: parseFloat(x.spotPriceFee) / 1e18,
          vegaUtilFee: parseFloat(x.vegaUtilFee) / 1e18,
          optionPriceFee: parseFloat(x.optionPriceFee) / 1e18,
          varianceFee: parseFloat(x.varianceFee) / 1e18,
          timestamp: x.timestamp,
          strikeId: parseInt(x.strike.strikeId),
          positionId: parseInt(x.position.positionId),
          isLong: x.position.isLong,
          isCall: x.position.option.isCall,
          size: (x.isOpen ? 1 : -1) * parseFloat(x.size) / 1e18
        }
        addedNew = true
      }

      if (x.blockNumber > latestBlocknum) {
        latestBlocknum = x.blockNumber;
      }
    });
  } while (addedNew);

  const finalResult: AllTrades = {};
  for (const market of Object.keys(trades)) {
    finalResult[market] = Object.values(trades[market]);
  }
  return finalResult;
}

// getAllTrades('mainnet-ovm-avalon').then(x => console.log(x['sETH']));