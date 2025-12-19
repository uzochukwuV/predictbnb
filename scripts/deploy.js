const hre = require("hardhat");
const { upgrades } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("🚀 Deploying PredictBNB Gaming Oracle Infrastructure...\n");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", hre.ethers.formatEther(balance), "BNB\n");

  // Configuration
  const MINIMUM_STAKE = hre.ethers.parseEther("0.1"); // 0.1 BNB
  const QUERY_FEE = hre.ethers.parseEther("0.003"); // 0.003 BNB (~$1.80 at $600/BNB)
  const CHALLENGE_STAKE = hre.ethers.parseEther("0.2"); // 0.2 BNB

  // 1. Deploy GameRegistry (UUPS Proxy)
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
  console.log("   Minimum stake:", hre.ethers.formatEther(MINIMUM_STAKE), "BNB");

  // 2. Deploy FeeManager (UUPS Proxy)
  console.log("\n💰 Deploying FeeManager (UUPS Proxy)...");
  const FeeManager = await hre.ethers.getContractFactory("FeeManager");
  const feeManager = await upgrades.deployProxy(
    FeeManager,
    [gameRegistryAddress, QUERY_FEE],
    { kind: "uups" }
  );
  await feeManager.waitForDeployment();
  const feeManagerAddress = await feeManager.getAddress();
  console.log("✅ FeeManager deployed to:", feeManagerAddress);
  console.log("   Query fee:", hre.ethers.formatEther(QUERY_FEE), "BNB");

  // 3. Deploy OracleCore (UUPS Proxy)
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

  // 4. Deploy DisputeResolver (UUPS Proxy)
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
  console.log("   Challenge stake:", hre.ethers.formatEther(CHALLENGE_STAKE), "BNB");

  // 5. Deploy SimplePredictionMarket (Example)
  console.log("\n🎲 Deploying SimplePredictionMarket (Example)...");
  const SimplePredictionMarket = await hre.ethers.getContractFactory("SimplePredictionMarket");
  const predictionMarket = await SimplePredictionMarket.deploy(
    oracleCoreAddress,
    feeManagerAddress
  );
  await predictionMarket.waitForDeployment();
  const predictionMarketAddress = await predictionMarket.getAddress();
  console.log("✅ SimplePredictionMarket deployed to:", predictionMarketAddress);

  // Summary
  console.log("\n" + "=".repeat(80));
  console.log("🎉 DEPLOYMENT COMPLETE!");
  console.log("=".repeat(80));
  console.log("\nContract Addresses:");
  console.log("-------------------");
  console.log("GameRegistry:          ", gameRegistryAddress);
  console.log("FeeManager:            ", feeManagerAddress);
  console.log("OracleCore:            ", oracleCoreAddress);
  console.log("DisputeResolver:       ", disputeResolverAddress);
  console.log("SimplePredictionMarket:", predictionMarketAddress);
  console.log("\nConfiguration:");
  console.log("--------------");
  console.log("Minimum Game Stake:    ", hre.ethers.formatEther(MINIMUM_STAKE), "BNB");
  console.log("Query Fee:             ", hre.ethers.formatEther(QUERY_FEE), "BNB");
  console.log("Challenge Stake:       ", hre.ethers.formatEther(CHALLENGE_STAKE), "BNB");
  console.log("Free Tier:             ", "50 queries/day");
  console.log("Dispute Window:        ", "15 minutes");
  console.log("Revenue Split:         ", "80% dev / 15% protocol / 5% disputers");

  // Save deployment addresses
  const deploymentInfo = {
    network: hre.network.name,
    chainId: (await hre.ethers.provider.getNetwork()).chainId.toString(),
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: {
      GameRegistry: gameRegistryAddress,
      FeeManager: feeManagerAddress,
      OracleCore: oracleCoreAddress,
      DisputeResolver: disputeResolverAddress,
      SimplePredictionMarket: predictionMarketAddress
    },
    configuration: {
      minimumStake: hre.ethers.formatEther(MINIMUM_STAKE) + " BNB",
      queryFee: hre.ethers.formatEther(QUERY_FEE) + " BNB",
      challengeStake: hre.ethers.formatEther(CHALLENGE_STAKE) + " BNB",
      disputeWindow: "15 minutes",
      freeTier: "50 queries/day",
      revenueplit: "80% dev / 15% protocol / 5% disputers"
    }
  };

  // Create deployments directory if it doesn't exist
  const deploymentsDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  // Save deployment info
  const filename = `deployment-${hre.network.name}-${Date.now()}.json`;
  const filepath = path.join(deploymentsDir, filename);
  fs.writeFileSync(filepath, JSON.stringify(deploymentInfo, null, 2));

  console.log("\n📄 Deployment info saved to:", filepath);

  console.log("\n📚 Next Steps:");
  console.log("1. Verify contracts on BSCScan (for proxy contracts use proxy address)");
  console.log("2. Set up dispute resolvers: disputeResolver.addResolver(address)");
  console.log("3. Test the deployment:");
  console.log("   - Register a game (0.1 BNB stake)");
  console.log("   - Schedule a match");
  console.log("   - Submit result with self-describing data");
  console.log("   - Query oracle via prediction market");
  console.log("4. Update frontend with contract addresses");
  console.log("5. Start developer onboarding program");
  console.log("\n" + "=".repeat(80) + "\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
