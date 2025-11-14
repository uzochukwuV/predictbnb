const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("🚀 Deploying Gaming Oracle Infrastructure to BNB Chain...\n");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", hre.ethers.formatEther(balance), "BNB\n");

  // Deploy GameRegistry
  console.log("📝 Deploying GameRegistry...");
  const GameRegistry = await hre.ethers.getContractFactory("GameRegistry");
  const gameRegistry = await GameRegistry.deploy();
  await gameRegistry.waitForDeployment();
  const gameRegistryAddress = await gameRegistry.getAddress();
  console.log("✅ GameRegistry deployed to:", gameRegistryAddress);

  // Deploy OracleCore
  console.log("\n📝 Deploying OracleCore...");
  const OracleCore = await hre.ethers.getContractFactory("OracleCore");
  const oracleCore = await OracleCore.deploy(gameRegistryAddress);
  await oracleCore.waitForDeployment();
  const oracleCoreAddress = await oracleCore.getAddress();
  console.log("✅ OracleCore deployed to:", oracleCoreAddress);

  // Deploy FeeManager
  console.log("\n📝 Deploying FeeManager...");
  const FeeManager = await hre.ethers.getContractFactory("FeeManager");
  const feeManager = await FeeManager.deploy(gameRegistryAddress, oracleCoreAddress);
  await feeManager.waitForDeployment();
  const feeManagerAddress = await feeManager.getAddress();
  console.log("✅ FeeManager deployed to:", feeManagerAddress);

  // Deploy ExamplePredictionMarket
  console.log("\n📝 Deploying ExamplePredictionMarket...");
  const ExamplePredictionMarket = await hre.ethers.getContractFactory("ExamplePredictionMarket");
  const predictionMarket = await ExamplePredictionMarket.deploy(feeManagerAddress, gameRegistryAddress);
  await predictionMarket.waitForDeployment();
  const predictionMarketAddress = await predictionMarket.getAddress();
  console.log("✅ ExamplePredictionMarket deployed to:", predictionMarketAddress);

  // Transfer GameRegistry ownership to OracleCore
  console.log("\n🔐 Transferring GameRegistry ownership to OracleCore...");
  await gameRegistry.transferOwnership(oracleCoreAddress);
  console.log("✅ Ownership transferred");

  // Save deployment addresses
  const deploymentInfo = {
    network: hre.network.name,
    chainId: (await hre.ethers.provider.getNetwork()).chainId.toString(),
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: {
      GameRegistry: gameRegistryAddress,
      OracleCore: oracleCoreAddress,
      FeeManager: feeManagerAddress,
      ExamplePredictionMarket: predictionMarketAddress
    },
    constants: {
      REGISTRATION_STAKE: "0.1 BNB",
      DISPUTE_STAKE: "0.2 BNB",
      DISPUTE_WINDOW: "15 minutes",
      BASE_QUERY_FEE: "0.0005 BNB",
      MONTHLY_SUBSCRIPTION: "1 BNB",
      FREE_DAILY_QUERIES: 100
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

  console.log("\n" + "=".repeat(80));
  console.log("🎉 DEPLOYMENT COMPLETE!");
  console.log("=".repeat(80));
  console.log("\nContract Addresses:");
  console.log("-------------------");
  console.log("GameRegistry:          ", gameRegistryAddress);
  console.log("OracleCore:            ", oracleCoreAddress);
  console.log("FeeManager:            ", feeManagerAddress);
  console.log("ExamplePredictionMarket:", predictionMarketAddress);

  console.log("\n📚 Next Steps:");
  console.log("1. Verify contracts on BSCScan:");
  console.log(`   npx hardhat verify --network ${hre.network.name} ${gameRegistryAddress}`);
  console.log(`   npx hardhat verify --network ${hre.network.name} ${oracleCoreAddress} ${gameRegistryAddress}`);
  console.log(`   npx hardhat verify --network ${hre.network.name} ${feeManagerAddress} ${gameRegistryAddress} ${oracleCoreAddress}`);
  console.log(`   npx hardhat verify --network ${hre.network.name} ${predictionMarketAddress} ${feeManagerAddress} ${gameRegistryAddress}`);

  console.log("\n2. Test the deployment:");
  console.log("   - Register a game");
  console.log("   - Schedule a match");
  console.log("   - Submit results");
  console.log("   - Query oracle data");

  console.log("\n3. Update frontend with contract addresses");
  console.log("\n" + "=".repeat(80) + "\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
