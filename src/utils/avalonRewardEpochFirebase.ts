import { FirebaseCollections } from '../constants/collections'
import { getFirebaseDB } from './firebase'
import { AccountRewardEpoch, GlobalRewardEpoch } from './avalonRewardEpoch'

export async function insertOrUpdateGlobalRewardEpoch(globalEpoch: GlobalRewardEpoch) {
  console.log('Updating GlobalRewardEpoch in Firebase...')
  console.log(`-`.repeat(20));

  if (globalEpoch.startTimestamp === undefined) {
    return;
  }

  const db = await getFirebaseDB();
  const documentReference = db.ref(`${FirebaseCollections.AvalonGlobalRewardsEpoch}/${globalEpoch.startTimestamp}`);
  
  try {
    await documentReference.set(globalEpoch);
  }
  catch (e) {
    console.log("Error whilst writing GlobalRewardEpoch:", e);
  }
}

export async function insertOrUpdateAccountRewardEpoch(accountEpochs: AccountRewardEpoch[]) {
  console.log('Updating AccountRewardEpoch in Firebase...')
  console.log(`-`.repeat(20));

  const db = await getFirebaseDB();
  const documentReference = db.ref(`${FirebaseCollections.AvalonAccountRewardsEpoch}`);
  try {
    await documentReference.set(accountEpochs);
  }
  catch (e) {
    console.log("Error whilst writing GlobalRewardEpoch:", e);
  }
}
