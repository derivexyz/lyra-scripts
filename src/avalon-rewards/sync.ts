import { AvalonLyraLPData, getMMVRewards } from './mmv/getMMVRewards';
import { getStkLyraData } from './stkLyra/getStkLyraData';
import {
  AccountRewardEpoch,
  getEmptyAccountEpoch,
  GlobalRewardEpoch,
  insertOrUpdateAccountRewardEpoch,
  insertOrUpdateGlobalRewardEpoch,
} from '../utils/avalonRewardEpoch'
import { getStakingRewards } from './stkLyra/getStakingRewards';
import { Deployments, getNetworkProvider, loadArgsAndEnv } from '../utils'
import initializeDB, { getDB } from '../utils/mongo'
import { getTradingRewards, TradingRewards, UserRebates } from './avalon-trading/getTradingRewards'
import { AVALON_CONFIG, CooldownEvent, LPEvent } from './config'
import { getLyraContract } from '../utils/transactions'
import { ethers, Event } from 'ethers'
import { getAllTimeStampsForEvents } from '../utils/graphBlocks'
import { Collections } from '../constants/collections'
import { getAllTrades } from './avalon-trading/getAllTrades'
import { getAllOptionCallDeltaSnapshots } from './avalon-trading/getAllOptionDeltaSnapshots'
import { getAllStrikeDetails } from './avalon-trading/getAllStrikeDetails'
import { getAllOptionTransfers } from './avalon-trading/getAllOptionTransfers'
import { User } from '@sentry/node'


const DROP_DB = false;

export default async function syncAvalonRewards() {

  if (DROP_DB) {
    const db = await getDB();
    await db.dropCollection(Collections.AvalonAccountRewardsEpoch);
    await db.dropCollection(Collections.AvalonGlobalRewardsEpoch);
  }

  let accountEpochs: {[id: string]: AccountRewardEpoch} = {};

  for (let deploymentStr of Object.keys(AVALON_CONFIG)) {

    const whitespace = 40 - deploymentStr.length - 4;
    console.log("=".repeat(40))
    console.log(`==${" ".repeat(whitespace > 0 ? Math.floor(whitespace / 2) : 0)}${deploymentStr}${" ".repeat(whitespace > 0 ? Math.ceil(whitespace / 2) : 0)}==`)
    console.log("=".repeat(40))

    /////
    // Pre-cache all events needed for the deployment
    console.log("\npre-caching events for all epochs...")

    const deployment: Deployments = deploymentStr as any;

    const maxBlock = await (await getNetworkProvider(deployment).getBlock('latest'))

    const lyraSMProxy = await getLyraContract(deployment, 'LyraSafetyModuleProxy')
    const lyraSM = (await getLyraContract(deployment, 'LyraSafetyModule')).attach(lyraSMProxy.address)

    const cdEvents: Event[] = await lyraSM.queryFilter(lyraSM.filters.CooldownUpdated(null,null,null), 0, maxBlock.number);
    console.log("cooldown events", cdEvents.length);
    cdEvents.sort((a, b) => (a.blockNumber > b.blockNumber) ? 1 : -1)

    const allEvents = [...cdEvents];

    const allMarketLPEvents: {[market: string]: Event[]} = {};
    for (let epochConfig of AVALON_CONFIG[deployment]) {
      for (let market of Object.keys(epochConfig.MMVConfig)) {
        if (!allMarketLPEvents[market]) {
          // TODO: change this when migrating to goerli for testnet
          const LiquidityToken = await getLyraContract(deployment, deployment.split("-")[0] == "kovan" ? 'LiquidityTokens' : "LiquidityToken", market)
          allMarketLPEvents[market] = await LiquidityToken.queryFilter(
            LiquidityToken.filters.Transfer(null, null, null), 0, maxBlock.number
          );
          console.log(`${market} Liquidity Token transfers: ${allMarketLPEvents[market].length}`)
          allEvents.push(...allMarketLPEvents[market]);
        }
      }
    }

    const allBlocks = await getAllTimeStampsForEvents(allEvents);

    const lpEvents: {[market: string]: LPEvent[]} = {};
    Object.keys(allMarketLPEvents).forEach(x => {
      lpEvents[x] = allMarketLPEvents[x].map(y => {
        return {
          from: y.args?.from,
          to: y.args?.to,
          value: y.args?.value,
          timestamp: allBlocks[y.blockNumber],
          block: y.blockNumber,
        }
      })
    })

    const cooldownEvents: CooldownEvent[] = cdEvents.map(x => {
      return {
        user: x.args?.user,
        cooldownTimestamp: parseInt(x.args?.cooldownTimestamp.toString()),
        balance: parseFloat(ethers.utils.formatEther(x.args?.balance)),
        timestamp: allBlocks[x.blockNumber],
        block: x.blockNumber
      }
    })

    const allTrades = await getAllTrades(deployment);
    const allDeltaSnapshots = await getAllOptionCallDeltaSnapshots(deployment);
    const allStrikeDetails = await getAllStrikeDetails(deployment);
    const allTransfers = await getAllOptionTransfers(deployment);

    console.log("Done.")

  //   console.log(JSON.stringify({
  //     lpEvents,
  //     allBlocks,
  //     cooldownEvents,
  //     allTrades,
  //     allDeltaSnapshots,
  //     allStrikeDetails,
  //     allTransfers,
  //   }))
  //
  //   const {
  //     lpEvents,
  //     allBlocks,
  //     cooldownEvents,
  //     allTrades,
  //     allDeltaSnapshots,
  //     allStrikeDetails,
  //     allTransfers,
  //   } = require("../testData.json");
  //
  //   console.log(allBlocks)

    /////
    // Figure out the rewards

    for (let epochConfig of AVALON_CONFIG[deployment]) {
      console.log('\n\x1b[31m%s\x1b[0m', `-`.repeat(50));
      console.log(
        '\x1b[31m%s\x1b[0m',
        'from: ' + new Date(epochConfig.startTimestamp * 1000).toDateString()
        + ' | to: ' + new Date(epochConfig.endTimestamp * 1000).toDateString(),
      )
      console.log('\x1b[31m%s\x1b[0m', `-`.repeat(50));

      const rewardEpoch: GlobalRewardEpoch = {
        deployment,
        startTimestamp: epochConfig.startTimestamp,
        endTimestamp: epochConfig.endTimestamp,
        lastUpdated: maxBlock.timestamp,
        totalStkLyraDays: 0,
        scaledStkLyraDays: {},
        totalLpTokenDays: {},
        totalBoostedLpTokenDays: {},
        rewardedStakingRewards: {
          LYRA: 0,
          OP: 0
        },
        rewardedMMVRewards: {
          LYRA: {},
          OP: {}
        },
        tradingRewardResults:{
          totalLyraRebate: 0,
          totalOpRebate: 0,
          lyraScaleFactor: 1,
          opScaleFactor: 1,
          totalUnscaledRebateDollars: 0,
          totalTradingUnscaledRebateDollars: 0,
          totalCollatUnscaledRebateDollars: 0,
          totalFees: 0,
          tradingRebates: {
            totalLyraRebate: 0,
            totalOpRebate: 0,
          },
          shortCollat: {
            totalShortCallSeconds: 0,
            totalShortPutSeconds: 0,
            totalLyraRebate: 0,
            totalOpRebate: 0,
          },
        },
        tradingRewardConfig: epochConfig.tradingConfig,
        MMVConfig: epochConfig.MMVConfig,
        stakingRewardConfig: epochConfig.stakingConfig
      };

      // Get stkLyra user data
      console.log("Syncing stkLyraData...")
      console.log(`-`.repeat(20));
      const stkLyraData = await getStkLyraData(epochConfig.startTimestamp, epochConfig.endTimestamp, epochConfig.id, maxBlock, cooldownEvents, epochConfig.globalIgnoreList);
      console.log(stkLyraData.perUser['0x9Ba8c70a8Fd922e97a4e78C46583742C7D41796C']);

      // sync Inflationary Rewards
      console.log("Calculating inflationary rewards...")
      console.log(`-`.repeat(20));
      const inflationRewards = await getStakingRewards(epochConfig.startTimestamp, epochConfig.endTimestamp, epochConfig.stakingConfig, stkLyraData, maxBlock, epochConfig.globalIgnoreList)

      // sync MMV Rewards
      console.log("Calculating MMV rewards...")
      console.log(`-`.repeat(20));
      const MMVRewards = await getMMVRewards(epochConfig.startTimestamp, epochConfig.endTimestamp, epochConfig.MMVConfig, stkLyraData, maxBlock, lpEvents, epochConfig.globalIgnoreList) as AvalonLyraLPData;

      let tradingRewards: TradingRewards = {
        totalLyraRebate: 0,
        totalOpRebate: 0,
        lyraScaleFactor: 1,
        opScaleFactor: 1,
        totalUnscaledRebateDollars: 0,
        totalTradingUnscaledRebateDollars: 0,
        totalCollatUnscaledRebateDollars: 0,
        totalFees: 0,
        tradingRebates: {
          totalLyraRebate: 0,
          totalOpRebate: 0,
        },
        shortCollat: {
          totalShortCallSeconds: 0,
          totalShortPutSeconds: 0,
          totalLyraRebate: 0,
          totalOpRebate: 0,
        },
      }
      let userRebates: UserRebates = {  };

      console.log("calculating trading rewards...")
      if (epochConfig.enabledTradingRewardMarkets.length == 0) {
        console.log("skipping as no rewards")
      } else {
        console.log(`-`.repeat(20));
        [tradingRewards, userRebates] = await getTradingRewards(
          epochConfig.startTimestamp, epochConfig.endTimestamp, maxBlock.timestamp, epochConfig.enabledTradingRewardMarkets, epochConfig.tradingConfig,
          cooldownEvents, allTrades, allDeltaSnapshots, allStrikeDetails, allTransfers
        );
        // console.log('trading rewards', tradingRewards);
      }
      
      // compile epochs
      console.log("Compiling epochs...")
      console.log(`-`.repeat(20));

      // compile global epoch
      rewardEpoch.totalStkLyraDays = stkLyraData.totalStkLyraDays
      rewardEpoch.rewardedStakingRewards = {
        lyra: inflationRewards.totalDistributedLyraRewards,
        op: inflationRewards.totalDistributedOPRewards
      }

      rewardEpoch.tradingRewardResults = {
        ...tradingRewards,
      }

      for (const user of Object.keys(stkLyraData.perUser)) {
        const id = String([user, deployment, epochConfig.id])
        if (!accountEpochs[id]) {
          accountEpochs[id] = getEmptyAccountEpoch(user, deployment, epochConfig.startTimestamp, epochConfig.endTimestamp);
        }

        accountEpochs[id].stkLyraDays = stkLyraData.perUser[user].stkLyraDays
      }

      for (const user of Object.keys(inflationRewards.perUser)) {
        // stkLyraDays['0xcD40C15Df1DeE1A88792f197672297A2224CC3a1']
        if (user == '0xcD40C15Df1DeE1A88792f197672297A2224CC3a1') {
          console.log(inflationRewards.perUser[user]);
        }
        const id = String([user, deployment, epochConfig.id])
        if (!accountEpochs[id]) {
          accountEpochs[id] = getEmptyAccountEpoch(user, deployment, epochConfig.startTimestamp, epochConfig.endTimestamp);
        }

        accountEpochs[id].inflationaryRewards = {
          isIgnored: inflationRewards.perUser[user] ? inflationRewards.perUser[user].isIgnored : false,
          op: inflationRewards.perUser[user] ? inflationRewards.perUser[user].op : 0,
          lyra: inflationRewards.perUser[user] ? inflationRewards.perUser[user].lyra : 0,
        };
      }

      console.log(userRebates['0x9ba8c70a8fd922e97a4e78c46583742c7d41796c']);
      console.log(userRebates[ethers.utils.getAddress('0x9ba8c70a8fd922e97a4e78c46583742c7d41796c')]);

      for (const user of Object.keys(userRebates)) {
        const id = String([user, deployment, epochConfig.id])
        if (!accountEpochs[id]) {
          accountEpochs[id] = getEmptyAccountEpoch(user, deployment, epochConfig.startTimestamp, epochConfig.endTimestamp);
        }
        accountEpochs[id].tradingRewards = {
          ...userRebates[user],
          // For trading rebates
          tradingFees: userRebates[user].fees,
        }
      }


      for (const market of Object.keys(epochConfig.MMVConfig)) {
        console.log("-", market)

        rewardEpoch.scaledStkLyraDays[market] = MMVRewards[market].scaledStkLyraDays | 0
        rewardEpoch.totalLpTokenDays[market] = MMVRewards[market].totalLPDays | 0
        rewardEpoch.totalBoostedLpTokenDays[market] = MMVRewards[market].totalBoostedLPDays | 0
        rewardEpoch.rewardedMMVRewards.LYRA[market] = MMVRewards[market].totalDistributedLyraRewards | 0
        rewardEpoch.rewardedMMVRewards.OP[market] = MMVRewards[market].totalDistributedOPRewards | 0
        // aggregate all users & compile account reward epochs

        for (const user of Object.keys(MMVRewards[market].perUser)) {
          const id = String([user, deployment, epochConfig.id])
          if (!accountEpochs[id]) {
            accountEpochs[id] = getEmptyAccountEpoch(user, deployment, epochConfig.startTimestamp, epochConfig.endTimestamp);
          }

          accountEpochs[id].MMVRewards[market] = {
            isIgnored: MMVRewards[market].perUser[user] ? MMVRewards[market].perUser[user].isIgnored : false, // default to false
            lyra: MMVRewards[market].perUser[user] ? MMVRewards[market].perUser[user].lyraRewards : 0,
            op: MMVRewards[market].perUser[user] ? MMVRewards[market].perUser[user].opRewards : 0,
          }

          accountEpochs[id].lpDays[market] = MMVRewards[market].perUser[user] ? MMVRewards[market].perUser[user].lpDays : 0
          accountEpochs[id].boostedLpDays[market] = MMVRewards[market].perUser[user] ? MMVRewards[market].perUser[user].boostedLpDays : 0
        }
      }

      if (deploymentStr == "mainnet-ovm-avalon") { console.log(rewardEpoch) }
      console.log(`${Object.keys(accountEpochs).length} account epochs to insert`);
      await insertOrUpdateGlobalRewardEpoch(rewardEpoch)
    }
  }

  await insertOrUpdateAccountRewardEpoch(Object.keys(accountEpochs).map(key => accountEpochs[key]))
}

loadArgsAndEnv(process.argv);
initializeDB()
  .then(async () => await syncAvalonRewards())
  .then(() => {
    console.log("Syncing complete!")
    process.exit(0)
  })
  .catch((e: Error) => {
    console.log(e.stack);
    process.exit(1)
  })
