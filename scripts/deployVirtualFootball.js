const hre = require("hardhat");
const { ethers, upgrades } = require("hardhat");

async function main() {
  console.log("\n🚀 Deploying Virtual Football System...\n");

  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "BNB\n");

  // Deploy core infrastructure if not already deployed
  let gameRegistry, feeManager, oracleCore;

  try {
    // Try to get existing deployments from hardhat ignition or previous deployment
    console.log("📝 Checking for existing core contracts...");

    // For this example, we'll deploy fresh contracts
    // In production, you would load addresses from deployment artifacts

    // 1. Deploy GameRegistry
    console.log("\n1️⃣  Deploying GameRegistry...");
    const GameRegistry = await ethers.getContractFactory("GameRegistry");
    const minimumStake = ethers.parseEther("0.1");
    gameRegistry = await upgrades.deployProxy(
      GameRegistry,
      [minimumStake],
      { kind: "uups" }
    );
    await gameRegistry.waitForDeployment();
    const gameRegistryAddress = await gameRegistry.getAddress();
    console.log("   ✅ GameRegistry deployed to:", gameRegistryAddress);

    // 2. Deploy FeeManagerV2
    console.log("\n2️⃣  Deploying FeeManagerV2...");
    const FeeManagerV2 = await ethers.getContractFactory("FeeManagerV2");
    const queryFee = ethers.parseEther("0.00416"); // $2 at $480/BNB
    feeManager = await upgrades.deployProxy(
      FeeManagerV2,
      [gameRegistryAddress, queryFee],
      { kind: "uups" }
    );
    await feeManager.waitForDeployment();
    const feeManagerAddress = await feeManager.getAddress();
    console.log("   ✅ FeeManagerV2 deployed to:", feeManagerAddress);

    // 3. Deploy OracleCore
    console.log("\n3️⃣  Deploying OracleCore...");
    const OracleCore = await ethers.getContractFactory("OracleCore");
    oracleCore = await upgrades.deployProxy(
      OracleCore,
      [gameRegistryAddress, feeManagerAddress],
      { kind: "uups" }
    );
    await oracleCore.waitForDeployment();
    const oracleCoreAddress = await oracleCore.getAddress();
    console.log("   ✅ OracleCore deployed to:", oracleCoreAddress);

    // 4. Deploy DisputeResolver
    console.log("\n4️⃣  Deploying DisputeResolver...");
    const DisputeResolver = await ethers.getContractFactory("DisputeResolver");
    const disputeResolver = await upgrades.deployProxy(
      DisputeResolver,
      [gameRegistryAddress],
      { kind: "uups" }
    );
    await disputeResolver.waitForDeployment();
    const disputeResolverAddress = await disputeResolver.getAddress();
    console.log("   ✅ DisputeResolver deployed to:", disputeResolverAddress);

    // Update cross-references
    console.log("\n🔗 Updating contract references...");
    await gameRegistry.updateOracleCore(oracleCoreAddress);
    await gameRegistry.updateDisputeResolver(disputeResolverAddress);
    await feeManager.updateOracleCore(oracleCoreAddress);
    await feeManager.updateDisputeResolver(disputeResolverAddress);
    await oracleCore.updateDisputeResolver(disputeResolverAddress);
    console.log("   ✅ References updated");

  } catch (error) {
    console.error("Error with core contracts:", error);
    throw error;
  }

  // 5. Deploy VirtualFootballBetting
  console.log("\n5️⃣  Deploying VirtualFootballBetting...");
  const VirtualFootballBetting = await ethers.getContractFactory("VirtualFootballBetting");

  const virtualFootball = await VirtualFootballBetting.deploy(
    await oracleCore.getAddress(),
    await feeManager.getAddress(),
    await gameRegistry.getAddress()
  );
  await virtualFootball.waitForDeployment();
  const virtualFootballAddress = await virtualFootball.getAddress();
  console.log("   ✅ VirtualFootballBetting deployed to:", virtualFootballAddress);

  // 6. Register VirtualFootball with GameRegistry
  console.log("\n6️⃣  Registering Virtual Football game...");
  const registrationFee = ethers.parseEther("0.1");
  const registerTx = await gameRegistry.registerGame(
    "Virtual Football",
    "Automated virtual football betting with seasons, voting, and copy betting",
    virtualFootballAddress,
    { value: registrationFee }
  );
  const registerReceipt = await registerTx.wait();

  // Extract gameId from event
  const gameRegisteredEvent = registerReceipt.logs.find(
    log => {
      try {
        return gameRegistry.interface.parseLog(log).name === "GameRegistered";
      } catch {
        return false;
      }
    }
  );
  const gameId = gameRegisteredEvent
    ? gameRegistry.interface.parseLog(gameRegisteredEvent).args.gameId
    : null;

  console.log("   ✅ Game registered with ID:", gameId);

  // 7. Create first season
  console.log("\n7️⃣  Creating inaugural season...");
  const currentTime = Math.floor(Date.now() / 1000);
  const seasonStartTime = currentTime + (24 * 60 * 60); // Start in 24 hours

  const createSeasonTx = await virtualFootball.createSeason(seasonStartTime);
  await createSeasonTx.wait();
  console.log("   ✅ Season 1 created");
  console.log("   📅 Start time:", new Date(seasonStartTime * 1000).toLocaleString());
  console.log("   📅 End time:", new Date((seasonStartTime + (14 * 24 * 60 * 60)) * 1000).toLocaleString());

  // Print deployment summary
  console.log("\n" + "=".repeat(70));
  console.log("📊 DEPLOYMENT SUMMARY");
  console.log("=".repeat(70));
  console.log("\n🏗️  Core Infrastructure:");
  console.log("   GameRegistry:        ", await gameRegistry.getAddress());
  console.log("   FeeManagerV2:        ", await feeManager.getAddress());
  console.log("   OracleCore:          ", await oracleCore.getAddress());
  console.log("\n⚽ Virtual Football:");
  console.log("   VirtualFootballBetting:", virtualFootballAddress);
  console.log("   Game ID:             ", gameId);
  console.log("\n🏆 Season Information:");
  console.log("   Current Season:      ", 1);
  console.log("   Duration:            ", "14 days");
  console.log("   Matches per day:     ", "48");
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
      feeManager: await feeManager.getAddress(),
      oracleCore: await oracleCore.getAddress(),
      virtualFootball: virtualFootballAddress
    },
    gameId: gameId,
    seasonStartTime: seasonStartTime
  };

  const fs = require("fs");
  const path = require("path");
  const deploymentsDir = path.join(__dirname, "../deployments");

  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  const filename = `virtual-football-${hre.network.name}-${Date.now()}.json`;
  fs.writeFileSync(
    path.join(deploymentsDir, filename),
    JSON.stringify(deployment, null, 2)
  );

  console.log("💾 Deployment info saved to:", filename);
  console.log("\n🎯 Next steps:");
  console.log("   1. Wait 24 hours for season to start (or call startSeason())");
  console.log("   2. Users can vote for season winner (voteForSeasonWinner())");
  console.log("   3. Matches will be created when season starts");
  console.log("   4. Users can place bets on matches");
  console.log("   5. Call simulateMatch() to finalize each match");
  console.log("   6. Users claim winnings after matches finalize");
  console.log("\n💡 Tipster Registration:");
  console.log("   - Call registerAsTipster(name) to become a tipster");
  console.log("   - Others can follow you with followTipster()");
  console.log("   - Use placeBetAsTipster() to enable auto-copying\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
