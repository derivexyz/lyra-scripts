import { getNetworkProvider } from '../utils'
import { ethers } from 'ethers'
import { abi } from '../abis/LyraDistributor.json'
import csv from "csvtojson";
import { parseEther } from 'ethers/lib/utils'

// This script should create csv files for all the rewards in the db


const DRY_RUN = false;
const IN_FILE = "./out/send-eth-to.csv";
const DISTRIBUTOR_ADDRESS = "0xdA94c7ad8432B19496f22fD7130C2358C010aA48";
const BATCH_SIZE = 500;



async function addAllPendingRewards() {
  const provider = await getNetworkProvider('kovan-ovm');
  const wallet = new ethers.Wallet("0x2ae5655c49703bc9398565c8776916cd5f99b5fa5b63ce98aa93bddcd87493cf", provider);
  const distributor = new ethers.Contract(DISTRIBUTOR_ADDRESS, abi, wallet);

  // 1. load in csv ready to send
  const toSend = await csv().fromFile(IN_FILE);

  const uniqueAddresses = [...new Set(toSend.map(x => ethers.utils.getAddress(x.address)))]
  console.log(uniqueAddresses.length);

  // 2. send transactions (for now just send, in future queue multisig transactions)
  for (let i=0; i<uniqueAddresses.length; i+=BATCH_SIZE) {
    console.log(`[${i}/${uniqueAddresses.length}]`)
    const batch = uniqueAddresses.slice(i, i + BATCH_SIZE);
    if (DRY_RUN) {
      console.log("Sending transaction with args:", batch);
    } else {
      const tx = await distributor.sendEth(batch, batch.map(x => parseEther('0.011')));
      console.log("Transaction sent: ", tx.hash)
      await tx.wait();
    }
  }
}


addAllPendingRewards().then()