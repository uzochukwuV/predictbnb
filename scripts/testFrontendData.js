/**
 * Test Frontend Data Fetching
 *
 * Tests all the data points needed for the Game Console dashboard
 * This helps verify what data is available before we fix the registration bug
 */

const hre = require("hardhat");

async function main() {
  console.log("🧪 Testing Frontend Data Fetching...\n");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Testing with address:", deployer.address);
  console.log("Balance:", hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address)), "BNB\n");

  // Contract addresses
  const gameRegistryAddress = "0x593e48080861819a4402477cD64D5408c6d519DD";
  const oracleCoreAddress = "0xDd80530c356Da2Fb43a7Fa189350656b71687e36";
  const feeManagerAddress = "0xb7f06C24e6f11af8d310308f898939C88D578036";
  const rpsAddress = "0xC48B53a44470585EA15aa7173D42b17348eF7E69";

  // Attach contracts
  const GameRegistry = await hre.ethers.getContractFactory("GameRegistry");
  const gameRegistry = GameRegistry.attach(gameRegistryAddress);

  const OracleCore = await hre.ethers.getContractFactory("OracleCore");
  const oracleCore = OracleCore.attach(oracleCoreAddress);

  const FeeManagerV2 = await hre.ethers.getContractFactory("FeeManagerV2");
  const feeManager = FeeManagerV2.attach(feeManagerAddress);

  const RPS = await hre.ethers.getContractFactory("RockPaperScissors");
  const rps = RPS.attach(rpsAddress);

  console.log("═══════════════════════════════════════════════════════");
  console.log("📊 DASHBOARD DATA - My Games Section");
  console.log("═══════════════════════════════════════════════════════\n");

  // 1. Get developer's games
  const gameIds = await gameRegistry.getDeveloperGames(deployer.address);
  console.log("My Games:", gameIds.length);
  console.log("Game IDs:", gameIds);

  if (gameIds.length === 0) {
    console.log("\n⚠️  No games found for your address");
    console.log("   This is the bug we identified - RPS is registered under contract address\n");
  }

  // 2. Get developer earnings from FeeManager
  try {
    const earnings = await feeManager.developerEarnings(deployer.address);
    console.log("\n💰 Developer Earnings:");
    console.log("   Total Earned:", hre.ethers.formatEther(earnings.totalEarned), "BNB");
    console.log("   Pending:", hre.ethers.formatEther(earnings.pendingEarnings), "BNB");
    console.log("   Last Withdraw:", new Date(Number(earnings.lastWithdrawTime) * 1000).toISOString());
    console.log("   Total Queries:", Number(earnings.totalQueries));
  } catch (error) {
    console.log("\n❌ Error fetching developer earnings:", error.message);
  }

  console.log("\n═══════════════════════════════════════════════════════");
  console.log("📊 ORACLE NETWORK STATS");
  console.log("═══════════════════════════════════════════════════════\n");

  // 3. Get total results submitted (all games)
  const totalGames = await gameRegistry.totalGames();
  console.log("Total Games Registered:", Number(totalGames));

  // Get RPS game data (since we know it exists)
  const rpsGameId = await rps.gameId();
  console.log("\nRPS Game ID:", rpsGameId);

  if (rpsGameId !== "0x0000000000000000000000000000000000000000000000000000000000000000") {
    const game = await gameRegistry.games(rpsGameId);
    console.log("\n📦 RPS Game Details:");
    console.log("   Name:", game.name);
    console.log("   Developer:", game.developer);
    console.log("   Stake:", hre.ethers.formatEther(game.stakedAmount), "BNB");
    console.log("   Reputation:", game.reputation, "/ 1000");
    console.log("   Active:", game.isActive);
    console.log("   Total Matches:", Number(game.totalMatches));
    console.log("   Total Disputes:", Number(game.totalDisputes));
    console.log("   Registered At:", new Date(Number(game.registeredAt) * 1000).toISOString());

    // Check oracle stats for this game
    try {
      const gameStats = await oracleCore.getGameStats(rpsGameId);
      console.log("\n📈 RPS Oracle Stats:");
      console.log("   Total Results:", Number(gameStats.totalResults));
      console.log("   Finalized:", Number(gameStats.finalizedResults));
      console.log("   Disputed:", Number(gameStats.disputedResults));
      console.log("   Finalization Rate:", gameStats.totalResults > 0
        ? ((Number(gameStats.finalizedResults) / Number(gameStats.totalResults)) * 100).toFixed(1) + "%"
        : "N/A");
      console.log("   Dispute Rate:", gameStats.totalResults > 0
        ? ((Number(gameStats.disputedResults) / Number(gameStats.totalResults)) * 100).toFixed(1) + "%"
        : "N/A");
    } catch (error) {
      console.log("\n❌ Error fetching oracle stats:", error.message);
    }
  }

  console.log("\n═══════════════════════════════════════════════════════");
  console.log("🎮 INDIVIDUAL GAME STATS (for game detail page)");
  console.log("═══════════════════════════════════════════════════════\n");

  if (rpsGameId !== "0x0000000000000000000000000000000000000000000000000000000000000000") {
    // Get matches for this game (we need to add this functionality)
    console.log("Note: To get all matches for a game, we need to:");
    console.log("1. Either track match IDs in the game contract");
    console.log("2. Or emit events and index them");
    console.log("3. Or add a view function in GameRegistry to get matches by gameId\n");

    // For now, let's check RPS contract stats
    const matchCounter = await rps.matchCounter();
    console.log("RPS Match Counter:", Number(matchCounter));

    if (matchCounter > 0) {
      console.log("(Note: matchCounter is incremented but we need matchIds to fetch match details)");
    }
  }

  console.log("\n═══════════════════════════════════════════════════════");
  console.log("🔍 WHAT'S AVAILABLE vs WHAT'S NEEDED");
  console.log("═══════════════════════════════════════════════════════\n");

  console.log("✅ Available:");
  console.log("   - getDeveloperGames(address) - Get all games for a developer");
  console.log("   - games(gameId) - Get game details");
  console.log("   - developerEarnings(address) - Get earnings data");
  console.log("   - getGameStats(gameId) - Get oracle stats per game");
  console.log("   - totalGames - Total registered games");

  console.log("\n⚠️  Missing/Needed:");
  console.log("   - getMatchesByGame(gameId) - Get all matches for a game");
  console.log("   - getRecentMatches(gameId, limit) - Get recent matches");
  console.log("   - Global oracle stats (total results across all games)");

  console.log("\n═══════════════════════════════════════════════════════");
  console.log("💡 TESTING WITH DIFFERENT ADDRESSES");
  console.log("═══════════════════════════════════════════════════════\n");

  // Test with RPS contract address (where the game is actually registered)
  const rpsContractGames = await gameRegistry.getDeveloperGames(rpsAddress);
  console.log("Games registered under RPS contract:", rpsContractGames.length);
  if (rpsContractGames.length > 0) {
    console.log("Game IDs:", rpsContractGames);
    console.log("\n✅ Confirmed: RPS game is registered under the contract address");
    console.log("   This is why it doesn't show in your dashboard\n");

    // Get earnings for RPS contract address
    try {
      const contractEarnings = await feeManager.developerEarnings(rpsAddress);
      console.log("💰 Earnings for RPS Contract Address:");
      console.log("   Total Earned:", hre.ethers.formatEther(contractEarnings.totalEarned), "BNB");
      console.log("   Pending:", hre.ethers.formatEther(contractEarnings.pendingEarnings), "BNB");
      console.log("   Total Queries:", Number(contractEarnings.totalQueries));
    } catch (error) {
      console.log("❌ Error fetching contract earnings:", error.message);
    }
  }

  console.log("\n═══════════════════════════════════════════════════════");
  console.log("🎯 SOLUTION SUMMARY");
  console.log("═══════════════════════════════════════════════════════\n");

  console.log("Option 1: Upgrade GameRegistry");
  console.log("   - Add transferGameDeveloper() function");
  console.log("   - Transfer RPS game from contract to your address");
  console.log("   - Dashboard will immediately show the game\n");

  console.log("Option 2: Redeploy RPS");
  console.log("   - Deploy new RPS with fixed registerWithOracle()");
  console.log("   - Have owner call GameRegistry.registerGame() directly");
  console.log("   - Will cost another 0.1 BNB for registration\n");

  console.log("Option 3: Frontend Workaround");
  console.log("   - Frontend checks both deployer.address and known contract addresses");
  console.log("   - Shows games from both sources");
  console.log("   - Quick fix but not ideal\n");

  console.log("Recommended: Option 1 (Upgrade GameRegistry)");
  console.log("   - Fixes the issue for this deployment");
  console.log("   - Adds useful admin function for future issues");
  console.log("   - No additional BNB cost");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
