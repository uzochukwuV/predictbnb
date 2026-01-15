/**
 * Check My Games Script
 *
 * This script checks all games registered by your wallet address
 */

const hre = require("hardhat");

async function main() {
  console.log("🔍 Checking Your Registered Games...\n");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Checking games for address:", deployer.address);
  console.log("=".repeat(60) + "\n");

  // Get GameRegistry contract
  const gameRegistryAddress ="0x5871ec26aB21c67B3743598Fe91B6c365c2D2903"; // From your deployment

  const GameRegistry = await hre.ethers.getContractFactory("GameRegistry");
  const gameRegistry = GameRegistry.attach(gameRegistryAddress);

  try {
    // Get all games for this developer
    const gameIds = await gameRegistry.getDeveloperGames(deployer.address);

    console.log(`📊 Total Games Registered: ${gameIds.length}\n`);

    if (gameIds.length === 0) {
      console.log("❌ No games found for your address.");
      console.log("\n💡 Possible reasons:");
      console.log("   1. You haven't registered any games yet");
      console.log("   2. Games were registered by a different wallet");
      console.log("   3. Wrong network (make sure you're on BSC Testnet)");
      return;
    }

    // Display each game
    for (let i = 0; i < gameIds.length; i++) {
      const gameId = gameIds[i];

      console.log(`\n📦 Game #${i + 1}`);
      console.log("-".repeat(60));
      console.log(`Game ID: ${gameId}`);

      try {
        // Get game details
        const game = await gameRegistry.games(gameId);

        console.log(`Name: ${game.name}`);
        console.log(`Developer: ${game.developer}`);
        console.log(`Staked Amount: ${hre.ethers.formatEther(game.stakedAmount)} BNB`);
        console.log(`Reputation: ${game.reputation}/1000`);
        console.log(`Total Matches: ${game.totalMatches}`);
        console.log(`Total Disputes: ${game.totalDisputes}`);
        console.log(`Registered At: ${new Date(Number(game.registeredAt) * 1000).toLocaleString()}`);
        console.log(`Status: ${game.isActive ? '✅ Active' : '❌ Inactive'}`);
        console.log(`Banned: ${game.isBanned ? '⛔ Yes' : '✅ No'}`);
        console.log(`Metadata: ${game.metadata || 'None'}`);

        // Try to get earnings from FeeManagerV2
        try {
          const feeManagerAddress = process.env.NEXT_PUBLIC_FEE_MANAGER_ADDRESS ||
                                   "0xb7f06C24e6f11af8d310308f898939C88D578036";
          const FeeManagerV2 = await hre.ethers.getContractFactory("FeeManagerV2");
          const feeManager = FeeManagerV2.attach(feeManagerAddress);

          const earnings = await feeManager.developerEarnings(gameId);
          console.log(`\n💰 Earnings:`);
          console.log(`   Total Earned: ${hre.ethers.formatEther(earnings.totalEarned)} BNB`);
          console.log(`   Pending: ${hre.ethers.formatEther(earnings.pendingEarnings)} BNB`);
          console.log(`   Total Queries: ${earnings.totalQueries}`);
        } catch (err) {
          console.log(`\n💰 Earnings: Unable to fetch (${err.message})`);
        }

      } catch (err) {
        console.log(`❌ Error fetching game details: ${err.message}`);
      }
    }

    console.log("\n" + "=".repeat(60));
    console.log("✅ Check Complete!\n");

  } catch (error) {
    console.error("\n❌ Error:", error.message);
    console.error("\nFull error:", error);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
