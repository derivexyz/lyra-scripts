import { Contract, EventFilter } from "ethers";
import { Deployments, getEventCollectionName } from "./index";
import { getDB } from "./mongo";

const EVENT_BATCH_SIZE = 10;

export async function getEventsFromLyraContract(
  deployment: Deployments,
  contractName: string,
  eventName: string,
  market?: string
): Promise<any[]> {
  const db = await getDB();
  const c = db.collection(
    getEventCollectionName(deployment, contractName, eventName, market)
  );
  return await c.find().toArray();
}

export async function queryEvents(
  contract: Contract,
  filter: EventFilter,
  startBlock: number,
  endBlock: number
) {
  let eventBatch = [];
  let results: any[] = [];
  let current = startBlock;
  while (current < endBlock) {
    const toBlock = current + 9999;
    eventBatch.push(
      contract.queryFilter(
        filter,
        current,
        toBlock > endBlock ? endBlock : toBlock
      )
    );
    if (eventBatch.length >= EVENT_BATCH_SIZE) {
      let res = await Promise.all(eventBatch);
      results = results.concat(...res);
      eventBatch = [];
    }
    current += 10000;
  }
  if (eventBatch.length > 0) {
    let res = await Promise.all(eventBatch);
    results = results.concat(...res);
  }
  return results;
}
