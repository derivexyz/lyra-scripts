import { getNetworkProvider } from '../utils'
import { BigNumber, ethers } from 'ethers'
import { abi } from '../abis/LyraDistributor.json'
import csv from "csvtojson";
import { parseEther } from 'ethers/lib/utils'
import objectsToCsv from 'objects-to-csv'

// This script should create csv files for all the rewards in the db

const IN_FILE = "./out/total-rewards-1642118400.csv";
const OUT_FILE = "./out/rewards-to-send.csv";
const MIN_CUTOFF = parseEther('1');
const HACKED: Record<string, string> = {
  '0xeC26Dcfc6B32578e1CD6269bAdA9EB27D9312110': '0x96cadeb84441BcC52C6d1f52135D3897DfD2045F',
  '0x0e834E9bd97A93B5497e77984c5f70085b3F6D90': '0x96cadeb84441BcC52C6d1f52135D3897DfD2045F',
  '0xEDBCF860Bee646199B84a351F4a55d7E929A7A36': '0x144579C1d14335580A4F7DcF14554099a30074c9'
}
const DISTRIBUTOR_ADDRESS = "0x0BFb21f64E414Ff616aC54853e52679EEDB22Dd2";
const BATCH_SIZE = 500;


// allow for decimals to be passed in up to 9dp of precision
export function toBN(val: string) {
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


async function getAllTotals(): Promise<
  Record<string, number>
  > {
  const data: { [key: string]: string }[] = await csv().fromFile(
    IN_FILE
  );

  const res: Record<string, number> = {};

  data.forEach(
    (entry: Record<string, string>) => {
      let entryTotal = 0;

      if (!!res[ethers.utils.getAddress(entry.address)]) {
        throw Error("duplicate address");
      }

      if (entry['total-rewards'] === '') {
        throw Error("missing total-rewards")
      }

      res[ethers.utils.getAddress(entry.address)] = parseFloat(entry['total-rewards']);
    }
  );
  return res;
}




async function getPendingTotals() {
  // 1. Import all events from db
  const rewardTotals = await getAllTotals()

  // 2. override hacked addresses

  for (const address in rewardTotals) {
    if (HACKED[address]) {
      if (!rewardTotals[HACKED[address]]) {
        rewardTotals[HACKED[address]] = 0;
      }
      rewardTotals[HACKED[address]] += rewardTotals[address];
      console.warn(`Added ${rewardTotals[address]} rewards to ${HACKED[address]} from ${address}'s total to get a total of ${rewardTotals[HACKED[address]]}\n`)
      delete rewardTotals[address];
    }
  }


  // 3. cut those under threshold
  const rewardTotalsBN: Record<string, BigNumber> = {};
  for (const address in rewardTotals) {
    try {
      rewardTotalsBN[address] = toBN(rewardTotals[address].toString());
    } catch (e) {
      console.log(address, rewardTotals[address]);
      throw e;
    }
  }

  // 4. get all sent rewards from events
  const provider = await getNetworkProvider('mainnet-ovm');

  const distributor = new ethers.Contract(DISTRIBUTOR_ADDRESS, abi, provider);

  let total = BigNumber.from(0);

  const allAddresses = Object.keys(rewardTotalsBN);
  const pendingRewards: Record<string, string>[] = [];
  for (let i=0; i<allAddresses.length; i+=BATCH_SIZE) {
    console.log(`[${i}/${allAddresses.length}]`)
    const slice = allAddresses.slice(i, i+BATCH_SIZE);
    const res = await distributor.getClaimableForAddresses(slice);
    for (let j=0; j<slice.length; j++) {
      const sentToContract = res[0][j].add(res[1][j]);
      const pending = rewardTotalsBN[slice[j]].sub(sentToContract);
      if (pending.gte(MIN_CUTOFF)) {
        total = total.add(pending);
        pendingRewards.push({
          address: slice[j],
          pendingRewards: pending.toString()
        });
      }
    }
  }

  console.log(total.toString());
  // 5. create csv for rewards to send out per address, ignore all < 1 pending

  const csv = new objectsToCsv(pendingRewards);
  await csv.toDisk(OUT_FILE, { allColumns: true });
}


getPendingTotals().then()