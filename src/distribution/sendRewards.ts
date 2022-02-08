import { getNetworkProvider } from '../utils'
import { ethers } from 'ethers'
import { abi } from '../abis/LyraDistributor.json'
import csv from "csvtojson";

// This script should create csv files for all the rewards in the db


const DRY_RUN = true;
const IN_FILE = "./out/rewards-to-send.csv";
const DISTRIBUTOR_ADDRESS = "0x0BFb21f64E414Ff616aC54853e52679EEDB22Dd2";
const BATCH_SIZE = 500;



async function addAllPendingRewards() {
  const provider = await getNetworkProvider('kovan-ovm');
  const wallet = new ethers.Wallet("0x2ae5655c49703bc9398565c8776916cd5f99b5fa5b63ce98aa93bddcd87493cf", provider);
  const distributor = new ethers.Contract(DISTRIBUTOR_ADDRESS, abi, wallet);

  // 1. load in csv ready to send
  const toSend = await csv().fromFile(IN_FILE);

  // 2. send transactions (for now just send, in future queue multisig transactions)
  for (let i=0; i<toSend.length; i+=BATCH_SIZE) {
    console.log(`[${i}/${toSend.length}]`)
    const batch = toSend.slice(i, i + BATCH_SIZE);
    if (DRY_RUN) {
      console.log("Sending transaction with args:", batch.map(x => x.address), batch.map(x => x.pendingRewards));
    } else {
      const tx = await distributor.addToClaims(batch.map(x => x.address), batch.map(x => x.pendingRewards));
      console.log("Transaction sent: ", tx.hash)
      await tx.wait();
    }
  }
}


addAllPendingRewards().then()