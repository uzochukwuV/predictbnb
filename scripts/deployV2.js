const hre = require("hardhat");
const { upgrades } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("🚀 Deploying PredictBNB Full Stack (Oracle + RPS Game + Prediction Market)...\n");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", hre.ethers.formatEther(balance), "BNB\n");

  // Configuration
  const MINIMUM_STAKE = hre.ethers.parseEther("0.1"); // 0.1 BNB
  const QUERY_FEE = hre.ethers.parseEther("0.00416"); // 0.00416 BNB (~$2.00 at $480/BNB)
  const CHALLENGE_STAKE = hre.ethers.parseEther("0.2"); // 0.2 BNB

  // ============ Deploy Core Infrastructure (UUPS Proxies) ============

  // 1. Deploy GameRegistry
  console.log("📝 Deploying GameRegistry (UUPS Proxy)...");
  const GameRegistry = await hre.ethers.getContractFactory("GameRegistry");
  const gameRegistry = await upgrades.deployProxy(
    GameRegistry,
    [MINIMUM_STAKE],
    { kind: "uups" }
  );
  await gameRegistry.waitForDeployment();
  const gameRegistryAddress = await gameRegistry.getAddress();
  console.log("✅ GameRegistry deployed to:", gameRegistryAddress);

  // 2. Deploy PredictToken (ERC-20 for airdrops)
  console.log("\n🪙 Deploying PredictToken...");
  const PredictToken = await hre.ethers.getContractFactory("PredictToken");
  const predictToken = await PredictToken.deploy();
  await predictToken.waitForDeployment();
  const predictTokenAddress = await predictToken.getAddress();
  console.log("✅ PredictToken deployed to:", predictTokenAddress);

  // 3. Deploy FeeManagerV2 (Enhanced with incentives)
  console.log("\n💰 Deploying FeeManagerV2 (UUPS Proxy)...");
  const FeeManagerV2 = await hre.ethers.getContractFactory("FeeManagerV2");
  const feeManager = await upgrades.deployProxy(
    FeeManagerV2,
    [gameRegistryAddress, QUERY_FEE],
    { kind: "uups" }
  );
  await feeManager.waitForDeployment();
  const feeManagerAddress = await feeManager.getAddress();
  console.log("✅ FeeManagerV2 deployed to:", feeManagerAddress);

  // 4. Deploy OracleCore
  console.log("\n🔮 Deploying OracleCore (UUPS Proxy)...");
  const OracleCore = await hre.ethers.getContractFactory("OracleCore");
  const oracleCore = await upgrades.deployProxy(
    OracleCore,
    [gameRegistryAddress, feeManagerAddress],
    { kind: "uups" }
  );
  await oracleCore.waitForDeployment();
  const oracleCoreAddress = await oracleCore.getAddress();
  console.log("✅ OracleCore deployed to:", oracleCoreAddress);

  // 5. Deploy DisputeResolver
  console.log("\n⚖️  Deploying DisputeResolver (UUPS Proxy)...");
  const DisputeResolver = await hre.ethers.getContractFactory("DisputeResolver");
  const disputeResolver = await upgrades.deployProxy(
    DisputeResolver,
    [gameRegistryAddress, oracleCoreAddress, feeManagerAddress, CHALLENGE_STAKE],
    { kind: "uups" }
  );
  await disputeResolver.waitForDeployment();
  const disputeResolverAddress = await disputeResolver.getAddress();
  console.log("✅ DisputeResolver deployed to:", disputeResolverAddress);

  // ============ Connect all contracts ============
  console.log("\n🔗 Connecting contract references...");
  await oracleCore.updateDisputeResolver(disputeResolverAddress);
  await gameRegistry.updateDisputeResolver(disputeResolverAddress);
  await gameRegistry.updateOracleCore(oracleCoreAddress);
  await feeManager.updateDisputeResolver(disputeResolverAddress);
  await feeManager.updateOracleCore(oracleCoreAddress);

  // Connect PredictToken to FeeManagerV2
  await predictToken.setFeeManager(feeManagerAddress);
  console.log("✅ All contracts connected");

  // ============ Fund Incentive Pools ============
  console.log("\n💸 Funding incentive pools...");

  // Fund marketing budget for referrals (10 BNB)
  const marketingFunding = hre.ethers.parseEther("10");
  await feeManager.fundMarketingBudget({ value: marketingFunding });
  console.log("✅ Marketing budget funded with 10 BNB");

  // Fund streak reward pool (5 BNB)
  const streakFunding = hre.ethers.parseEther("5");
  await feeManager.fundStreakRewardPool({ value: streakFunding });
  console.log("✅ Streak reward pool funded with 5 BNB");

  // ============ Deploy Game Contracts ============

  // 6. Deploy RockPaperScissors
  console.log("\n🎮 Deploying RockPaperScissors game...");
  const RockPaperScissors = await hre.ethers.getContractFactory("RockPaperScissors");
  const rpsGame = await RockPaperScissors.deploy(gameRegistryAddress, oracleCoreAddress);
  await rpsGame.waitForDeployment();
  const rpsGameAddress = await rpsGame.getAddress();
  console.log("✅ RockPaperScissors deployed to:", rpsGameAddress);

  // Register RPS game with oracle (requires 0.1 BNB stake)
  console.log("\n📋 Registering RPS game with oracle...");
  let gameId;
  try {
    const registerTx = await rpsGame.registerWithOracle({ value: MINIMUM_STAKE });
    await registerTx.wait();
    gameId = await rpsGame.gameId();
    console.log("✅ RPS Game registered with ID:", gameId);
  } catch (error) {
    console.error("❌ Failed to register RPS game with oracle:", error.message);
    process.exit(1);
  }

  // ============ Deploy Prediction Market ============

  // 7. Deploy RPSPredictionMarket
  console.log("\n📊 Deploying RPSPredictionMarket...");
  const RPSPredictionMarket = await hre.ethers.getContractFactory("RPSPredictionMarket");
  const predictionMarket = await RPSPredictionMarket.deploy(oracleCoreAddress, feeManagerAddress);
  await predictionMarket.waitForDeployment();
  const predictionMarketAddress = await predictionMarket.getAddress();
  console.log("✅ RPSPredictionMarket deployed to:", predictionMarketAddress);

  // ============ Save Deployment Information ============

  const deploymentInfo = {
    network: hre.network.name,
    chainId: (await hre.ethers.provider.getNetwork()).chainId.toString(),
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    version: "2.0.0",
    contracts: {
      core: {
        GameRegistry: gameRegistryAddress,
        OracleCore: oracleCoreAddress,
        FeeManagerV2: feeManagerAddress,
        DisputeResolver: disputeResolverAddress,
        PredictToken: predictTokenAddress
      },
      games: {
        RockPaperScissors: rpsGameAddress
      },
      markets: {
        RPSPredictionMarket: predictionMarketAddress
      }
    },
    gameIds: {
      RockPaperScissors: gameId
    },
    configuration: {
      minimumStake: hre.ethers.formatEther(MINIMUM_STAKE) + " BNB",
      queryFee: hre.ethers.formatEther(QUERY_FEE) + " BNB (~$2.00)",
      challengeStake: hre.ethers.formatEther(CHALLENGE_STAKE) + " BNB",
      disputeWindow: "15 minutes",
      freeTrialLimit: 5,
      developerPremiumMax: "30%",
      platformFee: "2% (200 basis points)",
      revenueplit: "80% dev / 15% protocol / 5% disputers"
    },
    features: [
      "UUPS upgradeable core contracts",
      "On-chain RPS game with verifiable randomness",
      "Parimutuel prediction market",
      "Oracle-based result resolution",
      "Prepaid query balances with volume bonuses",
      "15-minute dispute window",
      "Free trial: 5 unique matches (lifetime)",
      "Per-consumer per-match payment (subsequent queries FREE)",
      "Dynamic pricing: Developer premium (0-30%)",
      "Tipping system (100% to developers)",
      "Referral program (20% referee, 10% referrer)",
      "Streak rewards (7/14/30/60/90 days)",
      "Lucky draw lottery (weekly prizes)",
      "Developer launch bonus (first 100 games)",
      "PREDICT token airdrops"
    ],
    incentivePools: {
      marketingBudget: "10 BNB (for referrals)",
      streakRewardPool: "5 BNB (for daily streaks)"
    }
  };

  // Create deployments directory
  const deploymentsDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  // Save deployment info
  const filename = `deployment-v2-${hre.network.name}-${Date.now()}.json`;
  const filepath = path.join(deploymentsDir, filename);
  fs.writeFileSync(filepath, JSON.stringify(deploymentInfo, null, 2));

  console.log("\n📄 Deployment info saved to:", filepath);

  // ============ Generate Frontend .env.local ============

  console.log("\n📝 Generating frontend .env.local file...");
  const envContent = `# Contract Addresses - Deployed on ${hre.network.name}
# Generated on ${new Date().toISOString()}

# RPS Game Contract
NEXT_PUBLIC_RPS_CONTRACT_ADDRESS=${rpsGameAddress}

# Prediction Market Contract
NEXT_PUBLIC_PREDICTION_MARKET_ADDRESS=${predictionMarketAddress}

# Core Oracle Contracts
NEXT_PUBLIC_ORACLE_CORE_ADDRESS=${oracleCoreAddress}
NEXT_PUBLIC_GAME_REGISTRY_ADDRESS=${gameRegistryAddress}
NEXT_PUBLIC_FEE_MANAGER_ADDRESS=${feeManagerAddress}
NEXT_PUBLIC_PREDICT_TOKEN_ADDRESS=${predictTokenAddress}

# WalletConnect Project ID (get from https://cloud.walletconnect.com/)
NEXT_PUBLIC_WC_PROJECT_ID=your_project_id_here

# Optional: RPC URLs (defaults to public RPCs if not set)
NEXT_PUBLIC_BSC_TESTNET_RPC=https://data-seed-prebsc-1-s1.binance.org:8545
NEXT_PUBLIC_BSC_MAINNET_RPC=https://bsc-dataseed.binance.org/
`;

  const envPath = path.join(__dirname, "..", "frontend", ".env.local");
  fs.writeFileSync(envPath, envContent);
  console.log("✅ Frontend .env.local created at:", envPath);

  // ============ Summary Output ============

  console.log("\n" + "=".repeat(80));
  console.log("🎉 DEPLOYMENT COMPLETE!");
  console.log("=".repeat(80));

  console.log("\n📦 Core Infrastructure:");
  console.log("-------------------");
  console.log("GameRegistry:       ", gameRegistryAddress);
  console.log("OracleCore:         ", oracleCoreAddress);
  console.log("FeeManagerV2:       ", feeManagerAddress);
  console.log("DisputeResolver:    ", disputeResolverAddress);
  console.log("PredictToken:       ", predictTokenAddress);

  console.log("\n🎮 Game Contracts:");
  console.log("-------------------");
  console.log("RockPaperScissors:  ", rpsGameAddress);
  console.log("  └─ Game ID:       ", gameId);

  console.log("\n📊 Prediction Markets:");
  console.log("-------------------");
  console.log("RPSPredictionMarket:", predictionMarketAddress);

  console.log("\n⚙️  Configuration:");
  console.log("-------------------");
  console.log("Minimum Stake:      ", hre.ethers.formatEther(MINIMUM_STAKE), "BNB");
  console.log("Query Fee:          ", hre.ethers.formatEther(QUERY_FEE), "BNB (~$2.00)");
  console.log("Challenge Stake:    ", hre.ethers.formatEther(CHALLENGE_STAKE), "BNB");
  console.log("Free Trial:         ", "5 matches (lifetime)");
  console.log("Developer Premium:  ", "0-30% markup");
  console.log("Dispute Window:     ", "15 minutes");
  console.log("Platform Fee:       ", "2% (prediction market)");
  console.log("Revenue Split:      ", "80% dev / 15% protocol / 5% disputers");

  console.log("\n🎁 Incentive Systems:");
  console.log("-------------------");
  console.log("Marketing Budget:   ", hre.ethers.formatEther(marketingFunding), "BNB (referrals)");
  console.log("Streak Pool:        ", hre.ethers.formatEther(streakFunding), "BNB (daily rewards)");
  console.log("Referral Bonus:     ", "20% referee / 10% referrer (one-time)");
  console.log("Streak Rewards:     ", "7/14/30/60/90 days tiers");
  console.log("Lucky Draw:         ", "Weekly lottery (1% of query fees)");
  console.log("Launch Bonus:       ", "First 100 games get 90% for 90 days");
  console.log("PREDICT Tokens:     ", "1B total (40% airdrop allocation)");

  console.log("\n📚 Next Steps:");
  console.log("-------------------");

  console.log("\n1. Export ABIs to frontend:");
  console.log("   node scripts/export-abis.js");

  console.log("\n2. Update WalletConnect Project ID:");
  console.log("   - Visit https://cloud.walletconnect.com/");
  console.log("   - Update NEXT_PUBLIC_WC_PROJECT_ID in frontend/.env.local");

  console.log("\n3. Verify contracts on BSCScan:");
  console.log(`   npx hardhat verify --network ${hre.network.name} ${rpsGameAddress} ${gameRegistryAddress} ${oracleCoreAddress}`);
  console.log(`   npx hardhat verify --network ${hre.network.name} ${predictionMarketAddress} ${oracleCoreAddress} ${feeManagerAddress}`);
  console.log("   Note: Use proxy addresses for upgradeable contracts");

  console.log("\n4. Fund prediction market for oracle queries:");
  console.log("   - Connect wallet to frontend");
  console.log("   - Use fundOracleBalance() to deposit BNB for queries");

  console.log("\n5. Test the full workflow:");
  console.log("   a. Schedule an RPS match (owner only)");
  console.log("   b. Create a prediction market for the match");
  console.log("   c. Users place bets");
  console.log("   d. Players commit to match (after scheduled time)");
  console.log("   e. Resolve prediction market using oracle data");
  console.log("   f. Winners claim their winnings");

  console.log("\n6. Start frontend development server:");
  console.log("   cd frontend && npm run dev");

  console.log("\n" + "=".repeat(80) + "\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
