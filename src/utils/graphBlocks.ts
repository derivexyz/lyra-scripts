import axios from "axios";
import { Event } from "ethers";


export type block = {
  id: string,
  number: number,
  timestamp: number,
}

export async function getTimeStampsForSegment(segment: number[]): Promise<{
  [key: number]: number;
}> {
  // const graphUrl = process.env.GRAPH_URL || 'https://api.thegraph.com/subgraphs/name/lyra-finance/optimism-mainnet-blocks';
  const graphUrl = process.env.GRAPH_URL || 'https://api.thegraph.com/subgraphs/name/danielmkm/optimism-blocks';
  // TODO: check latest sync'd block
  // console.log('graphUrl', graphUrl);
 
  const query = `{
    blocks(where:{number_in:[${segment.toString()}]}) {
      id
      number
      timestamp
    }
  }`;

  console.log("Fetching timestamps for blocks");

  const queryResult = await axios.post(graphUrl, {
    query: query
  });

  const blocks = queryResult.data.data.blocks;
  const res: { [key: number]: number } = {};
  for (const block of blocks) {
    res[block.number] = parseInt(block.timestamp);
  }

  return res;
}

export async function getAllTimeStampsForEvents(allEvents: Event[]) : Promise<{
  [key: number] : number;
}> {
  let blockNumbers: number[] = [];

  for(const each of allEvents) {
    blockNumbers.push(each.blockNumber);
  }

  // console.log('block numbers befor eliminating duplicates', blockNumbers);
  //remove all duplicates
  blockNumbers = [...new Set(blockNumbers)];

  // console.log('block numbers', blockNumbers);

  const eventSegments: number[][] = [];
  const chunkSize = 100;
  for (let i = 0; i < blockNumbers.length; i += chunkSize) {
      const chunk = blockNumbers.slice(i, i + chunkSize);
      eventSegments.push(chunk);
  }

  // console.log('event segements', eventSegments);
  
  const res: {[key: number] : number} = {};
  let count = 1;
  for(const segment of eventSegments) {
    console.log("Getting block timestamps. Segment:", count++, "of", eventSegments.length);
    const queryRes = await getTimeStampsForSegment(segment);
    for(const blockNumber in queryRes) {
      res[blockNumber] = queryRes[blockNumber];
    }
  }

  return res;
}