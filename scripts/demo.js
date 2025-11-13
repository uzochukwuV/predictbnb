const hre = require("hardhat");

/**
 * Demo script showing complete flow of gaming oracle usage
 * Run this after deploying contracts to test the system
 */
async function main() {
  console.log("🎮 Gaming Oracle Demo Script\n");

  const [deployer, gameDev, consumer, bettor] = await hre.ethers.getSigners();

  console.log("👥 Accounts:");
  console.log("  Deployer:   ", deployer.address);
  console.log("  Game Dev:   ", gameDev.address);
  console.log("  Consumer:   ", consumer.address);
  console.log("  Bettor:     ", bettor.address);
  console.log();

  // Load deployment addresses (use the most recent deployment)
  const fs = require("fs");
  const path = require("path");
  const deploymentsDir = path.join(__dirname, "..", "deployments");

  if (!fs.existsSync(deploymentsDir)) {
    console.error("❌ No deployments found. Please run deploy.js first.");
    process.exit(1);
  }

  const files = fs.readdirSync(deploymentsDir).filter(f => f.startsWith("deployment-"));
  if (files.length === 0) {
    console.error("❌ No deployment files found. Please run deploy.js first.");
    process.exit(1);
  }

  const latestDeployment = files.sort().reverse()[0];
  const deploymentInfo = JSON.parse(
    fs.readFileSync(path.join(deploymentsDir, latestDeployment), "utf8")
  );

  console.log("📄 Using deployment:", latestDeployment);
  console.log("Network:", deploymentInfo.network);
  console.log();

  // Get contract instances
  const gameRegistry = await hre.ethers.getContractAt(
    "GameRegistry",
    deploymentInfo.contracts.GameRegistry
  );

  const oracleCore = await hre.ethers.getContractAt(
    "OracleCore",
    deploymentInfo.contracts.OracleCore
  );

  const feeManager = await hre.ethers.getContractAt(
    "FeeManager",
    deploymentInfo.contracts.FeeManager
  );

  const predictionMarket = await hre.ethers.getContractAt(
    "ExamplePredictionMarket",
    deploymentInfo.contracts.ExamplePredictionMarket
  );

  console.log("=".repeat(80));
  console.log("STEP 1: Game Developer Registers a Game");
  console.log("=".repeat(80));

  const REGISTRATION_STAKE = hre.ethers.parseEther("0.1");

  const registerTx = await gameRegistry.connect(gameDev).registerGame(
    "lol-demo-001",
    "League of Legends",
    0, // MOBA
    { value: REGISTRATION_STAKE }
  );

  await registerTx.wait();
  console.log("✅ Game registered: League of Legends (lol-demo-001)");

  const game = await gameRegistry.getGame("lol-demo-001");
  console.log("   Developer:        ", game.developer);
  console.log("   Stake:            ", hre.ethers.formatEther(game.stakedAmount), "BNB");
  console.log("   Reputation Score: ", game.reputationScore.toString());
  console.log();

  console.log("=".repeat(80));
  console.log("STEP 2: Schedule a Match");
  console.log("=".repeat(80));

  const futureTime = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
  const matchMetadata = JSON.stringify({
    team1: "Team SoloMid",
    team2: "Cloud9",
    tournament: "LCS Spring 2025",
    bestOf: 3
  });

  const scheduleTx = await gameRegistry.connect(gameDev).scheduleMatch(
    "lol-demo-001",
    "match-demo-001",
    futureTime,
    matchMetadata
  );

  const scheduleReceipt = await scheduleTx.wait();
  const scheduleEvent = scheduleReceipt.logs.find(log => {
    try {
      return gameRegistry.interface.parseLog(log).name === "MatchScheduled";
    } catch {
      return false;
    }
  });

  const matchId = gameRegistry.interface.parseLog(scheduleEvent).args.matchId;
  console.log("✅ Match scheduled");
  console.log("   Match ID:      ", matchId);
  console.log("   Scheduled Time:", new Date(futureTime * 1000).toISOString());
  console.log("   Metadata:      ", matchMetadata);
  console.log();

  console.log("=".repeat(80));
  console.log("STEP 3: Create Prediction Market");
  console.log("=".repeat(80));

  const createMarketTx = await predictionMarket.createMarket(
    matchId,
    "Who will win: TSM vs C9 in LCS Spring 2025?"
  );

  const marketReceipt = await createMarketTx.wait();
  const marketEvent = marketReceipt.logs.find(log => {
    try {
      return predictionMarket.interface.parseLog(log).name === "MarketCreated";
    } catch {
      return false;
    }
  });

  const marketId = predictionMarket.interface.parseLog(marketEvent).args.marketId;
  console.log("✅ Prediction market created");
  console.log("   Market ID:", marketId);
  console.log();

  console.log("=".repeat(80));
  console.log("STEP 4: Place Bets (Before Match Starts)");
  console.log("=".repeat(80));

  const betAmount = hre.ethers.parseEther("0.1");

  const bet1Tx = await predictionMarket.connect(bettor).placeBet(
    marketId,
    0, // Team A (TSM)
    { value: betAmount }
  );
  await bet1Tx.wait();

  console.log("✅ Bet placed:");
  console.log("   Bettor:   ", bettor.address);
  console.log("   Outcome:  ", "Team A (TSM)");
  console.log("   Amount:   ", hre.ethers.formatEther(betAmount), "BNB");
  console.log();

  const [oddsA, oddsB, oddsDraw] = await predictionMarket.getMarketOdds(marketId);
  console.log("📊 Current Odds:");
  console.log("   Team A: ", oddsA.toString());
  console.log("   Team B: ", oddsB.toString());
  console.log("   Draw:   ", oddsDraw.toString());
  console.log();

  console.log("=".repeat(80));
  console.log("STEP 5: Fast Forward Time (Simulating Match Completion)");
  console.log("=".repeat(80));

  console.log("⏩ Advancing blockchain time by 1 hour...");
  await hre.network.provider.send("evm_increaseTime", [3700]);
  await hre.network.provider.send("evm_mine");
  console.log("✅ Time advanced");
  console.log();

  console.log("=".repeat(80));
  console.log("STEP 6: Game Developer Submits Result");
  console.log("=".repeat(80));

  const resultData = JSON.stringify({
    winner: "Team SoloMid",
    score: "2-1",
    duration: 2400,
    mvp: "Doublelift",
    firstBlood: "Team SoloMid",
    totalKills: 42
  });

  const submitTx = await oracleCore.connect(gameDev).submitResult(matchId, resultData);
  await submitTx.wait();

  console.log("✅ Result submitted");
  console.log("   Result:", resultData);
  console.log();

  const result = await oracleCore.results(matchId);
  const disputeDeadline = new Date(Number(result.disputeDeadline) * 1000);
  console.log("⏰ Dispute window ends:", disputeDeadline.toISOString());
  console.log("   (15 minutes from submission)");
  console.log();

  console.log("=".repeat(80));
  console.log("STEP 7: Wait for Dispute Window");
  console.log("=".repeat(80));

  console.log("⏩ Advancing time by 16 minutes (past dispute window)...");
  await hre.network.provider.send("evm_increaseTime", [16 * 60]);
  await hre.network.provider.send("evm_mine");
  console.log("✅ Dispute window passed");
  console.log();

  console.log("=".repeat(80));
  console.log("STEP 8: Finalize Result");
  console.log("=".repeat(80));

  const finalizeTx = await oracleCore.finalizeResult(matchId);
  await finalizeTx.wait();

  console.log("✅ Result finalized");

  const finalResult = await oracleCore.results(matchId);
  console.log("   Is Finalized:", finalResult.isFinalized);
  console.log("   Is Disputed: ", finalResult.isDisputed);
  console.log();

  console.log("=".repeat(80));
  console.log("STEP 9: Consumer Queries Result (Prediction Market)");
  console.log("=".repeat(80));

  // Register consumer
  const registerConsumerTx = await feeManager.connect(consumer).registerConsumer();
  await registerConsumerTx.wait();
  console.log("✅ Consumer registered:", consumer.address);

  // Query result (free tier)
  const [queriedData, queriedHash, isFinalized] = await feeManager
    .connect(consumer)
    .queryResult(matchId, { value: 0 });

  console.log("✅ Result queried from oracle");
  console.log("   Data:      ", queriedData);
  console.log("   Hash:      ", queriedHash);
  console.log("   Finalized: ", isFinalized);
  console.log();

  // Check free queries remaining
  const remainingFree = await feeManager.getRemainingFreeQueries(consumer.address);
  console.log("📊 Free queries remaining:", remainingFree.toString());
  console.log();

  console.log("=".repeat(80));
  console.log("STEP 10: Check Revenue Stats");
  console.log("=".repeat(80));

  const devRevenue = await feeManager.getDeveloperRevenue(gameDev.address);
  console.log("💰 Game Developer Revenue:");
  console.log("   Total Earned:       ", hre.ethers.formatEther(devRevenue.totalEarned), "BNB");
  console.log("   Pending Withdrawal: ", hre.ethers.formatEther(devRevenue.pendingWithdrawal), "BNB");
  console.log("   Query Count:        ", devRevenue.queryCount.toString());
  console.log();

  const gameStats = await gameRegistry.getGame("lol-demo-001");
  console.log("📈 Game Stats:");
  console.log("   Total Matches:   ", gameStats.totalMatches.toString());
  console.log("   Reputation Score:", gameStats.reputationScore.toString());
  console.log();

  const queryCount = await feeManager.getGameQueryCount("lol-demo-001");
  console.log("📊 Query Stats:");
  console.log("   Total Queries to Game:", queryCount.toString());
  console.log();

  console.log("=".repeat(80));
  console.log("✅ DEMO COMPLETE!");
  console.log("=".repeat(80));
  console.log("\n🎉 Successfully demonstrated complete gaming oracle flow:");
  console.log("   ✓ Game registration with stake");
  console.log("   ✓ Match scheduling");
  console.log("   ✓ Prediction market creation");
  console.log("   ✓ Betting on outcomes");
  console.log("   ✓ Result submission");
  console.log("   ✓ Fast dispute resolution (15 min)");
  console.log("   ✓ Oracle data consumption");
  console.log("   ✓ Revenue distribution");
  console.log("\n💡 Key Advantages Over UMA:");
  console.log("   • 15 min resolution vs 24-48 hours");
  console.log("   • Gaming-specific validation");
  console.log("   • Direct developer monetization");
  console.log("   • Free tier for adoption");
  console.log();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
