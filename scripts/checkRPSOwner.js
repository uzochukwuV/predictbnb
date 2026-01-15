/**
 * Check RPS Game Owner
 *
 * Checks who owns the RPS game and what gameId it has
 */

const hre = require("hardhat");

async function main() {
  console.log("🔍 Checking RPS Game Details...\n");

  const [signer] = await hre.ethers.getSigners();
  console.log("Your address:", signer.address);

  // RPS contract address from deployment
  const rpsAddress = "0xC48B53a44470585EA15aa7173D42b17348eF7E69";

  const RPS = await hre.ethers.getContractFactory("RockPaperScissors");
  const rps = RPS.attach(rpsAddress);

  try {
    // Get owner
    const owner = await rps.owner();
    console.log("RPS Contract Owner:", owner);
    console.log("Is You:", owner.toLowerCase() === signer.address.toLowerCase() ? "✅ YES" : "❌ NO");

    // Get gameId
    const gameId = await rps.gameId();
    console.log("\nGame ID:", gameId);

    // Check if registered
    if (gameId === "0x0000000000000000000000000000000000000000000000000000000000000000") {
      console.log("❌ Game is NOT registered with oracle yet");
    } else {
      console.log("✅ Game IS registered with oracle");

      // Check game details in GameRegistry
      const gameRegistryAddress = "0x593e48080861819a4402477cD64D5408c6d519DD";
      const GameRegistry = await hre.ethers.getContractFactory("GameRegistry");
      const gameRegistry = GameRegistry.attach(gameRegistryAddress);

      const game = await gameRegistry.games(gameId);
      console.log("\n📦 Game Details from GameRegistry:");
      console.log("   Name:", game.name);
      console.log("   Developer:", game.developer);
      console.log("   Is Developer You:", game.developer.toLowerCase() === signer.address.toLowerCase() ? "✅ YES" : "❌ NO");
      console.log("   Stake:", hre.ethers.formatEther(game.stakedAmount), "BNB");
      console.log("   Active:", game.isActive ? "✅ Yes" : "❌ No");
      console.log("   Reputation:", game.reputation);
      console.log("   Total Matches:", Number(game.totalMatches));
    }

  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
