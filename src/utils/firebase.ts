import admin from "firebase-admin";
import { getDatabase } from 'firebase-admin/database';
import { sleep } from '.'
import serviceAccount from "../keys/lyra-finance-firebase-admin.json";

const initializeFirebaseApp = async () => {
  try {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount as any),
      databaseURL: "https://lyra-finance-default-rtdb.asia-southeast1.firebasedatabase.app",
      databaseAuthVariableOverride: {
        uid: "my-service-worker"
      }
    });
    console.log('- Initialized Firebase App')
  } catch (e) {
    console.log(e)
  }
}

export default initializeFirebaseApp

export const getFirebaseDB = async () => {
  let count = 0
  const db = getDatabase();
  while (!db) {
    await sleep(500)
    count++
    if (count > 10) {
      throw Error('Firebase DB not connected')
    }
  }
  return db
}

export const closeFirebaseDB = async () => {
  return admin.database().goOffline()
}