import { loadArgsAndEnv } from "../utils";
import initializeDB from "../utils/mongo";
import { purgeRewardEvents } from "../utils/rewards";

loadArgsAndEnv(process.argv);
initializeDB()
  .then(async () => await purgeRewardEvents())
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
