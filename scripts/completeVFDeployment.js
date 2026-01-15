/**
 * Complete Virtual Football Deployment
 *
 * Use this to finish the VF deployment after running out of gas.
 * This script will:
 * 1. Register VirtualFootballGame with oracle (requires 0.1 BNB)
 * 2. Deploy VirtualFootballMarket
 * 3. Update .env.local
 */

const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

// UPDATE THESE WITH YOUR DEPLOYED ADDRESSES
const DEPLOYED_ADDRESSES = {
  GameRegistry: "0x593e48080861819a4402477cD64D5408c6d519DD",
  OracleCore: "0xDd80530c356Da2Fb43a7Fa189350656b71687e36",
  FeeManagerV2: "0xb7f06C24e6f11af8d310308f898939C88D578036",
  VirtualFootballGame: "0x2Dd594daFcf13E3eb92489E2084338e8d4EC4EF5",
};

const MINIMUM_STAKE = hre.ethers.parseEther("0.1"); // 0.1 BNB

async function main() {
  console.log("🔄 Completing Virtual Football Deployment...\n");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Account:", deployer.address);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Balance:", hre.ethers.formatEther(balance), "BNB");

  if (balance < MINIMUM_STAKE) {
    console.error("\n❌ Insufficient balance!");
    console.error(`   Need: ${hre.ethers.formatEther(MINIMUM_STAKE)} BNB`);
    console.error(`   Have: ${hre.ethers.formatEther(balance)} BNB`);
    console.error("\n💡 Get testnet BNB from: https://testnet.bnbchain.org/faucet-smart");
    process.exit(1);
  }

  // Get VirtualFootballGame contract
  const VirtualFootballGame = await hre.ethers.getContractFactory("VirtualFootballGame");
  const vfGame = VirtualFootballGame.attach(DEPLOYED_ADDRESSES.VirtualFootballGame);

  // Check if already registered
  const existingGameId = await vfGame.gameId();
  if (existingGameId !== "0x0000000000000000000000000000000000000000000000000000000000000000") {
    console.log("✅ VirtualFootballGame already registered!");
    console.log("   Game ID:", existingGameId);
  } else {
    // Register VF game with oracle
    console.log("\n📋 Registering VirtualFootball game with oracle...");
    console.log(`   Staking: ${hre.ethers.formatEther(MINIMUM_STAKE)} BNB`);

    try {
      const registerTx = await vfGame.registerGame({ value: MINIMUM_STAKE });
      console.log("   Transaction:", registerTx.hash);

      const receipt = await registerTx.wait();
      console.log("   Gas used:", receipt.gasUsed.toString());

      const vfGameId = await vfGame.gameId();
      console.log("✅ VF Game registered with ID:", vfGameId);
    } catch (error) {
      console.error("❌ Failed to register VF game:", error.message);
      process.exit(1);
    }
  }

  // Get updated game ID
  const vfGameId = await vfGame.gameId();

  // Deploy VirtualFootballMarket
  console.log("\n📊 Deploying VirtualFootballMarket...");
  const VirtualFootballMarket = await hre.ethers.getContractFactory("VirtualFootballMarket");
  const vfMarket = await VirtualFootballMarket.deploy(
    DEPLOYED_ADDRESSES.VirtualFootballGame,
    DEPLOYED_ADDRESSES.OracleCore,
    DEPLOYED_ADDRESSES.FeeManagerV2
  );
  await vfMarket.waitForDeployment();
  const vfMarketAddress = await vfMarket.getAddress();
  console.log("✅ VirtualFootballMarket deployed to:", vfMarketAddress);

  // Update .env.local
  console.log("\n📝 Updating frontend .env.local...");

  const envPath = path.join(__dirname, "..", "frontend", ".env.local");
  let envContent = "";

  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, "utf8");

    // Update or add VF addresses
    if (envContent.includes("NEXT_PUBLIC_VIRTUAL_FOOTBALL_GAME_ADDRESS")) {
      envContent = envContent.replace(
        /NEXT_PUBLIC_VIRTUAL_FOOTBALL_GAME_ADDRESS=.*/,
        `NEXT_PUBLIC_VIRTUAL_FOOTBALL_GAME_ADDRESS=${DEPLOYED_ADDRESSES.VirtualFootballGame}`
      );
    } else {
      envContent += `\nNEXT_PUBLIC_VIRTUAL_FOOTBALL_GAME_ADDRESS=${DEPLOYED_ADDRESSES.VirtualFootballGame}`;
    }

    if (envContent.includes("NEXT_PUBLIC_VIRTUAL_FOOTBALL_MARKET_ADDRESS")) {
      envContent = envContent.replace(
        /NEXT_PUBLIC_VIRTUAL_FOOTBALL_MARKET_ADDRESS=.*/,
        `NEXT_PUBLIC_VIRTUAL_FOOTBALL_MARKET_ADDRESS=${vfMarketAddress}`
      );
    } else {
      envContent += `\nNEXT_PUBLIC_VIRTUAL_FOOTBALL_MARKET_ADDRESS=${vfMarketAddress}`;
    }
  } else {
    // Create new .env.local
    envContent = `# Virtual Football Contracts
NEXT_PUBLIC_VIRTUAL_FOOTBALL_GAME_ADDRESS=${DEPLOYED_ADDRESSES.VirtualFootballGame}
NEXT_PUBLIC_VIRTUAL_FOOTBALL_MARKET_ADDRESS=${vfMarketAddress}

# Core Contracts
NEXT_PUBLIC_GAME_REGISTRY_ADDRESS=${DEPLOYED_ADDRESSES.GameRegistry}
NEXT_PUBLIC_ORACLE_CORE_ADDRESS=${DEPLOYED_ADDRESSES.OracleCore}
NEXT_PUBLIC_FEE_MANAGER_ADDRESS=${DEPLOYED_ADDRESSES.FeeManagerV2}

# Network
NEXT_PUBLIC_CHAIN_ID=97
`;
  }

  fs.writeFileSync(envPath, envContent);
  console.log("✅ .env.local updated");

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("🎉 Virtual Football Deployment Complete!");
  console.log("=".repeat(60));
  console.log("\n⚽ Virtual Football:");
  console.log("VirtualFootballGame:", DEPLOYED_ADDRESSES.VirtualFootballGame);
  console.log("  └─ Game ID:       ", vfGameId);
  console.log("VirtualFootballMarket:", vfMarketAddress);

  console.log("\n📚 Next Steps:");
  console.log("1. Export ABIs: npm run export-abis");
  console.log("2. Start automation bot:");
  console.log(`   VIRTUAL_FOOTBALL_GAME_ADDRESS=${DEPLOYED_ADDRESSES.VirtualFootballGame} \\`);
  console.log("   AUTO_CREATE_SEASONS=true \\");
  console.log("   npm run automate:vf");
  console.log("3. Start frontend: cd frontend && npm run dev");
  console.log("\n" + "=".repeat(60) + "\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
