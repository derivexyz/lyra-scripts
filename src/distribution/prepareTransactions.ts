import csv from "csvtojson";
import { BigNumber, ethers } from 'ethers'

function toBN(val: string) {
  // multiplier is to handle decimals
  if (val.includes('e')) {
    if (parseFloat(val) > 1) {
      const x = val.split('.');
      const y = x[1].split('e+');
      const exponent = parseFloat(y[1]);
      const newVal = x[0] + y[0] + '0'.repeat(exponent - y[0].length);
      // console.warn(`Warning: toBN of val with exponent, converting to string. (${val}) converted to (${newVal})`);
      val = newVal;
    } else {
      // console.warn(
      //   `Warning: toBN of val with exponent, converting to float. (${val}) converted to (${parseFloat(val).toFixed(
      //     18,
      //   )})`,
      // );
      val = parseFloat(val).toFixed(18);
    }
  } else if (val.includes('.') && val.split('.')[1].length > 18) {
    // console.warn(`Warning: toBN of val with more than 18 decimals. Stripping excess. (${val})`);
    const x = val.split('.');
    x[1] = x[1].slice(0, 18);
    val = x[0] + '.' + x[1];
  }
  return ethers.utils.parseUnits(val, 18);
}



// This script should create csv files for all the rewards in the db


//
// const IN_FILE = "./out/complete-rewards-mainnet-ovm-avalon-1659488400.csv";

const IN_FILE = "./out/complete-rewards-mainnet-ovm-avalon-1661904000.csv";


const stkLyraAddr = "0xdE48b1B5853cc63B1D05e507414D3E02831722F8";
const opAddr = "0x4200000000000000000000000000000000000042";
const BATCH_SIZE = 501;

async function addAllPendingRewards() {
  const splitName = IN_FILE.split("-");
  const timestamp = splitName[splitName.length - 1].split(".")[0];


  // 1. load in csv ready to send
  const toSend = await csv().fromFile(IN_FILE);

  const rewards: { [key: string]: any[] } = {}


  for (const item of toSend) {
    for (const key of Object.keys(item)) {
      if (key == 'STAKING-LYRA') {
        continue
      }
      if (!key.includes('-')) {
        continue;
      }
      if (!rewards[key]) {
        rewards[key] = []
      }
      if (!item[key] || item[key] == '0' || item[key] == 0) { // || parseFloat(item[key]) < 0.001) {
        continue;
      }
      rewards[key].push({
        amount: item[key],
        user: item["account"]
      })
    }
  }


  const counter: any = {
    totalLyra: BigNumber.from(0),
    totalOP: BigNumber.from(0)
  };


  for (const key of Object.keys(rewards)) {
    counter[key] = {
      total: 0,
      count: 0
    }
    
    const split = key.split('-');
    console.log()
    console.log("=".repeat(20));
    console.log("=".repeat(20));
    console.log("=".repeat(20));
    for (let i=0; i<rewards[key].length; i += BATCH_SIZE) {
      console.log()
      console.log(`Batch ${(i/BATCH_SIZE) + 1}`)
      console.log(JSON.stringify(rewards[key].slice(i, i+BATCH_SIZE).map(x => {
        counter[key].total += parseFloat(x.amount)
        counter[key].count += 1

        if (split[split.length - 1] == "OP") {
          counter.totalOP = counter.totalOP.add(toBN(x.amount));
        } else {
          counter.totalLyra = counter.totalLyra.add(toBN(x.amount));
        }

        return [x.user, toBN(x.amount).toString()];
      })))
      console.log({ token: split[split.length - 1] == "OP" ? opAddr : stkLyraAddr })
      console.log({ timestamp });
      console.log({ tag: key })

    }
  }

  console.log(counter)

  console.log("totalOP", counter.totalOP.toString())
  console.log("totalOP", ethers.utils.formatUnits(counter.totalOP, 18))
  console.log("totalLyra", counter.totalLyra.toString())
  console.log("totalLyra", ethers.utils.formatUnits(counter.totalLyra, 18))
}


addAllPendingRewards().then()