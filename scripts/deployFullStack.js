/**
 * Full Stack Deployment Script
 * Deploys:
 * - Core infrastructure (GameRegistry, OracleCore, FeeManagerV2, DisputeResolver, PredictToken)
 * - RockPaperScissors game + RPSPredictionMarket
 * - VirtualFootballGame + VirtualFootballMarket
 */

const hre = require("hardhat");
const { upgrades } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log("🚀 Deploying PredictBNB Full Stack (All Games + Markets)...\n");

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
  await sleep(5000);

  // 2. Deploy PredictToken (ERC-20 for airdrops)
  console.log("\n🪙 Deploying PredictToken...");
  const PredictToken = await hre.ethers.getContractFactory("PredictToken");
  const predictToken = await PredictToken.deploy();
  await predictToken.waitForDeployment();
  const predictTokenAddress = await predictToken.getAddress();
  console.log("✅ PredictToken deployed to:", predictTokenAddress);
  await sleep(5000);

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
  await sleep(5000);

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
  await sleep(5000);

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
  await sleep(5000);

  // ============ Connect all contracts ============
  console.log("\n🔗 Connecting contract references...");
  await oracleCore.updateDisputeResolver(disputeResolverAddress);
  await gameRegistry.updateDisputeResolver(disputeResolverAddress);
  await gameRegistry.updateOracleCore(oracleCoreAddress);
  await feeManager.updateDisputeResolver(disputeResolverAddress);
  await feeManager.updateOracleCore(oracleCoreAddress);
  await predictToken.setFeeManager(feeManagerAddress);
  console.log("✅ All contracts connected");
  await sleep(5000);

  // ============ Fund Incentive Pools ============
  console.log("\n💸 Funding incentive pools...");

  // Fund marketing budget for referrals
  const marketingFunding = hre.ethers.parseEther("0.001");
  await feeManager.fundMarketingBudget({ value: marketingFunding });
  console.log("✅ Marketing budget funded:", hre.ethers.formatEther(marketingFunding), "BNB");

  // Fund streak reward pool
  const streakFunding = hre.ethers.parseEther("0.0005");
  await feeManager.fundStreakRewardPool({ value: streakFunding });
  console.log("✅ Streak reward pool funded:", hre.ethers.formatEther(streakFunding), "BNB");
  await sleep(5000);

  // ============ Deploy RPS Game Contracts ============

  // 6. Deploy RockPaperScissors
  console.log("\n🎮 Deploying RockPaperScissors game...");
  const RockPaperScissors = await hre.ethers.getContractFactory("RockPaperScissors");
  const rpsGame = await RockPaperScissors.deploy(gameRegistryAddress, oracleCoreAddress);
  await rpsGame.waitForDeployment();
  const rpsGameAddress = await rpsGame.getAddress();
  console.log("✅ RockPaperScissors deployed to:", rpsGameAddress);

  // Register RPS game with oracle
  console.log("\n📋 Registering RPS game with oracle...");
  let rpsGameId;
  try {
    const registerTx = await rpsGame.registerWithOracle({ value: MINIMUM_STAKE });
    await registerTx.wait();
    rpsGameId = await rpsGame.gameId();
    console.log("✅ RPS Game registered with ID:", rpsGameId);
  } catch (error) {
    console.error("❌ Failed to register RPS game:", error.message);
    process.exit(1);
  }
  await sleep(5000);

  // 7. Deploy RPSPredictionMarket
  console.log("\n📊 Deploying RPSPredictionMarket...");
  const RPSPredictionMarket = await hre.ethers.getContractFactory("RPSPredictionMarket");
  const rpsPredictionMarket = await RPSPredictionMarket.deploy(oracleCoreAddress, feeManagerAddress);
  await rpsPredictionMarket.waitForDeployment();
  const rpsPredictionMarketAddress = await rpsPredictionMarket.getAddress();
  console.log("✅ RPSPredictionMarket deployed to:", rpsPredictionMarketAddress);
  await sleep(5000);

  // ============ Deploy Virtual Football Contracts ============

  // 8. Deploy VirtualFootballGame
  console.log("\n⚽ Deploying VirtualFootballGame...");
  const VirtualFootballGame = await hre.ethers.getContractFactory("VirtualFootballGame");
  const vfGame = await VirtualFootballGame.deploy(oracleCoreAddress, gameRegistryAddress);
  await vfGame.waitForDeployment();
  const vfGameAddress = await vfGame.getAddress();
  console.log("✅ VirtualFootballGame deployed to:", vfGameAddress);

  // Register VF game with oracle
  console.log("\n📋 Registering VirtualFootball game with oracle...");
  let vfGameId;
  try {
    const registerTx = await vfGame.registerGame({ value: MINIMUM_STAKE });
    await registerTx.wait();
    vfGameId = await vfGame.gameId();
    console.log("✅ VF Game registered with ID:", vfGameId);
  } catch (error) {
    console.error("❌ Failed to register VF game:", error.message);
    process.exit(1);
  }
  await sleep(5000);

  // 9. Deploy VirtualFootballMarket
  console.log("\n📊 Deploying VirtualFootballMarket...");
  const VirtualFootballMarket = await hre.ethers.getContractFactory("VirtualFootballMarket");
  const vfMarket = await VirtualFootballMarket.deploy(vfGameAddress, oracleCoreAddress, feeManagerAddress);
  await vfMarket.waitForDeployment();
  const vfMarketAddress = await vfMarket.getAddress();
  console.log("✅ VirtualFootballMarket deployed to:", vfMarketAddress);
  await sleep(5000);

  // ============ Save Deployment Information ============

  const deploymentInfo = {
    network: hre.network.name,
    chainId: (await hre.ethers.provider.getNetwork()).chainId.toString(),
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    version: "3.0.0",
    contracts: {
      core: {
        GameRegistry: gameRegistryAddress,
        OracleCore: oracleCoreAddress,
        FeeManagerV2: feeManagerAddress,
        DisputeResolver: disputeResolverAddress,
        PredictToken: predictTokenAddress
      },
      games: {
        RockPaperScissors: rpsGameAddress,
        VirtualFootballGame: vfGameAddress
      },
      markets: {
        RPSPredictionMarket: rpsPredictionMarketAddress,
        VirtualFootballMarket: vfMarketAddress
      }
    },
    gameIds: {
      RockPaperScissors: rpsGameId,
      VirtualFootballGame: vfGameId
    },
    configuration: {
      minimumStake: hre.ethers.formatEther(MINIMUM_STAKE) + " BNB",
      queryFee: hre.ethers.formatEther(QUERY_FEE) + " BNB (~$2.00)",
      challengeStake: hre.ethers.formatEther(CHALLENGE_STAKE) + " BNB",
      disputeWindow: "15 minutes",
      freeTrialLimit: 5,
      developerPremiumMax: "30%",
      platformFee: "2-5% (varies by market)",
      revenueShare: "80% dev / 15% protocol / 5% disputers"
    },
    features: [
      "UUPS upgradeable core contracts",
      "RPS 1v1 card game with verifiable randomness",
      "Virtual Football automated league (10 teams, 20 matches/season)",
      "Parimutuel prediction markets",
      "Oracle-based result resolution",
      "Free season voting (VF)",
      "Tipster system (VF)",
      "Referral program + streak rewards",
      "PREDICT token airdrops"
    ],
    incentivePools: {
      marketingBudget: hre.ethers.formatEther(marketingFunding) + " BNB",
      streakRewardPool: hre.ethers.formatEther(streakFunding) + " BNB"
    }
  };

  // Create deployments directory
  const deploymentsDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  // Save deployment info
  const filename = `deployment-fullstack-${hre.network.name}-${Date.now()}.json`;
  const filepath = path.join(deploymentsDir, filename);
  fs.writeFileSync(filepath, JSON.stringify(deploymentInfo, null, 2));
  console.log("\n📄 Deployment info saved to:", filepath);

  // ============ Generate Frontend .env.local ============

  console.log("\n📝 Generating frontend .env.local file...");
  const envContent = `# Contract Addresses - Deployed on ${hre.network.name}
# Generated on ${new Date().toISOString()}

# RPS Contracts
NEXT_PUBLIC_RPS_CONTRACT_ADDRESS=${rpsGameAddress}
NEXT_PUBLIC_RPS_PREDICTION_MARKET_ADDRESS=${rpsPredictionMarketAddress}

# Virtual Football Contracts
NEXT_PUBLIC_VIRTUAL_FOOTBALL_GAME_ADDRESS=${vfGameAddress}
NEXT_PUBLIC_VIRTUAL_FOOTBALL_MARKET_ADDRESS=${vfMarketAddress}

# Core Oracle Contracts
NEXT_PUBLIC_ORACLE_CORE_ADDRESS=${oracleCoreAddress}
NEXT_PUBLIC_GAME_REGISTRY_ADDRESS=${gameRegistryAddress}
NEXT_PUBLIC_FEE_MANAGER_ADDRESS=${feeManagerAddress}
NEXT_PUBLIC_PREDICT_TOKEN_ADDRESS=${predictTokenAddress}

# Network
NEXT_PUBLIC_CHAIN_ID=${(await hre.ethers.provider.getNetwork()).chainId}

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
  console.log("🎉 FULL STACK DEPLOYMENT COMPLETE!");
  console.log("=".repeat(80));

  console.log("\n📦 Core Infrastructure:");
  console.log("-------------------");
  console.log("GameRegistry:       ", gameRegistryAddress);
  console.log("OracleCore:         ", oracleCoreAddress);
  console.log("FeeManagerV2:       ", feeManagerAddress);
  console.log("DisputeResolver:    ", disputeResolverAddress);
  console.log("PredictToken:       ", predictTokenAddress);

  console.log("\n🎮 RPS Game:");
  console.log("-------------------");
  console.log("RockPaperScissors:  ", rpsGameAddress);
  console.log("  └─ Game ID:       ", rpsGameId);
  console.log("RPSPredictionMarket:", rpsPredictionMarketAddress);

  console.log("\n⚽ Virtual Football:");
  console.log("-------------------");
  console.log("VirtualFootballGame:", vfGameAddress);
  console.log("  └─ Game ID:       ", vfGameId);
  console.log("VirtualFootballMarket:", vfMarketAddress);

  console.log("\n⚙️  Configuration:");
  console.log("-------------------");
  console.log("Minimum Stake:      ", hre.ethers.formatEther(MINIMUM_STAKE), "BNB");
  console.log("Query Fee:          ", hre.ethers.formatEther(QUERY_FEE), "BNB");
  console.log("Challenge Stake:    ", hre.ethers.formatEther(CHALLENGE_STAKE), "BNB");

  console.log("\n📚 Next Steps:");
  console.log("-------------------");

  console.log("\n1. Export ABIs to frontend:");
  console.log("   npm run export-abis");

  console.log("\n2. Start automation bot for Virtual Football:");
  console.log("   VIRTUAL_FOOTBALL_GAME_ADDRESS=" + vfGameAddress + " \\");
  console.log("   AUTO_CREATE_SEASONS=true \\");
  console.log("   npx hardhat run scripts/automateVirtualFootball.js --network " + hre.network.name);

  console.log("\n3. Start frontend development server:");
  console.log("   cd frontend && npm run dev");

  console.log("\n4. Test workflows:");
  console.log("   - RPS: Schedule match → Place bets → Play → Resolve → Claim");
  console.log("   - VF: Create season → Vote (FREE) → Bet on matches → Simulate → Claim");

  console.log("\n" + "=".repeat(80) + "\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
