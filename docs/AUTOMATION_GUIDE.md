# Virtual Football Automation Guide

## Overview

The Virtual Football game requires regular automation to:
- Start seasons when their scheduled time arrives
- Simulate matches every 10 minutes after kickoff
- End seasons after the 1-day duration
- Optionally create new seasons automatically

This automation script (`scripts/automateVirtualFootball.js`) handles all of these tasks automatically.

---

## Quick Start

### 1. Set Environment Variables

Create or update `.env` file in the project root:

```bash
# Required: Contract address
VIRTUAL_FOOTBALL_GAME_ADDRESS=0x...

# Optional: Automation settings
AUTO_CREATE_SEASONS=true          # Auto-create new seasons (default: false)
CHECK_INTERVAL=30000              # Check every 30 seconds (default: 30000ms)
MAX_GAS_PRICE=50                  # Skip if gas > 50 gwei (default: 50)

# Required: Network configuration (from hardhat.config.js)
BSC_TESTNET_RPC_URL=https://...
PRIVATE_KEY=your_private_key_here
```

### 2. Run the Bot

```bash
# On testnet
npx hardhat run scripts/automateVirtualFootball.js --network bscTestnet

# On mainnet (use with caution!)
npx hardhat run scripts/automateVirtualFootball.js --network bscMainnet
```

### 3. Keep it Running

The script runs continuously. Keep it running in:
- **Terminal session**: Simple but stops when terminal closes
- **Screen/tmux**: Better for servers
- **PM2**: Recommended for production
- **Systemd**: For Linux servers
- **Docker**: For containerized deployments

---

## How It Works

### Monitoring Loop

The bot checks the game state every `CHECK_INTERVAL` milliseconds (default: 30 seconds):

```
┌─────────────────────────────────────┐
│  Check Current Season               │
└──────────┬──────────────────────────┘
           │
           ├─> No Season? ──> Create New Season (if enabled)
           │
           ├─> UPCOMING? ──> Check if startTime reached ──> Start Season
           │
           ├─> ACTIVE? ────> Check matches ──────────────> Simulate Ready Matches
           │                 Check if endTime reached ──> End Season
           │
           └─> COMPLETED? ─> Create New Season (if enabled)
```

### What Happens Each Check

#### 1. **No Season Exists**
- If `AUTO_CREATE_SEASONS=true`: Creates new season starting 1 hour from now
- Otherwise: Waits and logs reminder

#### 2. **Season is UPCOMING**
- Checks if `startTime` has been reached
- If yes: Calls `startSeason(seasonId)`
  - Generates all 20 matches
  - Schedules them with the oracle
  - Sets match kickoff times (every 10 minutes)
- Otherwise: Logs time remaining until start

#### 3. **Season is ACTIVE**
- Gets all 20 match IDs
- For each match:
  - Checks if `kickoffTime` reached and not yet finalized
  - If ready: Calls `simulateMatch(matchId)`
    - Generates random score
    - Updates team stats
    - Submits result to oracle
  - Waits 2 seconds between simulations (avoid nonce conflicts)
- Checks if `endTime` reached
- If yes: Calls `endSeason(seasonId)`
  - Calculates winner based on points
  - Sets status to COMPLETED

#### 4. **Season is COMPLETED**
- If `AUTO_CREATE_SEASONS=true`: Creates next season
- Otherwise: Waits and logs reminder

---

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `VIRTUAL_FOOTBALL_GAME_ADDRESS` | Required | Contract address |
| `AUTO_CREATE_SEASONS` | `false` | Automatically create new seasons |
| `CHECK_INTERVAL` | `30000` | Check interval in milliseconds |
| `MAX_GAS_PRICE` | `50` | Max gas price in gwei (skips tx if higher) |
| `PRIVATE_KEY` | Required | Bot wallet private key |

### Gas Management

The bot checks gas price before each transaction:
- If current gas > `MAX_GAS_PRICE`: **Skips** transaction
- Next check will retry when gas is lower
- Prevents overpaying during network congestion

**Recommended settings**:
- BSC Testnet: `MAX_GAS_PRICE=50` (testnet gas is cheap)
- BSC Mainnet: `MAX_GAS_PRICE=5` (adjust based on network)

### Check Interval

Balance between responsiveness and API calls:
- **30 seconds** (default): Good for testing, responsive
- **1 minute** (60000ms): Production balance
- **5 minutes** (300000ms): Conservative, lower API usage

Since matches are 10 minutes apart, even 5-minute checks work fine.

---

## Production Deployment

### Using PM2 (Recommended)

```bash
# Install PM2
npm install -g pm2

# Create ecosystem file
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: "vf-automation",
    script: "npx",
    args: "hardhat run scripts/automateVirtualFootball.js --network bscTestnet",
    cwd: "/path/to/predictbnb",
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: "500M",
    env: {
      AUTO_CREATE_SEASONS: "true",
      CHECK_INTERVAL: "60000",
      MAX_GAS_PRICE: "5"
    }
  }]
};
EOF

# Start
pm2 start ecosystem.config.js

# Monitor
pm2 logs vf-automation
pm2 monit

# Auto-start on reboot
pm2 startup
pm2 save
```

### Using Docker

```dockerfile
# Dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

ENV AUTO_CREATE_SEASONS=true
ENV CHECK_INTERVAL=60000
ENV MAX_GAS_PRICE=5

CMD ["npx", "hardhat", "run", "scripts/automateVirtualFootball.js", "--network", "bscTestnet"]
```

```bash
# Build and run
docker build -t vf-automation .
docker run -d --name vf-bot \
  --env-file .env \
  --restart unless-stopped \
  vf-automation

# View logs
docker logs -f vf-bot
```

### Using Systemd (Linux)

```bash
# Create service file
sudo nano /etc/systemd/system/vf-automation.service
```

```ini
[Unit]
Description=Virtual Football Automation Bot
After=network.target

[Service]
Type=simple
User=your-user
WorkingDirectory=/path/to/predictbnb
Environment="AUTO_CREATE_SEASONS=true"
Environment="CHECK_INTERVAL=60000"
Environment="MAX_GAS_PRICE=5"
ExecStart=/usr/bin/npx hardhat run scripts/automateVirtualFootball.js --network bscTestnet
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

```bash
# Enable and start
sudo systemctl enable vf-automation
sudo systemctl start vf-automation

# Check status
sudo systemctl status vf-automation

# View logs
sudo journalctl -u vf-automation -f
```

---

## Monitoring & Logs

### Console Output

The bot provides detailed logs:

```
🤖 Virtual Football Automation Bot Starting...

Bot Address: 0x1234...5678
Contract Address: 0xabcd...ef01

Configuration:
  Auto-create seasons: true
  Check interval: 30000ms
  Max gas price: 50 gwei

============================================================

[10:30:15 AM] 🔍 Checking game state...

📊 Season #1 Status:
   Status: ACTIVE
   Start: 12/26/2024, 10:00:00 AM
   End: 12/27/2024, 10:00:00 AM
   Matches: 20

⚽ Match #5 ready!
   Arsenal vs Tottenham
   Transaction: 0x789...abc
   ⚽ Final Score: 2 - 1
   Gas used: 185432

✅ Simulated 1 match(es)
⏰ Next match in 8m 30s

[10:30:45 AM] 🔍 Checking game state...
...
```

### Log Levels

- 🤖 **Bot startup** - Initial configuration
- 🔍 **Check cycle** - Regular monitoring
- 📊 **Season info** - Current season status
- ⚽ **Match simulation** - Match being simulated
- 🚀 **Season start** - Season starting
- 🏁 **Season end** - Season ending
- 🆕 **Season creation** - New season created
- ✅ **Success** - Operation completed
- ❌ **Error** - Operation failed
- ⏰ **Countdown** - Time until next event
- ⛽ **Gas warning** - Gas price too high

---

## Troubleshooting

### Bot Not Simulating Matches

**Check 1**: Verify time is correct
```bash
# The bot uses system time
date

# Should match blockchain time (~UTC)
```

**Check 2**: Check if matches are ready
```bash
# In Hardhat console
const game = await ethers.getContractAt("VirtualFootballGame", "0x...");
const seasonId = await game.currentSeasonId();
const matchIds = await game.getSeasonMatches(seasonId);
const match = await game.getMatch(matchIds[0]);
console.log("Kickoff:", new Date(Number(match.kickoffTime) * 1000));
console.log("Now:", new Date());
```

**Check 3**: Check if already finalized
```bash
console.log("Finalized:", match.isFinalized);
```

### High Gas Prices

Bot skips transactions when gas > `MAX_GAS_PRICE`:

```
⛽ Gas price too high: 75 gwei (max: 50 gwei)
   ⏭️  Skipping due to high gas price
```

**Solutions**:
1. Increase `MAX_GAS_PRICE` (costs more)
2. Wait for gas to drop (delays automation)
3. Use L2 or cheaper network

### Nonce Errors

If simulating many matches quickly:

```
Error: nonce has already been used
```

**Solution**: Increase `matchSimulationDelay` in script (default: 2000ms)

### Permission Errors

```
⚠️  WARNING: You are not the owner. Owner is 0x...
```

**Solution**: Run with owner's private key or grant permissions

---

## Gas Costs

Estimated gas costs per operation:

| Operation | Gas | Cost @ 3 gwei | Cost @ 10 gwei |
|-----------|-----|---------------|----------------|
| Create Season | ~50,000 | ~0.00015 BNB | ~0.0005 BNB |
| Start Season | ~2,500,000 | ~0.0075 BNB | ~0.025 BNB |
| Simulate Match | ~200,000 | ~0.0006 BNB | ~0.002 BNB |
| End Season | ~100,000 | ~0.0003 BNB | ~0.001 BNB |

**Total per season** (20 matches):
- Start: ~0.0075 BNB
- 20 Simulations: ~0.012 BNB
- End: ~0.0003 BNB
- **Total: ~0.02 BNB per season**

At 1 season per day: **~0.6 BNB/month**

---

## Advanced Usage

### Manual Control

You can still manually control while bot runs:

```bash
# In Hardhat console (different terminal)
const game = await ethers.getContractAt("VirtualFootballGame", "0x...");

# Manually simulate a match
await game.simulateMatch(5);

# Bot will skip it on next check (already processed)
```

### Multiple Bots

Run multiple instances for redundancy:

```bash
# Bot 1 - Primary
AUTO_CREATE_SEASONS=true CHECK_INTERVAL=30000 npx hardhat run ...

# Bot 2 - Backup (slower checks, doesn't create seasons)
AUTO_CREATE_SEASONS=false CHECK_INTERVAL=120000 npx hardhat run ...
```

First bot to submit wins, second skips (already processed).

### Custom Match Simulation Order

Edit script to prioritize certain matches:

```javascript
// In simulateReadyMatches function
matchIds.sort((a, b) => {
  // Custom sorting logic
  // Example: Simulate matches with more bets first
  return 0;
});
```

---

## Security Considerations

### Private Key Safety

**Never commit `.env` file!**

```bash
# Ensure .env is in .gitignore
echo ".env" >> .gitignore
```

**Use separate bot wallet**:
- Create dedicated wallet for automation
- Transfer only enough BNB for gas
- Owner can be different wallet (bot doesn't need ownership for simulation)

### Gas Limits

Set reasonable limits to prevent drain:

```javascript
// In script (optional)
const tx = await game.simulateMatch(matchId, {
  gasPrice,
  gasLimit: 300000 // Max 300k gas
});
```

### Rate Limiting

Don't hammer RPC nodes:
- Minimum `CHECK_INTERVAL`: 10 seconds
- Use dedicated RPC if running 24/7
- Consider paid RPC for reliability (Ankr, QuickNode, etc.)

---

## FAQ

**Q: Can I run this on my laptop?**
A: Yes, but laptop must stay on. Better to use cloud server or VPS.

**Q: What happens if bot crashes?**
A: Next check will catch up. No matches are missed unless down for >10 minutes during active season.

**Q: Can I run bot without being owner?**
A: Yes! Anyone can call `simulateMatch()`. Only `startSeason` and `endSeason` require ownership.

**Q: How to stop the bot?**
A: Press `Ctrl+C` in terminal, or `pm2 stop vf-automation` if using PM2.

**Q: Can I run multiple games?**
A: Yes, deploy multiple contracts and run separate bot instances with different addresses.

**Q: What if I miss the season start time?**
A: You can manually call `startSeason()`, or bot will call it on next check if time has passed.

---

## Recommended Setup

### Development/Testing
```bash
AUTO_CREATE_SEASONS=true
CHECK_INTERVAL=30000
MAX_GAS_PRICE=50
```
Run in terminal, restart as needed.

### Production
```bash
AUTO_CREATE_SEASONS=true
CHECK_INTERVAL=60000
MAX_GAS_PRICE=5
```
Use PM2 or Docker, monitor with alerts.

---

## Next Steps

After setting up automation:

1. ✅ Deploy contract to testnet
2. ✅ Update `.env` with contract address
3. ✅ Fund bot wallet with gas money (~0.1 BNB for testing)
4. ✅ Run bot: `npx hardhat run scripts/automateVirtualFootball.js --network bscTestnet`
5. ✅ Monitor logs for first full season cycle
6. ✅ Set up PM2 for production
7. ✅ Configure alerts for bot downtime

---

## Support

If the bot encounters issues:

1. Check logs for error messages
2. Verify contract address is correct
3. Ensure bot wallet has BNB for gas
4. Check network connectivity
5. Verify RPC endpoint is responsive

For persistent issues, check:
- Contract is deployed and verified
- Network is correct (testnet vs mainnet)
- Private key has necessary permissions
- System time is synchronized

---

## Changelog

### v1.0.0
- Initial release
- Auto-start seasons
- Auto-simulate matches
- Auto-end seasons
- Optional auto-create seasons
- Gas price monitoring
- State tracking to avoid duplicates
