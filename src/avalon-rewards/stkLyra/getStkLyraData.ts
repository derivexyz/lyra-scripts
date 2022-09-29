import { Block } from '@ethersproject/abstract-provider'
import { CooldownEvent } from '../config'
import { DAY_SEC } from '../../constants'

export type StkLyraData = {
  perUser: {
    [user: string]: {
      stkLyraDays: number,
      percentOfTotal: number,
      avgStkLyra: number,
    }
  }
  startTimestamp: number,
  endTimestamp: number,
  totalStkLyraDays: number
}


const COOLDOWN_DURATION = 16 * DAY_SEC; // 14 day cooldown + 2 day redeem period


export async function getStkLyraData(startTimestamp: number, endTimestamp: number, epochId: string, maxBlock: Block, cooldownEvents: CooldownEvent[], globalIgnoreList: string[],) : Promise<StkLyraData> {
  const ignoreList = [...new Set(globalIgnoreList.map(x => x.toLowerCase()))];

  // get total stkLyra * seconds per user
  const stkLyraDays = await getStkLyraDays(startTimestamp, endTimestamp, maxBlock, cooldownEvents, epochId);

  // console.log("stkLyraDays", stkLyraDays);

  // get percent of total stkLyraDays per user 
  const percentOfTotal = await getPercentOfTotalStkLyra(stkLyraDays, ignoreList);

  // aggregate
  const stkLyraData = {perUser: {}, totalStkLyraDays: 0} as StkLyraData;
  for (const user in stkLyraDays) {
    // console.log(user, percentOfTotal[user].toString())
    stkLyraData.perUser[user] = {
      stkLyraDays: stkLyraDays[user],
      percentOfTotal: percentOfTotal[user],
      // get average stkLyra for trading boost
      avgStkLyra: stkLyraDays[user] / ((endTimestamp - startTimestamp) / DAY_SEC)
    }
    stkLyraData.totalStkLyraDays += stkLyraData.perUser[user].stkLyraDays
  }
  stkLyraData.startTimestamp = startTimestamp;
  stkLyraData.endTimestamp = endTimestamp;

  return stkLyraData
}

async function getStkLyraDays(
    startTimestamp: number, endTimestamp: number, maxBlock: Block, cooldownEvents: CooldownEvent[], epochId: string
  ): Promise<{[user: string]: number;}> {
  // init
  const stkLyraDays: { [user: string]: number } = {};
  const lastState: { [user: string]: { cooldownTs: number, eventTs: number, balance: number} } = {};


  // accrue stkLyraSec for each event
  // console.log("Fetching timestamps from graph...")
  for (const event of cooldownEvents) {
    if (stkLyraDays[event.user] == undefined) {
      stkLyraDays[event.user] = 0;
    }
    // console.log("processing event:", event.eventSignature, "for:", event.args?.user, "ts:", currentTs)
    
    if (lastState[event.user] != undefined) {
      const startAccrualTs = Math.max(
        lastState[event.user].cooldownTs + COOLDOWN_DURATION,
        lastState[event.user].eventTs,
        startTimestamp
      );

      let endAccrualTs = Math.min(
        event.timestamp,
        endTimestamp,
        maxBlock.timestamp
      )

      // Because of minor bug
      if (epochId == 'epoch-1') {
        endAccrualTs = Math.min(
          event.timestamp,
          endTimestamp
        )
      }

      if (endAccrualTs > startAccrualTs) {
        const accrued = (endAccrualTs - startAccrualTs) / DAY_SEC * lastState[event.user].balance
        stkLyraDays[event.user] += accrued
      }
    }

    lastState[event.user] = {
      cooldownTs: event.cooldownTimestamp,
      balance: event.balance,
      eventTs: event.timestamp
    }
  }

  // top off final accrual if no events triggered before end of epoch
  // todo: can probably optimize... 
  for (const user in lastState) {
    let lastTs = Math.max(
      lastState[user].cooldownTs + COOLDOWN_DURATION,
      lastState[user].eventTs,
      startTimestamp
    )

    // Because of minor bug
    if (epochId == 'epoch-1') {
      lastTs = Math.max(
        lastState[user].cooldownTs + COOLDOWN_DURATION,
        lastState[user].eventTs
      )
    }

    const endAccrualTs = Math.min(
      maxBlock.timestamp,
      endTimestamp
    )

    // only accrue if epoch has started
    if (lastTs < endAccrualTs && maxBlock.timestamp > startTimestamp) {
      stkLyraDays[user] += (endAccrualTs - lastTs) / DAY_SEC * lastState[user].balance
    }
  }

  return stkLyraDays
}

async function getPercentOfTotalStkLyra(stkLyraDays: {[user: string]: number}, ignoreList: string[] ) {
  let totalstkLyraDays = Object.entries(stkLyraDays).reduce((a, b, c) => {
    if (ignoreList.includes(b[0].toLowerCase())) {
      return a;
    }
    return a + b[1]
  }, 0);

  const percentOfTotal: {[user: string]: number} = {};
  for (const user in stkLyraDays) {
    if (ignoreList.includes(user.toLowerCase())) {
      percentOfTotal[user] = 0;
    } else {
      percentOfTotal[user] = (stkLyraDays[user] != 0)
        ? stkLyraDays[user] / totalstkLyraDays
        : 0;
    }
  }

  return percentOfTotal;
}

// todo: don't give boost when someone cooling down 
export function getStkLyraBalance(
  user: string,
  cooldownEvents: CooldownEvent[],
  queryTs: number
): number {

  let balance = 0;
  for (const event of cooldownEvents) {
    if (user === event.user && (event.cooldownTimestamp == 0 || event.cooldownTimestamp + COOLDOWN_DURATION <= queryTs)) {
      balance = event.balance
    }
  }
  return balance;
}

// loadArgsAndEnv(process.argv);
// getStkLyraData(LP_CONFIG[0], 'kovan-ovm-avalon').then((res) => {
//   console.log(res);
// });