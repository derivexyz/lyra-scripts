module.exports = {
  apps : [{
    name: "avalonRewards",
    script: './dist/avalon-rewards/sync.js',
    args: '--env prod',
    interpreter_args: '--max-old-space-size=8192',
    watch: false,
    cron_restart: "*/11 * * * *",
    autorestart: false
  },
  {
    name: "avalonRewardsFirebase",
    script: './dist/avalon-rewards/sync-firebase.js',
    args: '--env prod',
    interpreter_args: '--max-old-space-size=8192',
    watch: false,
    cron_restart: "*/13 * * * *",
    autorestart: false
  }
],
};