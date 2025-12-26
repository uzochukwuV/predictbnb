const hre = require("hardhat");
const { ethers, upgrades } = require("hardhat");

async function main() {
  console.log("\n🚀 Deploying Virtual Football System (v2 - Separated Architecture)...\n");

  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "BNB\n");

  // Check if we have existing deployment
  const existingDeployment = "0x49F92ABd98739C67aD0FD0493ae238305dC32d17"; // From your deployment file

  let gameRegistry, feeManager, oracleCore;

  // Option 1: Use existing deployment (recommended for testnet)
  console.log("📝 Using existing core contracts from deployment...");

  gameRegistry = await ethers.getContractAt("GameRegistry", existingDeployment);
  console.log("   ✅ Connected to GameRegistry at:", existingDeployment);

  // Get other addresses from GameRegistry
  const oracleCoreAddress = await gameRegistry.oracleCore();
  const feeManagerAddress = await gameRegistry.feeManager();

  oracleCore = await ethers.getContractAt("OracleCore", oracleCoreAddress);
  feeManager = await ethers.getContractAt("FeeManagerV2", feeManagerAddress);

  console.log("   ✅ Connected to OracleCore at:", oracleCoreAddress);
  console.log("   ✅ Connected to FeeManagerV2 at:", feeManagerAddress);

  // Deploy VirtualFootballGame (the game that interacts with oracle)
  console.log("\n1️⃣  Deploying VirtualFootballGame...");
  const VirtualFootballGame = await ethers.getContractFactory("VirtualFootballGame");

  const virtualFootballGame = await VirtualFootballGame.deploy(
    oracleCoreAddress,
    await gameRegistry.getAddress()
  );
  await virtualFootballGame.waitForDeployment();
  const gameAddress = await virtualFootballGame.getAddress();
  console.log("   ✅ VirtualFootballGame deployed to:", gameAddress);

  // Register the game with PredictBNB
  console.log("\n2️⃣  Registering Virtual Football game...");
  const registrationFee = ethers.parseEther("0.1");
  const registerTx = await virtualFootballGame.registerGame({ value: registrationFee });
  await registerTx.wait();

  const gameId = await virtualFootballGame.gameId();
  console.log("   ✅ Game registered with ID:", gameId);

  // Deploy VirtualFootballMarket (the prediction market)
  console.log("\n3️⃣  Deploying VirtualFootballMarket...");
  const VirtualFootballMarket = await ethers.getContractFactory("VirtualFootballMarket");

  const virtualFootballMarket = await VirtualFootballMarket.deploy(
    gameAddress,
    oracleCoreAddress,
    feeManagerAddress
  );
  await virtualFootballMarket.waitForDeployment();
  const marketAddress = await virtualFootballMarket.getAddress();
  console.log("   ✅ VirtualFootballMarket deployed to:", marketAddress);

  // Fund market contract with some balance for oracle queries
  console.log("\n4️⃣  Funding market contract for oracle queries...");
  const fundTx = await virtualFootballMarket.fundOracleBalance({
    value: ethers.parseEther("1")
  });
  await fundTx.wait();
  console.log("   ✅ Market funded with 1 BNB for oracle queries");

  // Create first season
  console.log("\n5️⃣  Creating inaugural season...");
  const currentTime = Math.floor(Date.now() / 1000);
  const seasonStartTime = currentTime + (60 * 60); // Start in 1 hour (for testing)

  const createSeasonTx = await virtualFootballGame.createSeason(seasonStartTime);
  await createSeasonTx.wait();

  const seasonId = await virtualFootballGame.currentSeasonId();
  const season = await virtualFootballGame.getSeason(seasonId);

  console.log("   ✅ Season", seasonId, "created");
  console.log("   📅 Start time:", new Date(Number(season.startTime) * 1000).toLocaleString());
  console.log("   📅 End time:", new Date(Number(season.endTime) * 1000).toLocaleString());

  // Print deployment summary
  console.log("\n" + "=".repeat(70));
  console.log("📊 DEPLOYMENT SUMMARY");
  console.log("=".repeat(70));
  console.log("\n🏗️  Core Infrastructure (Existing):");
  console.log("   GameRegistry:        ", await gameRegistry.getAddress());
  console.log("   FeeManagerV2:        ", feeManagerAddress);
  console.log("   OracleCore:          ", oracleCoreAddress);

  console.log("\n⚽ Virtual Football (New):");
  console.log("   VirtualFootballGame:   ", gameAddress);
  console.log("   VirtualFootballMarket: ", marketAddress);
  console.log("   Game ID:               ", gameId);

  console.log("\n🏆 Season Information:");
  console.log("   Current Season:      ", seasonId.toString());
  console.log("   Duration:            ", "14 days");
  console.log("   Matches per day:     ", "48");
  console.log("   Match interval:      ", "30 minutes");
  console.log("   Total matches:       ", "~336");

  console.log("\n💰 Economics:");
  console.log("   Platform Fee:        ", "5%");
  console.log("   Voting Rewards:      ", "1% of betting volume");
  console.log("   Tipster Commission:  ", "2% of copier winnings");

  console.log("\n⚙️  Teams:");
  const teamNames = [
    "Manchester City",
    "Arsenal",
    "Liverpool",
    "Manchester United",
    "Chelsea",
    "Tottenham",
    "Newcastle",
    "Brighton",
    "Aston Villa",
    "West Ham"
  ];
  teamNames.forEach((name, index) => {
    console.log(`   ${index}: ${name}`);
  });

  console.log("\n🔄 Architecture:");
  console.log("   ┌─────────────────────────────────────┐");
  console.log("   │   VirtualFootballGame (Game Dev)    │");
  console.log("   │   - Creates matches                 │");
  console.log("   │   - Simulates results               │");
  console.log("   │   - Submits to Oracle               │");
  console.log("   └──────────────┬──────────────────────┘");
  console.log("                  │");
  console.log("                  ▼");
  console.log("   ┌─────────────────────────────────────┐");
  console.log("   │      PredictBNB Oracle Core         │");
  console.log("   │   - Stores match results            │");
  console.log("   │   - Manages disputes                │");
  console.log("   └──────────────┬──────────────────────┘");
  console.log("                  │");
  console.log("                  ▼");
  console.log("   ┌─────────────────────────────────────┐");
  console.log("   │  VirtualFootballMarket (Consumers)  │");
  console.log("   │   - Users place bets                │");
  console.log("   │   - Queries oracle for results      │");
  console.log("   │   - Settles bets & pays winnings    │");
  console.log("   └─────────────────────────────────────┘");

  console.log("\n" + "=".repeat(70));
  console.log("✅ Virtual Football deployment complete!");
  console.log("=".repeat(70) + "\n");

  // Save deployment addresses
  const deployment = {
    network: hre.network.name,
    timestamp: new Date().toISOString(),
    deployer: deployer.address,
    contracts: {
      gameRegistry: await gameRegistry.getAddress(),
      feeManager: feeManagerAddress,
      oracleCore: oracleCoreAddress,
      virtualFootballGame: gameAddress,
      virtualFootballMarket: marketAddress
    },
    gameId: gameId,
    seasonId: seasonId.toString(),
    seasonStartTime: Number(season.startTime)
  };

  const fs = require("fs");
  const path = require("path");
  const deploymentsDir = path.join(__dirname, "../deployments");

  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  const filename = `virtual-football-v2-${hre.network.name}-${Date.now()}.json`;
  fs.writeFileSync(
    path.join(deploymentsDir, filename),
    JSON.stringify(deployment, null, 2)
  );

  console.log("💾 Deployment info saved to:", filename);

  console.log("\n🎯 Next steps:");
  console.log("\n📖 For Game Contract (VirtualFootballGame):");
  console.log("   1. Wait for season start time (or call startSeason())");
  console.log("   2. Matches will be auto-generated when season starts");
  console.log("   3. Call simulateMatch(matchId) to finalize each match");
  console.log("   4. Results are automatically submitted to oracle");

  console.log("\n💰 For Market Contract (VirtualFootballMarket):");
  console.log("   1. Users vote for season winner: voteForSeasonWinner(seasonId, teamId)");
  console.log("   2. Users place bets: placeBet(matchId, betType, selection, amount)");
  console.log("   3. After match finalized, call settleBet(betId)");
  console.log("   4. Winners claim: claimBet(betId)");
  console.log("   5. After season ends, voters claim: claimVotingReward(seasonId)");

  console.log("\n💡 Tipster Features:");
  console.log("   - Register: registerAsTipster(name)");
  console.log("   - Follow: followTipster(tipsterAddress)");
  console.log("   - Bet as tipster: placeBetAsTipster(...)");
  console.log("   - Copy bet: copyBet(tipsterBetId, amount)");

  console.log("\n🔍 Testing Commands:");
  console.log("   # Start season immediately (for testing)");
  console.log("   await virtualFootballGame.startSeason(1);");
  console.log("");
  console.log("   # Get match IDs");
  console.log("   const matches = await virtualFootballGame.getSeasonMatches(1);");
  console.log("   console.log('First match ID:', matches[0]);");
  console.log("");
  console.log("   # Simulate first match");
  console.log("   await virtualFootballGame.simulateMatch(matches[0]);");
  console.log("");
  console.log("   # Place a bet (bet type 0 = MATCH_WINNER, selection 0 = home win)");
  console.log("   await virtualFootballMarket.placeBet(matches[0], 0, 0, ethers.parseEther('0.1'), {value: ethers.parseEther('0.1')});");
  console.log("");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
