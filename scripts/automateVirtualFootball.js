/**
 * Virtual Football Automation Script
 *
 * This script automates the Virtual Football game by:
 * 1. Starting seasons when startTime is reached
 * 2. Creating matches round-by-round (10 matches per round)
 * 3. Simulating matches when kickoffTime is reached
 * 4. Ending seasons when endTime is reached
 * 5. Optionally creating new seasons automatically
 *
 * Season Structure:
 * - 20 teams in total
 * - 36 rounds per season (double round-robin)
 * - 10 matches per round (20 teams ÷ 2)
 * - Team pairings reshuffled each round using round-robin algorithm
 *
 * Usage:
 *   node scripts/automateVirtualFootball.js
 *
 * Environment variables:
 *   AUTO_CREATE_SEASONS=true     - Automatically create new seasons (default: false)
 *   CHECK_INTERVAL=30000          - Check interval in ms (default: 30 seconds)
 *   MAX_GAS_PRICE=50              - Max gas price in gwei (default: 50)
 */

const hre = require("hardhat");
const { ethers } = require("hardhat");

// Configuration
const CONFIG = {
  autoCreateSeasons: process.env.AUTO_CREATE_SEASONS !== 'true',
  checkInterval: parseInt(process.env.CHECK_INTERVAL || '30000'), // 30 seconds
  maxGasPrice: ethers.parseUnits(process.env.MAX_GAS_PRICE || '50', 'gwei'),
  matchSimulationDelay: 2000, // 2 seconds between match simulations to avoid nonce issues
  teamsCount: 20,
  roundsCount: 36,
  matchesPerRound: 10,
};

// State tracking
const state = {
  currentSeasonId: 0,
  currentRound: 0,
  processedMatches: new Set(),
  processedRounds: new Set(),
  lastCheck: 0,
  isProcessing: false,
};

// Main function
async function main() {
  console.log("🤖 Virtual Football Automation Bot Starting...\n");

  const [signer] = await ethers.getSigners();
  console.log(`Bot Address: ${signer.address}`);

  // Get contract instance
  const VirtualFootballGame = await ethers.getContractFactory("VirtualFootballGame");
  const gameAddress = "0x6271498c4EAd88AbaCB3db20f3974AfaBfdC8eD6";

  if (!gameAddress) {
    throw new Error("VIRTUAL_FOOTBALL_GAME_ADDRESS not set in environment");
  }

  const game = VirtualFootballGame.attach(gameAddress);
  console.log(`Contract Address: ${gameAddress}`);

  // Verify we're the owner
  const owner = await game.owner();
  if (owner.toLowerCase() !== signer.address.toLowerCase()) {
    console.warn(`⚠️  WARNING: You are not the owner. Owner is ${owner}`);
    console.warn(`⚠️  You can still simulate matches, but cannot start/end seasons or create new ones.\n`);
  }

  console.log(`\nConfiguration:`);
  console.log(`  Auto-create seasons: ${CONFIG.autoCreateSeasons}`);
  console.log(`  Check interval: ${CONFIG.checkInterval}ms`);
  console.log(`  Max gas price: ${ethers.formatUnits(CONFIG.maxGasPrice, 'gwei')} gwei`);
  console.log(`\n${'='.repeat(60)}\n`);

  // Start monitoring loop
  await monitorAndAutomate(game, signer);
}

/**
 * Main monitoring loop
 */
async function monitorAndAutomate(game, signer) {
  // Initial check
  await performCheck(game, signer);

  // Set up recurring checks
  setInterval(async () => {
    if (!state.isProcessing) {
      await performCheck(game, signer);
    } else {
      console.log("⏳ Previous check still processing, skipping...");
    }
  }, CONFIG.checkInterval);
}

/**
 * Perform a full check and automation cycle
 */
async function performCheck(game, signer) {
  state.isProcessing = true;
  const now = Math.floor(Date.now() / 1000);
  state.lastCheck = now;

  try {
    console.log(`\n[${new Date().toLocaleTimeString()}] 🔍 Checking game state...`);

    // Get current season
    const currentSeasonId = await game.currentSeasonId();
    state.currentSeasonId = Number(currentSeasonId);

    if (state.currentSeasonId === 0) {
      console.log("📭 No season exists yet.");

      if (CONFIG.autoCreateSeasons) {
        await createNewSeason(game, signer);
      } else {
        console.log("ℹ️  Set AUTO_CREATE_SEASONS=true to auto-create seasons");
      }

      state.isProcessing = false;
      return;
    }

    // Get season details
    const season = await game.getSeason(state.currentSeasonId);
    const seasonStatus = Number(season.status);
    const startTime = Number(season.startTime);
    const endTime = Number(season.endTime);

    console.log(`\n📊 Season #${state.currentSeasonId} Status:`);
    console.log(`   Status: ${getStatusName(seasonStatus)}`);
    console.log(`   Start: ${new Date(startTime * 1000).toLocaleString()}`);
    console.log(`   End: ${new Date(endTime * 1000).toLocaleString()}`);
    console.log(`   Matches: ${season.totalMatches}`);

    // Handle based on status
    if (seasonStatus === 0) { // UPCOMING
      if (now >= startTime) {
        await startSeason(game, signer, state.currentSeasonId);
      } else {
        const timeUntilStart = startTime - now;
        console.log(`⏰ Season starts in ${formatDuration(timeUntilStart)}`);
      }
    } else if (seasonStatus === 1) { // ACTIVE
      await simulateReadyMatches(game, signer, state.currentSeasonId);

      if (now >= endTime) {
        await endSeason(game, signer, state.currentSeasonId);
      } else {
        const timeUntilEnd = endTime - now;
        console.log(`⏰ Season ends in ${formatDuration(timeUntilEnd)}`);
      }
    } else if (seasonStatus === 2) { // COMPLETED
      console.log("✅ Season completed!");

      if (CONFIG.autoCreateSeasons) {
        await createNewSeason(game, signer);
      } else {
        console.log("ℹ️  Set AUTO_CREATE_SEASONS=true to auto-create next season");
      }
    }

  } catch (error) {
    console.error("❌ Error during check:", error.message);
  }

  state.isProcessing = false;
}

/**
 * Start a season and create first round of matches
 */
async function startSeason(game, signer, seasonId) {
  console.log(`\n🚀 Starting Season #${seasonId}...`);

  try {
    const gasPrice = await checkGasPrice();
    if (!gasPrice) return;

    const tx = await game.startSeason(seasonId, { gasPrice });
    console.log(`   Transaction: ${tx.hash}`);

    const receipt = await tx.wait();
    console.log(`✅ Season started! Gas used: ${receipt.gasUsed.toString()}`);

    // Clear state for new season
    state.processedMatches.clear();
    state.processedRounds.clear();
    state.currentRound = 0;

    // Create first round of matches
    console.log(`\n📅 Creating Round 1 matches...`);
    await createRoundMatches(game, signer, seasonId, 0);

  } catch (error) {
    console.error(`❌ Failed to start season:`, error.message);
  }
}

/**
 * Simulate all ready matches and create next round if current round is complete
 */
async function simulateReadyMatches(game, signer, seasonId) {
  try {
    // Get all match IDs for the season
    const matchIds = await game.getSeasonMatches(seasonId);
    const now = Math.floor(Date.now() / 1000);

    let readyCount = 0;
    let simulatedCount = 0;
    let currentRoundMatches = [];
    let currentRoundFinalized = 0;

    for (const matchId of matchIds) {
      const matchIdNum = Number(matchId);

      // Get match details
      const match = await game.getMatch(matchId);
      const kickoffTime = Number(match.kickoffTime);
      const isFinalized = match.isFinalized;

      // Track matches in current round (matches not yet finalized or recently finalized)
      if (!state.processedMatches.has(matchIdNum)) {
        currentRoundMatches.push({ matchId: matchIdNum, match, kickoffTime, isFinalized });
        if (isFinalized) {
          currentRoundFinalized++;
          state.processedMatches.add(matchIdNum);
        }
      }

      // Check if ready to simulate
      if (!isFinalized && now >= kickoffTime && !state.processedMatches.has(matchIdNum)) {
        readyCount++;
        console.log(`\n⚽ Match #${matchIdNum} ready!`);
        console.log(`   ${await getTeamName(game, match.homeTeam)} vs ${await getTeamName(game, match.awayTeam)}`);

        await simulateMatch(game, signer, matchId);
        simulatedCount++;
        currentRoundFinalized++;
        state.processedMatches.add(matchIdNum);

        // Delay between simulations to avoid nonce conflicts
        if (readyCount < currentRoundMatches.length) {
          await sleep(CONFIG.matchSimulationDelay);
        }
      }
    }

    if (simulatedCount > 0) {
      console.log(`\n✅ Simulated ${simulatedCount} match(es)`);
    }

    // Check if we need to create next round
    const totalMatchesExpected = state.currentRound * CONFIG.matchesPerRound;
    const matchesInCurrentRound = matchIds.length - totalMatchesExpected;

    if (matchesInCurrentRound === CONFIG.matchesPerRound && currentRoundFinalized === CONFIG.matchesPerRound) {
      // Current round is complete, create next round
      if (state.currentRound < CONFIG.roundsCount - 1) {
        state.currentRound++;
        console.log(`\n📅 Round ${state.currentRound} complete! Creating Round ${state.currentRound + 1}...`);
        await createRoundMatches(game, signer, seasonId, state.currentRound);
      } else {
        console.log(`\n🏁 All rounds complete!`);
      }
    } else if (readyCount === 0 && simulatedCount === 0) {
      // Find next match
      const nextMatch = await findNextMatch(game, matchIds, now);
      if (nextMatch) {
        const timeUntil = Number(nextMatch.kickoffTime) - now;
        console.log(`⏰ Next match in ${formatDuration(timeUntil)}`);
      }
    }

  } catch (error) {
    console.error("❌ Error simulating matches:", error.message);
  }
}

/**
 * Simulate a single match
 */
async function simulateMatch(game, signer, matchId) {
  try {
    const gasPrice = await checkGasPrice();
    if (!gasPrice) {
      console.log(`   ⏭️  Skipping due to high gas price`);
      return;
    }

    const tx = await game.simulateMatch(matchId, { gasPrice });
    console.log(`   Transaction: ${tx.hash}`);

    const receipt = await tx.wait();

    // Parse events to get score
    const event = receipt.logs.find(log => {
      try {
        const parsed = game.interface.parseLog(log);
        return parsed && parsed.name === 'MatchFinalized';
      } catch {
        return false;
      }
    });

    if (event) {
      const parsed = game.interface.parseLog(event);
      console.log(`   ⚽ Final Score: ${parsed.args.homeScore} - ${parsed.args.awayScore}`);
    }

    console.log(`   Gas used: ${receipt.gasUsed.toString()}`);

  } catch (error) {
    console.error(`   ❌ Failed to simulate match:`, error.message);
  }
}

/**
 * End a season
 */
async function endSeason(game, signer, seasonId) {
  console.log(`\n🏁 Ending Season #${seasonId}...`);

  try {
    const gasPrice = await checkGasPrice();
    if (!gasPrice) return;

    const tx = await game.endSeason(seasonId, { gasPrice });
    console.log(`   Transaction: ${tx.hash}`);

    const receipt = await tx.wait();

    // Parse event to get winner
    const event = receipt.logs.find(log => {
      try {
        const parsed = game.interface.parseLog(log);
        return parsed && parsed.name === 'SeasonEnded';
      } catch {
        return false;
      }
    });

    if (event) {
      const parsed = game.interface.parseLog(event);
      const winnerTeamId = Number(parsed.args.winner);
      const winnerName = await getTeamName(game, winnerTeamId);
      console.log(`   🏆 Winner: ${winnerName} (Team ${winnerTeamId})`);
    }

    console.log(`✅ Season ended! Gas used: ${receipt.gasUsed.toString()}`);

    // Clear processed matches
    state.processedMatches.clear();

  } catch (error) {
    console.error(`❌ Failed to end season:`, error.message);
  }
}

/**
 * Create a new season
 */
async function createNewSeason(game, signer) {
  console.log(`\n🆕 Creating new season...`);

  try {
    const gasPrice = await checkGasPrice();
    if (!gasPrice) return;

    // Start 1 hour from now
    const startTime = Math.floor(Date.now() / 1000) + 3600;

    const tx = await game.createSeason(startTime, { gasPrice });
    console.log(`   Transaction: ${tx.hash}`);

    const receipt = await tx.wait();

    // Parse event to get season ID
    const event = receipt.logs.find(log => {
      try {
        const parsed = game.interface.parseLog(log);
        return parsed && parsed.name === 'SeasonCreated';
      } catch {
        return false;
      }
    });

    if (event) {
      const parsed = game.interface.parseLog(event);
      const newSeasonId = Number(parsed.args.seasonId);
      console.log(`✅ Season #${newSeasonId} created!`);
      console.log(`   Start time: ${new Date(startTime * 1000).toLocaleString()}`);
      state.currentSeasonId = newSeasonId;
    }

  } catch (error) {
    console.error(`❌ Failed to create season:`, error.message);
  }
}

/**
 * Check if gas price is acceptable
 */
async function checkGasPrice() {
  const gasPrice = await ethers.provider.getFeeData();
  const currentGasPrice = gasPrice.gasPrice;

  if (currentGasPrice > CONFIG.maxGasPrice) {
    console.log(`⛽ Gas price too high: ${ethers.formatUnits(currentGasPrice, 'gwei')} gwei (max: ${ethers.formatUnits(CONFIG.maxGasPrice, 'gwei')} gwei)`);
    return null;
  }

  return currentGasPrice;
}

/**
 * Helper: Get team name
 */
async function getTeamName(game, teamId) {
  try {
    return await game.getTeamName(teamId);
  } catch {
    return `Team ${teamId}`;
  }
}

/**
 * Helper: Find next unfinalized match
 */
async function findNextMatch(game, matchIds, now) {
  let nextMatch = null;
  let minTime = Infinity;

  for (const matchId of matchIds) {
    const match = await game.getMatch(matchId);
    const kickoffTime = Number(match.kickoffTime);

    if (!match.isFinalized && kickoffTime > now && kickoffTime < minTime) {
      minTime = kickoffTime;
      nextMatch = match;
    }
  }

  return nextMatch;
}

/**
 * Helper: Format duration
 */
function formatDuration(seconds) {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

/**
 * Helper: Get status name
 */
function getStatusName(status) {
  switch (status) {
    case 0: return 'UPCOMING';
    case 1: return 'ACTIVE';
    case 2: return 'COMPLETED';
    default: return 'UNKNOWN';
  }
}

/**
 * Helper: Sleep
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Create matches for a round using round-robin algorithm
 */
async function createRoundMatches(game, signer, seasonId, round) {
  try {
    const gasPrice = await checkGasPrice();
    if (!gasPrice) {
      console.log(`   ⏭️  Skipping round creation due to high gas price`);
      return;
    }

    // Generate team pairings for this round
    const pairings = generateRoundRobinPairings(round);

    const homeTeams = pairings.map(p => p.home);
    const awayTeams = pairings.map(p => p.away);

    // Base kickoff time: 1 hour from now for first round, or 1 day after last round
    const baseKickoffTime = Math.floor(Date.now() / 1000) + (round === 0 ? 3600 : 86400);

    console.log(`   Creating ${pairings.length} matches for Round ${round + 1}...`);

    // Log pairings
    for (let i = 0; i < pairings.length; i++) {
      const homeTeam = await getTeamName(game, pairings[i].home);
      const awayTeam = await getTeamName(game, pairings[i].away);
      console.log(`   Match ${i + 1}: ${homeTeam} vs ${awayTeam}`);
    }

    // Create matches using batch function
    const tx = await game.createMatches(
      seasonId,
      homeTeams,
      awayTeams,
      baseKickoffTime,
      { gasPrice }
    );

    console.log(`   Transaction: ${tx.hash}`);
    const receipt = await tx.wait();
    console.log(`✅ Round ${round + 1} matches created! Gas used: ${receipt.gasUsed.toString()}`);

    state.processedRounds.add(round);

  } catch (error) {
    console.error(`❌ Failed to create round ${round + 1} matches:`, error.message);
  }
}

/**
 * Generate round-robin pairings for a given round
 * Uses classic round-robin algorithm for 20 teams
 */
function generateRoundRobinPairings(round) {
  const teams = Array.from({ length: CONFIG.teamsCount }, (_, i) => i);
  const pairings = [];

  // Determine if this is first or second half of season
  const isSecondHalf = round >= 18;
  const actualRound = isSecondHalf ? round - 18 : round;

  // Team 0 stays fixed, others rotate
  // Round-robin algorithm
  for (let i = 0; i < CONFIG.matchesPerRound; i++) {
    let home, away;

    if (i === 0) {
      // First match: team 0 vs rotating opponent
      home = 0;
      away = actualRound === 0 ? 1 : ((actualRound + 18) % 19) + 1;
    } else {
      // Other matches: pair remaining teams in a rotating pattern
      const offset = actualRound % 19;
      const pos1 = i;
      const pos2 = 20 - i;

      // Calculate team IDs with rotation
      home = ((pos1 - 1 + offset) % 19) + 1;
      away = ((pos2 - 1 + offset) % 19) + 1;

      // Ensure different teams
      if (home === away) {
        away = (away % 19) + 1;
      }
    }

    // Swap home/away for second half of season
    if (isSecondHalf) {
      [home, away] = [away, home];
    }

    pairings.push({ home, away });
  }

  return pairings;
}

// Error handling
process.on('unhandledRejection', (error) => {
  console.error('\n❌ Unhandled error:', error);
});

process.on('SIGINT', () => {
  console.log('\n\n👋 Shutting down gracefully...');
  process.exit(0);
});

// Run
main()
  .then(() => {
    console.log("\n✅ Automation bot running. Press Ctrl+C to stop.\n");
  })
  .catch((error) => {
    console.error("\n❌ Fatal error:", error);
    process.exit(1);
  });
