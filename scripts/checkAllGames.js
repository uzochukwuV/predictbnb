/**
 * Check All Registered Games
 * Shows all games in the system regardless of developer
 */

const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("🔍 Checking All Registered Games in GameRegistry...\n");

  // Load deployment data
  const deploymentsDir = path.join(__dirname, "..", "deployments");
  const files = fs.readdirSync(deploymentsDir)
    .filter(f => f.startsWith("deployment-fullstack-") && f.endsWith(".json"))
    .sort()
    .reverse();

  if (files.length === 0) {
    console.error("❌ No deployment files found");
    process.exit(1);
  }

  const deploymentFile = path.join(deploymentsDir, files[0]);
  const deployment = JSON.parse(fs.readFileSync(deploymentFile, "utf8"));

  console.log(`📂 Using deployment: ${files[0]}`);
  console.log(`   Network: ${deployment.network}`);
  console.log(`   Deployer: ${deployment.deployer}\n`);

  // Connect to GameRegistry
  const gameRegistry = await hre.ethers.getContractAt(
    "GameRegistry",
    deployment.contracts.core.GameRegistry
  );

  // Get all games using the new batch function
  console.log("📊 Fetching all games...\n");

  try {
    // Check if specific game contracts are registered
    const vfGameAddress = deployment.contracts.games.VirtualFootballGame;
    const rpsGameAddress = deployment.contracts.games.RockPaperScissors;

    console.log("🔍 Checking games registered by game contracts:\n");

    // Check VF Game
    const vfGames = await gameRegistry.getDeveloperGames(vfGameAddress);
    console.log(`   VirtualFootballGame (${vfGameAddress}):`);
    console.log(`   - Games registered: ${vfGames.length}`);
    if (vfGames.length > 0) {
      console.log(`   - Game IDs: ${vfGames.map(id => id.substring(0, 10) + '...').join(', ')}`);
    }

    // Check RPS Game
    const rpsGames = await gameRegistry.getDeveloperGames(rpsGameAddress);
    console.log(`\n   RockPaperScissors (${rpsGameAddress}):`);
    console.log(`   - Games registered: ${rpsGames.length}`);
    if (rpsGames.length > 0) {
      console.log(`   - Game IDs: ${rpsGames.map(id => id.substring(0, 10) + '...').join(', ')}`);
    }

    const allGameIds = [...vfGames, ...rpsGames];
    console.log(`\n📦 Total Games Found: ${allGameIds.length}\n`);
    console.log("=" .repeat(80));

    for (let i = 0; i < allGameIds.length; i++) {
      const gameId = allGameIds[i];
      const game = await gameRegistry.getGame(gameId);

      console.log(`\n🎮 Game ${i + 1}/${allGameIds.length}`);
      console.log("-".repeat(80));
      console.log(`   Game ID:      ${gameId}`);
      console.log(`   Name:         ${game.name}`);
      console.log(`   Developer:    ${game.developer}`);
      console.log(`   Stake:        ${hre.ethers.formatEther(game.stakedAmount)} BNB`);
      console.log(`   Reputation:   ${game.reputation}/1000`);
      console.log(`   Total Matches: ${game.totalMatches}`);
      console.log(`   Total Disputes: ${game.totalDisputes}`);
      console.log(`   Active:       ${game.isActive ? "✅ Yes" : "❌ No"}`);
      console.log(`   Banned:       ${game.isBanned ? "🚫 Yes" : "✅ No"}`);
      console.log(`   Registered:   ${new Date(Number(game.registeredAt) * 1000).toLocaleString()}`);

      // Check if this is a known game from deployment
      const isVFGame = game.developer.toLowerCase() === deployment.contracts.games.VirtualFootballGame?.toLowerCase();
      const isRPSGame = game.developer.toLowerCase() === deployment.contracts.games.RockPaperScissors?.toLowerCase();

      if (isVFGame) {
        console.log(`   🎯 Type:       Virtual Football Game (Contract as Developer)`);
        console.log(`   📍 Contract:   ${deployment.contracts.games.VirtualFootballGame}`);
      } else if (isRPSGame) {
        console.log(`   🎯 Type:       Rock Paper Scissors Game (Contract as Developer)`);
        console.log(`   📍 Contract:   ${deployment.contracts.games.RockPaperScissors}`);
      }

      // Get matches for this game
      try {
        const matches = await gameRegistry.getGameMatches(gameId);
        console.log(`   Matches:      ${matches.length} registered`);
      } catch (error) {
        console.log(`   Matches:      Unable to fetch (${error.message.substring(0, 50)})`);
      }
    }

    console.log("\n" + "=".repeat(80));
    console.log("\n📝 Summary:\n");
    console.log(`   Total Games Registered: ${allGameIds.length}`);
    console.log(`   Network: ${deployment.network}`);
    console.log(`   GameRegistry: ${deployment.contracts.core.GameRegistry}`);

    console.log("\n💡 Note:");
    console.log("   Games are registered by the GAME CONTRACT itself, not your wallet.");
    console.log("   To query by your wallet address, you need to check which contracts you deployed.\n");

    console.log("\n🔍 Checking Deployer's Games:");
    const deployerGames = await gameRegistry.getDeveloperGames(deployment.deployer);
    console.log(`   Games registered by deployer (${deployment.deployer}):`);
    console.log(`   Count: ${deployerGames.length}`);

    if (deployerGames.length === 0) {
      console.log("\n   ❌ No games registered directly by your wallet.");
      console.log("   ✅ Games were registered by the game contracts themselves:");
      console.log(`      - VirtualFootballGame: ${deployment.contracts.games.VirtualFootballGame}`);
      console.log(`      - RockPaperScissors: ${deployment.contracts.games.RockPaperScissors}`);
    }

  } catch (error) {
    console.error("\n❌ Error fetching games:", error.message);
    console.error("\nFull error:", error);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
