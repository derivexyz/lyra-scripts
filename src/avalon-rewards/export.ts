import { Deployments, getNetworkProvider, loadArgsAndEnv } from '../utils'
import initializeDB, { getDB } from '../utils/mongo'
import { Collections } from '../constants/collections'
import { AccountRewardEpoch } from '../utils/avalonRewardEpoch'
import objectsToCsv from 'objects-to-csv'


export default async function exportAvalonRewards() {
  const db = await getDB();
  const accountEpochCollection = db.collection(Collections.AvalonAccountRewardsEpoch)

  for (const deployment of ['mainnet-ovm-avalon']) {

    const perEpoch: {[key: string]: any[]} = {};
    const p = await getNetworkProvider(deployment as Deployments);
    const latestBlock = await p.getBlock('latest');
    const allDocs: AccountRewardEpoch[] = await accountEpochCollection.find({deployment}).toArray();

    for (const doc of allDocs) {
      const id = `${doc.deployment}-${doc.startTimestamp}`;

      if (!perEpoch[id]) {
        // skip all unfinished epochs
        if (doc.endTimestamp > latestBlock.timestamp) {
          console.log(doc);
          continue;
        }
        perEpoch[id] = []
      }

      const res: any = {
        account: doc.account,
        startTimestamp: doc.startTimestamp,
        endTimestamp: doc.endTimestamp,
      }

      for (const market of Object.keys(doc.MMVRewards)) {
        res[`MMV-${market}-OP`] = doc.MMVRewards[market].op || 0
        res[`MMV-${market}-LYRA`] = doc.MMVRewards[market].lyra || 0
      }

      res['STAKING-OP'] = doc.inflationaryRewards.op || 0
      res['STAKING-LYRA'] = doc.inflationaryRewards.lyra || 0

      console.log(doc.tradingRewards);
      res['TRADING-OP'] = doc.tradingRewards.opRebate || 0
      res['TRADING-LYRA'] = doc.tradingRewards.lyraRebate || 0

      perEpoch[id].push(res)
    }
    console.log(perEpoch);

    for (const id of Object.keys(perEpoch)) {
      const outFile = `./out/complete-rewards-${id}.csv`;
      const csv1 = new objectsToCsv(perEpoch[id]);
      await csv1.toDisk(outFile, { allColumns: true });
    }
  }
}

loadArgsAndEnv(process.argv);
initializeDB()
  .then(async () => await exportAvalonRewards())
  .then(() => {
    console.log("Syncing complete!")
    process.exit(0)
  })
  .catch((e: Error) => {
    console.log(e.stack);
    process.exit(1)
  })
