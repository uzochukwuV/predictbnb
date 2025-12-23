const hre = require("hardhat");

/**
 * Deploy complete RPS demo ecosystem
 * - Deploy core oracle infrastructure
 * - Deploy RockPaperScissors game
 * - Deploy RPSPredictionMarket
 * - Schedule sample matches
 * - Create prediction markets
 */

async function main() {
  console.log("\n" + "=".repeat(80));
  console.log("🎮 DEPLOYING ROCK-PAPER-SCISSORS DEMO");
  console.log("=".repeat(80) + "\n");

  const [deployer, player1, player2, bettor1, bettor2] = await hre.ethers.getSigners();

  console.log("Deployer:", deployer.address);
  
  console.log();

  // Configuration
  const MINIMUM_STAKE = hre.ethers.parseEther("0.1");
  const QUERY_FEE = hre.ethers.parseEther("0.003");
  const CHALLENGE_STAKE = hre.ethers.parseEther("0.2");

  // ============ Deploy Core Infrastructure ============

  console.log("📦 Deploying Core Infrastructure...\n");

  // 1. GameRegistry
  console.log("1️⃣  Deploying GameRegistry...");
  const GameRegistry = await hre.ethers.getContractFactory("GameRegistry");
  const gameRegistry = await hre.upgrades.deployProxy(
    GameRegistry,
    [MINIMUM_STAKE],
    { kind: "uups" }
  );
  await gameRegistry.waitForDeployment();
  const gameRegistryAddress = await gameRegistry.getAddress();
  console.log("✅ GameRegistry:", gameRegistryAddress);

  // 2. FeeManager
  console.log("\n2️⃣  Deploying FeeManager...");
  const FeeManager = await hre.ethers.getContractFactory("FeeManager");
  const feeManager = await hre.upgrades.deployProxy(
    FeeManager,
    [gameRegistryAddress, QUERY_FEE],
    { kind: "uups" }
  );
  await feeManager.waitForDeployment();
  const feeManagerAddress = await feeManager.getAddress();
  console.log("✅ FeeManager:", feeManagerAddress);

  // 3. OracleCore
  console.log("\n3️⃣  Deploying OracleCore...");
  const OracleCore = await hre.ethers.getContractFactory("OracleCore");
  const oracleCore = await hre.upgrades.deployProxy(
    OracleCore,
    [gameRegistryAddress, feeManagerAddress],
    { kind: "uups" }
  );
  await oracleCore.waitForDeployment();
  const oracleCoreAddress = await oracleCore.getAddress();
  console.log("✅ OracleCore:", oracleCoreAddress);

  // 4. DisputeResolver
  console.log("\n4️⃣  Deploying DisputeResolver...");
  const DisputeResolver = await hre.ethers.getContractFactory("DisputeResolver");
  const disputeResolver = await hre.upgrades.deployProxy(
    DisputeResolver,
    [gameRegistryAddress, oracleCoreAddress, feeManagerAddress, CHALLENGE_STAKE],
    { kind: "uups" }
  );
  await disputeResolver.waitForDeployment();
  const disputeResolverAddress = await disputeResolver.getAddress();
  console.log("✅ DisputeResolver:", disputeResolverAddress);

  // Connect contracts
  console.log("\n🔗 Connecting contract references...");
  await oracleCore.updateDisputeResolver(disputeResolverAddress);
  await gameRegistry.updateDisputeResolver(disputeResolverAddress);
  await gameRegistry.updateOracleCore(oracleCoreAddress);
  await feeManager.updateDisputeResolver(disputeResolverAddress);
  await feeManager.updateOracleCore(oracleCoreAddress);
  console.log("✅ All contracts connected");

  // ============ Deploy RPS Game ============

  console.log("\n\n" + "=".repeat(80));
  console.log("🎲 DEPLOYING ROCK-PAPER-SCISSORS GAME");
  console.log("=".repeat(80) + "\n");

  const RockPaperScissors = await hre.ethers.getContractFactory("RockPaperScissors");
  const rpsGame = await RockPaperScissors.deploy(gameRegistryAddress, oracleCoreAddress);
  await rpsGame.waitForDeployment();
  const rpsGameAddress = await rpsGame.getAddress();
  console.log("✅ RockPaperScissors:", rpsGameAddress);

  // Register game with oracle
  console.log("\n📝 Registering game with oracle...");
  await rpsGame.registerWithOracle({ value: MINIMUM_STAKE });
  const gameId = await rpsGame.gameId();
  console.log("✅ Game registered with ID:", gameId);

  // ============ Deploy Prediction Market ============

  console.log("\n\n" + "=".repeat(80));
  console.log("📊 DEPLOYING PREDICTION MARKET");
  console.log("=".repeat(80) + "\n");

  const RPSPredictionMarket = await hre.ethers.getContractFactory("RPSPredictionMarket");
  const predictionMarket = await RPSPredictionMarket.deploy(oracleCoreAddress, feeManagerAddress);
  await predictionMarket.waitForDeployment();
  const predictionMarketAddress = await predictionMarket.getAddress();
  console.log("✅ RPSPredictionMarket:", predictionMarketAddress);

  // Fund oracle balance for prediction market
  console.log("\n💰 Funding prediction market oracle balance...");
  await predictionMarket.fundOracleBalance({ value: hre.ethers.parseEther("0.1") });
  console.log("✅ Funded with 0.1 BNB");

  // ============ Schedule Sample Matches ============

  console.log("\n\n" + "=".repeat(80));
  console.log("🗓️  SCHEDULING SAMPLE MATCHES");
  console.log("=".repeat(80) + "\n");

  const now = Math.floor(Date.now() / 1000);
  const matches = [];

  // Schedule 3 matches
  for (let i = 1; i <= 3; i++) {
    const scheduledTime = now + (i * 60); // Each match 1 minute apart

    console.log(`\nMatch ${i}:`);
    console.log(`  Players: ${player1.address} vs ${player2.address}`);
    console.log(`  Scheduled: ${new Date(scheduledTime * 1000).toLocaleString()}`);

    const tx = await rpsGame.scheduleMatch(
      player1.address,
      player2.address,
      scheduledTime
    );
    const receipt = await tx.wait();

    const matchScheduledEvent = receipt.logs.find(
      log => log.fragment && log.fragment.name === "MatchScheduled"
    );
    const matchId = matchScheduledEvent.args.matchId;

    matches.push({ matchId, scheduledTime });
    console.log(`  ✅ Match ID: ${matchId}`);
  }

  // ============ Create Prediction Markets ============

  console.log("\n\n" + "=".repeat(80));
  console.log("📈 CREATING PREDICTION MARKETS");
  console.log("=".repeat(80) + "\n");

  const markets = [];

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const bettingDeadline = match.scheduledTime - 30; // Close 30 seconds before match

    console.log(`\nMarket ${i + 1}:`);
    console.log(`  Match ID: ${match.matchId}`);
    console.log(`  Betting closes: ${new Date(bettingDeadline * 1000).toLocaleString()}`);

    const tx = await predictionMarket.createMarket(
      match.matchId,
      gameId,
      player1.address,
      player2.address,
      bettingDeadline
    );
    const receipt = await tx.wait();

    const marketCreatedEvent = receipt.logs.find(
      log => log.fragment && log.fragment.name === "MarketCreated"
    );
    const marketId = marketCreatedEvent.args.marketId;

    markets.push({ marketId, matchId: match.matchId, bettingDeadline });
    console.log(`  ✅ Market ID: ${marketId}`);
  }

  // ============ Summary ============

  console.log("\n\n" + "=".repeat(80));
  console.log("🎉 DEPLOYMENT COMPLETE!");
  console.log("=".repeat(80));

  console.log("\n📋 Deployed Contracts:");
  console.log("  GameRegistry:        ", gameRegistryAddress);
  console.log("  FeeManager:          ", feeManagerAddress);
  console.log("  OracleCore:          ", oracleCoreAddress);
  console.log("  DisputeResolver:     ", disputeResolverAddress);
  console.log("  RockPaperScissors:   ", rpsGameAddress);
  console.log("  RPSPredictionMarket: ", predictionMarketAddress);

  console.log("\n🎮 Demo Matches:");
  matches.forEach((match, i) => {
    console.log(`  Match ${i + 1}: ${match.matchId}`);
  });

  console.log("\n📊 Demo Markets:");
  markets.forEach((market, i) => {
    console.log(`  Market ${i + 1}: ID ${market.marketId} for Match ${market.matchId}`);
  });

  console.log("\n\n" + "=".repeat(80));
  console.log("🚀 NEXT STEPS FOR DEMO");
  console.log("=".repeat(80));

  console.log("\n1️⃣  Place bets on prediction markets:");
  console.log("   await predictionMarket.connect(bettor1).placeBet(0, player1.address, { value: ethers.parseEther('0.01') })");

  console.log("\n2️⃣  Players commit to matches:");
  console.log("   await rpsGame.connect(player1).commitToMatch(matchId)");
  console.log("   await rpsGame.connect(player2).commitToMatch(matchId)");

  console.log("\n3️⃣  Wait for oracle to finalize result:");
  console.log("   await time.increase(900) // 15 minutes");

  console.log("\n4️⃣  Resolve prediction market:");
  console.log("   await predictionMarket.resolveMarket(marketId)");

  console.log("\n5️⃣  Winners claim prizes:");
  console.log("   await predictionMarket.connect(winner).claimWinnings(marketId)");

  console.log("\n" + "=".repeat(80) + "\n");

  // Save deployment info
  const deploymentInfo = {
    network: hre.network.name,
    timestamp: new Date().toISOString(),
    contracts: {
      gameRegistry: gameRegistryAddress,
      feeManager: feeManagerAddress,
      oracleCore: oracleCoreAddress,
      disputeResolver: disputeResolverAddress,
      rpsGame: rpsGameAddress,
      predictionMarket: predictionMarketAddress
    },
    demo: {
      matches: matches.map((m, i) => ({ id: i + 1, matchId: m.matchId, scheduledTime: m.scheduledTime })),
      markets: markets.map((m, i) => ({ id: i + 1, marketId: m.marketId.toString(), matchId: m.matchId }))
    },
    accounts: {
      deployer: deployer.address,
      player1: player1.address,
      player2: player2.address,
      bettor1: bettor1.address,
      bettor2: bettor2.address
    }
  };

  const fs = require("fs");
  const path = require("path");
  const deploymentsDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  const filename = `rps-demo-${hre.network.name}-${Date.now()}.json`;
  const filepath = path.join(deploymentsDir, filename);
  fs.writeFileSync(filepath, JSON.stringify(deploymentInfo, null, 2));

  console.log("📄 Deployment info saved to:", filepath);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
