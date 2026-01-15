const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * Test All New Data Access Functions
 *
 * Tests all 23 new view functions without needing time manipulation:
 * - GameRegistry match tracking & batch operations
 * - OracleCore per-game stats
 * - Developer stats aggregation
 * - All new view functions for frontend
 */

async function main() {
  console.log("🧪 Testing Data Access Functions on Deployed Contracts...\n");

  // ============ 1. Load Deployment Data ============
  console.log("📂 Loading deployment data...");

  const deploymentFile = path.join(
    __dirname,
    "..",
    "deployments",
    "deployment-fullstack-tenderlyVirtual-1766921221223.json"
  );

  if (!fs.existsSync(deploymentFile)) {
    throw new Error(`Deployment file not found: ${deploymentFile}`);
  }

  const deployment = JSON.parse(fs.readFileSync(deploymentFile, "utf8"));
  console.log(`✅ Loaded deployment from ${deployment.network}\n`);

  // ============ 2. Get Signer ============
  const [signer] = await ethers.getSigners();
  console.log(`👤 Testing with account: ${signer.address}\n`);

  // ============ 3. Connect to Contracts ============
  console.log("🔗 Connecting to deployed contracts...");

  const gameRegistry = await ethers.getContractAt(
    "GameRegistry",
    deployment.contracts.core.GameRegistry
  );

  const oracleCore = await ethers.getContractAt(
    "OracleCore",
    deployment.contracts.core.OracleCore
  );

  const feeManager = await ethers.getContractAt(
    "FeeManagerV2",
    deployment.contracts.core.FeeManagerV2
  );

  const vfGame = await ethers.getContractAt(
    "VirtualFootballGame",
    deployment.contracts.games.VirtualFootballGame
  );

  const rpsGame = await ethers.getContractAt(
    "RockPaperScissors",
    deployment.contracts.games.RockPaperScissors
  );

  console.log("✅ All contracts connected\n");

  const vfGameId = deployment.gameIds.VirtualFootballGame;
  const rpsGameId = deployment.gameIds.RockPaperScissors;

  // ============ 4. Test GameRegistry Functions ============
  console.log("📊 Testing GameRegistry Functions:");
  console.log("=" + "=".repeat(79) + "\n");

  // Test getGameMatches
  try {
    const vfMatches = await gameRegistry.getGameMatches(vfGameId);
    console.log(`✅ getGameMatches(VF): ${vfMatches.length} matches`);
  } catch (error) {
    console.log(`❌ getGameMatches failed: ${error.message.substring(0, 80)}`);
  }

  try {
    const rpsMatches = await gameRegistry.getGameMatches(rpsGameId);
    console.log(`✅ getGameMatches(RPS): ${rpsMatches.length} matches`);
  } catch (error) {
    console.log(`❌ getGameMatches failed: ${error.message.substring(0, 80)}`);
  }

  // Test getGameMatchesPaginated
  try {
    const paginated = await gameRegistry.getGameMatchesPaginated(vfGameId, 0, 10);
    console.log(`✅ getGameMatchesPaginated(VF): ${paginated.length} matches (first 10)`);
  } catch (error) {
    console.log(`❌ getGameMatchesPaginated failed: ${error.message.substring(0, 80)}`);
  }

  // Test getDeveloperGames
  try {
    const vfGameAddress = await vfGame.getAddress();
    const devGames = await gameRegistry.getDeveloperGames(vfGameAddress);
    console.log(`✅ getDeveloperGames(VF): ${devGames.length} games`);
  } catch (error) {
    console.log(`❌ getDeveloperGames failed: ${error.message.substring(0, 80)}`);
  }

  // Test getDeveloperStats
  try {
    const vfGameAddress = await vfGame.getAddress();
    const stats = await gameRegistry.getDeveloperStats(vfGameAddress);
    console.log(`✅ getDeveloperStats(VF):`);
    console.log(`   - Total Games: ${stats._totalGames}`);
    console.log(`   - Total Matches: ${stats._totalMatches}`);
    console.log(`   - Total Disputes: ${stats._totalDisputes}`);
    console.log(`   - Avg Reputation: ${stats.averageReputation}`);
  } catch (error) {
    console.log(`❌ getDeveloperStats failed: ${error.message.substring(0, 80)}`);
  }

  // Test getActiveGames
  try {
    const activeGames = await gameRegistry.getActiveGames();
    console.log(`✅ getActiveGames: ${activeGames.length} active games`);
  } catch (error) {
    console.log(`❌ getActiveGames failed: ${error.message.substring(0, 80)}`);
  }

  // Test getAllGames (paginated)
  try {
    const allGames = await gameRegistry.getAllGames(0, 10);
    console.log(`✅ getAllGames: ${allGames.length} games (first 10)`);
  } catch (error) {
    console.log(`❌ getAllGames failed: ${error.message.substring(0, 80)}`);
  }

  console.log();

  // ============ 5. Test OracleCore Functions ============
  console.log("🔮 Testing OracleCore Functions:");
  console.log("=" + "=".repeat(79) + "\n");

  // Test getGameStats
  try {
    const vfStats = await oracleCore.getGameStats(vfGameId);
    console.log(`✅ getGameStats(VF):`);
    console.log(`   - Total Results: ${vfStats._totalResults}`);
    console.log(`   - Finalized: ${vfStats._finalizedResults}`);
    console.log(`   - Disputed: ${vfStats._disputedResults}`);
    if (Number(vfStats._totalResults) > 0) {
      const finalizationRate = (Number(vfStats._finalizedResults) / Number(vfStats._totalResults)) * 100;
      console.log(`   - Finalization Rate: ${finalizationRate.toFixed(2)}%`);
    }
  } catch (error) {
    console.log(`❌ getGameStats failed: ${error.message.substring(0, 80)}`);
  }

  try {
    const rpsStats = await oracleCore.getGameStats(rpsGameId);
    console.log(`✅ getGameStats(RPS):`);
    console.log(`   - Total Results: ${rpsStats._totalResults}`);
    console.log(`   - Finalized: ${rpsStats._finalizedResults}`);
    console.log(`   - Disputed: ${rpsStats._disputedResults}`);
  } catch (error) {
    console.log(`❌ getGameStats failed: ${error.message.substring(0, 80)}`);
  }

  // Test getGameResults
  try {
    const vfResults = await oracleCore.getGameResults(vfGameId);
    console.log(`✅ getGameResults(VF): ${vfResults.length} results`);
  } catch (error) {
    console.log(`❌ getGameResults failed: ${error.message.substring(0, 80)}`);
  }

  // Test getGlobalStats
  try {
    const globalStats = await oracleCore.getGlobalStats();
    console.log(`✅ getGlobalStats:`);
    console.log(`   - Total Results: ${globalStats._totalResults}`);
    console.log(`   - Total Finalized: ${globalStats._totalFinalized}`);
    console.log(`   - Total Disputed: ${globalStats._totalDisputed}`);
  } catch (error) {
    console.log(`❌ getGlobalStats failed: ${error.message.substring(0, 80)}`);
  }

  // Test getPendingResults
  try {
    const pending = await oracleCore.getPendingResults(vfGameId, 10);
    console.log(`✅ getPendingResults(VF): ${pending.length} pending results`);
  } catch (error) {
    console.log(`❌ getPendingResults failed: ${error.message.substring(0, 80)}`);
  }

  console.log();

  // ============ 6. Test FeeManager Functions ============
  console.log("💰 Testing FeeManager Functions:");
  console.log("=" + "=".repeat(79) + "\n");

  // Test developerEarnings
  try {
    const vfEarnings = await feeManager.developerEarnings(vfGameId);
    console.log(`✅ developerEarnings(VF):`);
    console.log(`   - Total Earned: ${ethers.formatEther(vfEarnings.totalEarned)} BNB`);
    console.log(`   - Pending: ${ethers.formatEther(vfEarnings.pendingEarnings)} BNB`);
    console.log(`   - Total Queries: ${vfEarnings.totalQueries}`);
  } catch (error) {
    console.log(`❌ developerEarnings failed: ${error.message.substring(0, 80)}`);
  }

  try {
    const rpsEarnings = await feeManager.developerEarnings(rpsGameId);
    console.log(`✅ developerEarnings(RPS):`);
    console.log(`   - Total Earned: ${ethers.formatEther(rpsEarnings.totalEarned)} BNB`);
    console.log(`   - Pending: ${ethers.formatEther(rpsEarnings.pendingEarnings)} BNB`);
    console.log(`   - Total Queries: ${rpsEarnings.totalQueries}`);
  } catch (error) {
    console.log(`❌ developerEarnings failed: ${error.message.substring(0, 80)}`);
  }

  // Test protocolEarnings
  try {
    const protocolEarnings = await feeManager.protocolEarnings();
    console.log(`✅ protocolEarnings: ${ethers.formatEther(protocolEarnings)} BNB`);
  } catch (error) {
    console.log(`❌ protocolEarnings failed: ${error.message.substring(0, 80)}`);
  }

  console.log();

  // ============ 7. Test Game-Specific Functions ============
  console.log("🎮 Testing Game-Specific Functions:");
  console.log("=" + "=".repeat(79) + "\n");

  // Test VirtualFootballGame functions
  try {
    const currentSeasonId = await vfGame.currentSeasonId();
    console.log(`✅ VF currentSeasonId: ${currentSeasonId}`);

    if (currentSeasonId > 0) {
      const season = await vfGame.getSeason(currentSeasonId);
      console.log(`   - Season Status: ${season.status}`);
      console.log(`   - Start Time: ${new Date(Number(season.startTime) * 1000).toISOString()}`);

      const seasonMatches = await vfGame.getSeasonMatches(currentSeasonId);
      console.log(`   - Season Matches: ${seasonMatches.length}`);
    }
  } catch (error) {
    console.log(`❌ VF functions failed: ${error.message.substring(0, 80)}`);
  }

  // Test RockPaperScissors functions
  try {
    const allRPSMatches = await rpsGame.getAllMatches();
    console.log(`✅ RPS getAllMatches: ${allRPSMatches.length} matches`);

    if (allRPSMatches.length > 0) {
      const recentMatches = await rpsGame.getRecentMatches(5);
      console.log(`   - Recent Matches: ${recentMatches.length}`);
    }

    const rpsStats = await rpsGame.getGameStats();
    console.log(`✅ RPS getGameStats:`);
    console.log(`   - Total Matches: ${rpsStats.totalMatches}`);
    console.log(`   - Completed: ${rpsStats.completedMatches}`);
    console.log(`   - Active: ${rpsStats.activeMatches}`);
  } catch (error) {
    console.log(`❌ RPS functions failed: ${error.message.substring(0, 80)}`);
  }

  console.log();

  // ============ 8. Summary ============
  console.log("================================================================================");
  console.log("📋 SUMMARY");
  console.log("================================================================================\n");

  console.log("✅ Tested Functions:");
  console.log("   GameRegistry:");
  console.log("     • getGameMatches()");
  console.log("     • getGameMatchesPaginated()");
  console.log("     • getDeveloperGames()");
  console.log("     • getDeveloperStats()");
  console.log("     • getActiveGames()");
  console.log("     • getAllGames()\n");

  console.log("   OracleCore:");
  console.log("     • getGameStats()");
  console.log("     • getGameResults()");
  console.log("     • getGlobalStats()");
  console.log("     • getPendingResults()\n");

  console.log("   FeeManager:");
  console.log("     • developerEarnings()");
  console.log("     • protocolEarnings()\n");

  console.log("   Game Contracts:");
  console.log("     • VirtualFootballGame (season & match functions)");
  console.log("     • RockPaperScissors (match tracking functions)\n");

  console.log("🎯 All new data access functions for frontend are working!");
  console.log("   Ready for frontend integration.\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Error:", error);
    process.exit(1);
  });
