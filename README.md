# Lyra Scripts

Scripts built for the Lyra protocol:

- `/src/rewards` scripts for off-chain allocation of $LYRA in various reward programs
- `/src/pools` scripts for calculation of AMM statistics
- `/src/cache` scripts to cache events and blocks locally (used to store pre-regenesis data)

## To run locally

### 1. Initialize MongoDB

We use MongoDB for local and remote data storage in our scripts.

```
docker pull mongo
docker run --name testContainer --restart=always -d -p 27017:27017 mongo mongod --auth
sudo docker exec -i -t testContainer bash
mongo
use admin
db.createUser({user:"foouser",pwd:"foopwd",roles:[{role:"root",db:"admin"}]})
exit
exit
```

### 2. Import pre-regenesis cache

Install `git-lfs`, for mac: `brew install git-lfs`.

Then use `mongorestore` to import the pre-regenesis event cache to MongoDB.

```
git lfs install
git pull
ulimit -S -n 2048
mongorestore --uri="mongodb://localhost:27017" --username=foouser --password=foopwd --authenticationDatabase=admin --drop
```

### 3. Setup scripts

#### 1. Install dependencies:

```
yarn
```

#### 2. Create .env.local file

Copy the contents of `.env.example` to `.env.local` in the root directory.

#### 3. (Optional) Cache events and blocks.

You will need to add your own infura key to `.env.local`. You can get an infura key from https://infura.io/. If you don't run this step, you will use events and blocks up to the point of the last commit.

Run the following script:

```
yarn cache-events-and-blocks --env local
```

### 4. Run scripts

Before running scripts that depend on live data, you should update the event cache:

```
yarn cache-events-and-blocks --env local
```

#### Run a rewards script:

These scripts calculate rewards for various ignition reward programs. You can read more about the programs here: https://docs.lyra.finance/tokenomics/ignition

`<program>` = `lyra-lp, retro-trading, trading, dai-susd-lp, snx-staking`

To export data for programs to `.csv` files in the `/out` directory, run the following script:

```
yarn export-rewards <program> --env local
```

To sync data for programs to MongoDB, run the following script:

```
yarn sync-rewards <program> --env local
```

To recreate post-regenesis data for `snx-staking`, run the following script:

```
yarn sync-snx-staking-data
```

To recreate post-regenesis data for `dai-susd-lp`, run the following script:

```
yarn sync-dai-susd-lp-data
```

#### Run the pool stats script:

This script calculates realtime pool stats such as TVl and trading volume.

```
yarn sync-pool-stats --env local
```

## Other notes

To refresh the MongoDB cache:

```
mongodump --uri="mongodb://localhost:27017" --username=foouser --password=foopwd --db=lyra --authenticationDatabase=admin
```
