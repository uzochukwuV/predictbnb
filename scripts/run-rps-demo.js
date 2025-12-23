const hre = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

/**
 * Interactive RPS Demo - Shows complete flow
 * 1. Schedule match
 * 2. Create prediction market
 * 3. Place bets
 * 4. Players commit & play
 * 5. Oracle finalizes
 * 6. Resolve market
 * 7. Claim winnings
 */

async function main() {
  console.log("\n" + "═".repeat(100));
  console.log("║" + " ".repeat(98) + "║");
  console.log("║" + " ".repeat(20) + "🎮 PREDICTBNB ROCK-PAPER-SCISSORS DEMO 🎮" + " ".repeat(37) + "║");
  console.log("║" + " ".repeat(98) + "║");
  console.log("═".repeat(100) + "\n");

  const [deployer, player1, player2, bettor1, bettor2, bettor3] = await hre.ethers.getSigners();

  console.log("👥 Participants:");
  console.log("   Deployer:  ", deployer.address);
  console.log("   Player 1:  ", player1.address, "🥊");
  console.log("   Player 2:  ", player2.address, "🥊");
  console.log("   Bettor 1:  ", bettor1.address, "💰");
  console.log("   Bettor 2:  ", bettor2.address, "💰");
  console.log("   Bettor 3:  ", bettor3.address, "💰");
  console.log();

  // Load deployment (assume deploy-rps-demo.js was run)
  const fs = require("fs");
  const path = require("path");
  const deploymentsDir = path.join(__dirname, "..", "deployments");
  const files = fs.readdirSync(deploymentsDir).filter(f => f.startsWith("rps-demo"));

  if (files.length === 0) {
    console.error("❌ No deployment found. Run 'npx hardhat run scripts/deploy-rps-demo.js' first");
    process.exit(1);
  }

  const latestDeployment = files.sort().reverse()[0];
  const deployment = JSON.parse(fs.readFileSync(path.join(deploymentsDir, latestDeployment)));

  console.log("📦 Loading deployment:", latestDeployment);
  console.log();

  // Get contract instances
  const rpsGame = await hre.ethers.getContractAt("RockPaperScissors", deployment.contracts.rpsGame);
  const predictionMarket = await hre.ethers.getContractAt("RPSPredictionMarket", deployment.contracts.predictionMarket);
  const oracleCore = await hre.ethers.getContractAt("OracleCore", deployment.contracts.oracleCore);
  const feeManager = await hre.ethers.getContractAt("FeeManager", deployment.contracts.feeManager);

  // ============ Step 1: Schedule New Match ============

  console.log("═".repeat(100));
  console.log("STEP 1: SCHEDULE MATCH");
  console.log("═".repeat(100) + "\n");

  const now = Math.floor(Date.now() / 1000);
  const scheduledTime = now + 60; // 1 minute from now

  console.log("🗓️  Scheduling match...");
  console.log("   Player 1:", player1.address);
  console.log("   Player 2:", player2.address);
  console.log("   Time:", new Date(scheduledTime * 1000).toLocaleString());
  console.log();

  const scheduleTx = await rpsGame.scheduleMatch(player1.address, player2.address, scheduledTime);
  const scheduleReceipt = await scheduleTx.wait();
  const matchId = scheduleReceipt.logs.find(log => log.fragment && log.fragment.name === "MatchScheduled").args.matchId;

  console.log("✅ Match scheduled!");
  console.log("   Match ID:", matchId);
  console.log();

  // ============ Step 2: Create Prediction Market ============

  console.log("═".repeat(100));
  console.log("STEP 2: CREATE PREDICTION MARKET");
  console.log("═".repeat(100) + "\n");

  const bettingDeadline = scheduledTime - 30; // Close 30 seconds before match
  const gameId = await rpsGame.gameId();

  console.log("📊 Creating prediction market...");
  console.log("   Match ID:", matchId);
  console.log("   Betting closes:", new Date(bettingDeadline * 1000).toLocaleString());
  console.log();

  const createMarketTx = await predictionMarket.createMarket(
    matchId,
    gameId,
    player1.address,
    player2.address,
    bettingDeadline
  );
  const createMarketReceipt = await createMarketTx.wait();
  const marketId = createMarketReceipt.logs.find(log => log.fragment && log.fragment.name === "MarketCreated").args.marketId;

  console.log("✅ Market created!");
  console.log("   Market ID:", marketId.toString());
  console.log();

  // ============ Step 3: Place Bets ============

  console.log("═".repeat(100));
  console.log("STEP 3: PLACE BETS");
  console.log("═".repeat(100) + "\n");

  const betAmount1 = hre.ethers.parseEther("0.05"); // 0.05 BNB
  const betAmount2 = hre.ethers.parseEther("0.03"); // 0.03 BNB
  const betAmount3 = hre.ethers.parseEther("0.02"); // 0.02 BNB

  console.log("💰 Bettor 1 bets on Player 1:", hre.ethers.formatEther(betAmount1), "BNB");
  await predictionMarket.connect(bettor1).placeBet(marketId, player1.address, { value: betAmount1 });

  console.log("💰 Bettor 2 bets on Player 2:", hre.ethers.formatEther(betAmount2), "BNB");
  await predictionMarket.connect(bettor2).placeBet(marketId, player2.address, { value: betAmount2 });

  console.log("💰 Bettor 3 bets on Tie:", hre.ethers.formatEther(betAmount3), "BNB");
  await predictionMarket.connect(bettor3).placeBet(marketId, hre.ethers.ZeroAddress, { value: betAmount3 });

  const market = await predictionMarket.getMarket(marketId);
  console.log("\n📊 Market Pool:");
  console.log("   Total Pool:", hre.ethers.formatEther(market.totalPool), "BNB");
  console.log("   Player 1 Pool:", hre.ethers.formatEther(market.player1Pool), "BNB");
  console.log("   Player 2 Pool:", hre.ethers.formatEther(market.player2Pool), "BNB");
  console.log("   Tie Pool:", hre.ethers.formatEther(market.tiePool), "BNB");

  const [p1Odds, p2Odds, tieOdds] = await predictionMarket.getOdds(marketId);
  console.log("\n📈 Current Odds:");
  console.log("   Player 1:", (p1Odds / 100).toFixed(2) + "x");
  console.log("   Player 2:", (p2Odds / 100).toFixed(2) + "x");
  console.log("   Tie:", (tieOdds / 100).toFixed(2) + "x");
  console.log();

  // ============ Step 4: Play Match ============

  console.log("═".repeat(100));
  console.log("STEP 4: PLAY MATCH");
  console.log("═".repeat(100) + "\n");

  console.log("⏳ Fast-forwarding to match time...");
  await time.increaseTo(scheduledTime);

  console.log("🥊 Player 1 commits to match...");
  const commit1Tx = await rpsGame.connect(player1).commitToMatch(matchId);
  const commit1Receipt = await commit1Tx.wait();
  const player1CommitEvent = commit1Receipt.logs.find(log => log.fragment && log.fragment.name === "PlayerCommitted");
  const player1Cards = player1CommitEvent.args.cards;

  console.log("   Player 1 cards:", cardArrayToString(player1Cards));

  console.log("\n🥊 Player 2 commits to match...");
  const commit2Tx = await rpsGame.connect(player2).commitToMatch(matchId);
  const commit2Receipt = await commit2Tx.wait();

  // Get match result
  const rpsMatch = await rpsGame.getMatch(matchId);
  console.log("\n📊 Match Result:");
  console.log("   Player 1 cards:", cardArrayToString(rpsMatch.player1Cards));
  console.log("   Player 2 cards:", cardArrayToString(rpsMatch.player2Cards));
  console.log();
  console.log("   Round 1:", cardToString(rpsMatch.player1Cards[0]), "vs", cardToString(rpsMatch.player2Cards[0]));
  console.log("   Round 2:", cardToString(rpsMatch.player1Cards[1]), "vs", cardToString(rpsMatch.player2Cards[1]));
  console.log("   Round 3:", cardToString(rpsMatch.player1Cards[2]), "vs", cardToString(rpsMatch.player2Cards[2]));
  console.log();
  console.log("   Player 1 wins:", rpsMatch.player1Wins.toString(), "rounds");
  console.log("   Player 2 wins:", rpsMatch.player2Wins.toString(), "rounds");

  if (rpsMatch.winner === hre.ethers.ZeroAddress) {
    console.log("\n🤝 Result: TIE!");
  } else if (rpsMatch.winner === player1.address) {
    console.log("\n🎉 Winner: PLAYER 1!");
  } else {
    console.log("\n🎉 Winner: PLAYER 2!");
  }
  console.log();

  // ============ Step 5: Wait for Oracle Finalization ============

  console.log("═".repeat(100));
  console.log("STEP 5: ORACLE FINALIZATION");
  console.log("═".repeat(100) + "\n");

  console.log("⏳ Waiting for 15-minute dispute window...");
  await time.increase(15 * 60); // 15 minutes

  const result = await oracleCore.getResult(matchId);
  console.log("✅ Oracle result finalized!");
  console.log("   Submitted at:", new Date(Number(result.submittedAt) * 1000).toLocaleString());
  console.log("   Finalized:", result.isFinalized);
  console.log();

  // ============ Step 6: Resolve Prediction Market ============

  console.log("═".repeat(100));
  console.log("STEP 6: RESOLVE PREDICTION MARKET");
  console.log("═".repeat(100) + "\n");

  console.log("🔍 Querying oracle for winner...");
  await predictionMarket.resolveMarket(marketId);

  const resolvedMarket = await predictionMarket.getMarket(marketId);
  console.log("✅ Market resolved!");

  if (resolvedMarket.winner === hre.ethers.ZeroAddress) {
    console.log("   Winner: TIE");
  } else if (resolvedMarket.winner === player1.address) {
    console.log("   Winner: PLAYER 1");
  } else {
    console.log("   Winner: PLAYER 2");
  }
  console.log();

  // ============ Step 7: Claim Winnings ============

  console.log("═".repeat(100));
  console.log("STEP 7: CLAIM WINNINGS");
  console.log("═".repeat(100) + "\n");

  // Check who won
  const bettors = [
    { address: bettor1.address, signer: bettor1, name: "Bettor 1", predicted: player1.address },
    { address: bettor2.address, signer: bettor2, name: "Bettor 2", predicted: player2.address },
    { address: bettor3.address, signer: bettor3, name: "Bettor 3", predicted: hre.ethers.ZeroAddress }
  ];

  for (const bettor of bettors) {
    const balanceBefore = await hre.ethers.provider.getBalance(bettor.address);

    try {
      const claimTx = await predictionMarket.connect(bettor.signer).claimWinnings(marketId);
      const claimReceipt = await claimTx.wait();

      const balanceAfter = await hre.ethers.provider.getBalance(bettor.address);
      const winnings = balanceAfter - balanceBefore + (claimReceipt.gasUsed * claimReceipt.gasPrice);

      console.log(`💰 ${bettor.name} claimed:`, hre.ethers.formatEther(winnings), "BNB");
    } catch (error) {
      console.log(`❌ ${bettor.name} lost their bet`);
    }
  }

  console.log();

  // ============ Summary ============

  console.log("\n" + "═".repeat(100));
  console.log("📊 DEMO SUMMARY");
  console.log("═".repeat(100) + "\n");

  console.log("✅ Demonstrated Features:");
  console.log("   ✓ Schedulable matches with matchId");
  console.log("   ✓ On-chain randomness for fair play");
  console.log("   ✓ Oracle data submission with quick-access fields");
  console.log("   ✓ Prediction market integration using matchId");
  console.log("   ✓ Multi-user betting with different predictions");
  console.log("   ✓ Automatic market resolution from oracle");
  console.log("   ✓ Winner payouts with platform fees");
  console.log();

  console.log("📈 Oracle Statistics:");
  console.log("   Total results:", (await oracleCore.totalResults()).toString());
  console.log("   Finalized results:", (await oracleCore.totalFinalized()).toString());
  console.log();

  console.log("🎮 Game Statistics:");
  const [p1Wins, p1Matches] = await rpsGame.getPlayerStats(player1.address);
  const [p2Wins, p2Matches] = await rpsGame.getPlayerStats(player2.address);
  console.log("   Player 1: ", p1Wins.toString(), "wins /", p1Matches.toString(), "matches");
  console.log("   Player 2: ", p2Wins.toString(), "wins /", p2Matches.toString(), "matches");
  console.log();

  console.log("═".repeat(100));
  console.log("🎉 DEMO COMPLETE!");
  console.log("═".repeat(100) + "\n");
}

// Helper functions
function cardToString(card) {
  const cards = ["🪨 ROCK", "📄 PAPER", "✂️  SCISSORS"];
  return cards[Number(card)];
}

function cardArrayToString(cards) {
  return `[${cardToString(cards[0])}, ${cardToString(cards[1])}, ${cardToString(cards[2])}]`;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
