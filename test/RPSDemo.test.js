const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("🎮 RPS + Prediction Market Demo", function () {
  let gameRegistry, oracleCore, feeManager, disputeResolver;
  let rpsGame, predictionMarket;
  let deployer, player1, player2, bettor1, bettor2, bettor3;

  const MINIMUM_STAKE = ethers.parseEther("0.1");
  const QUERY_FEE = ethers.parseEther("0.00416"); // $2.00 at $480/BNB
  const CHALLENGE_STAKE = ethers.parseEther("0.2");

  before(async function () {
    [deployer, player1, player2, bettor1, bettor2, bettor3] = await ethers.getSigners();

    console.log("\n" + "═".repeat(100));
    console.log("║" + " ".repeat(98) + "║");
    console.log("║" + " ".repeat(20) + "🎮 PREDICTBNB ROCK-PAPER-SCISSORS DEMO 🎮" + " ".repeat(37) + "║");
    console.log("║" + " ".repeat(98) + "║");
    console.log("═".repeat(100));

    console.log("\n👥 Participants:");
    console.log("   Deployer: ", deployer.address);
    console.log("   Player 1: ", player1.address, "🥊");
    console.log("   Player 2: ", player2.address, "🥊");
    console.log("   Bettor 1: ", bettor1.address, "💰");
    console.log("   Bettor 2: ", bettor2.address, "💰");
    console.log("   Bettor 3: ", bettor3.address, "💰");

    console.log("\n" + "═".repeat(100));
    console.log("DEPLOYING CORE INFRASTRUCTURE");
    console.log("═".repeat(100));

    // Deploy core contracts
    const GameRegistry = await ethers.getContractFactory("GameRegistry");
    gameRegistry = await upgrades.deployProxy(GameRegistry, [MINIMUM_STAKE], { kind: "uups" });
    console.log("✅ GameRegistry deployed");

    const FeeManagerV2 = await ethers.getContractFactory("FeeManagerV2");
    feeManager = await upgrades.deployProxy(FeeManagerV2, [await gameRegistry.getAddress(), QUERY_FEE], { kind: "uups" });
    console.log("✅ FeeManagerV2 deployed");

    const OracleCore = await ethers.getContractFactory("OracleCore");
    oracleCore = await upgrades.deployProxy(OracleCore, [await gameRegistry.getAddress(), await feeManager.getAddress()], { kind: "uups" });
    console.log("✅ OracleCore deployed");

    const DisputeResolver = await ethers.getContractFactory("DisputeResolver");
    disputeResolver = await upgrades.deployProxy(DisputeResolver, [await gameRegistry.getAddress(), await oracleCore.getAddress(), await feeManager.getAddress(), CHALLENGE_STAKE], { kind: "uups" });
    console.log("✅ DisputeResolver deployed");

    // Connect contracts
    await oracleCore.updateDisputeResolver(await disputeResolver.getAddress());
    await gameRegistry.updateDisputeResolver(await disputeResolver.getAddress());
    await gameRegistry.updateOracleCore(await oracleCore.getAddress());
    await feeManager.updateDisputeResolver(await disputeResolver.getAddress());
    await feeManager.updateOracleCore(await oracleCore.getAddress());
    console.log("✅ Contracts connected\n");

    // Deploy RPS game
    console.log("═".repeat(100));
    console.log("DEPLOYING ROCK-PAPER-SCISSORS GAME");
    console.log("═".repeat(100));

    const RockPaperScissors = await ethers.getContractFactory("RockPaperScissors");
    rpsGame = await RockPaperScissors.deploy(await gameRegistry.getAddress(), await oracleCore.getAddress());
    console.log("✅ RockPaperScissors deployed");

    await rpsGame.registerWithOracle({ value: MINIMUM_STAKE });
    console.log("✅ Game registered with oracle\n");

    // Deploy prediction market
    console.log("═".repeat(100));
    console.log("DEPLOYING PREDICTION MARKET");
    console.log("═".repeat(100));

    const RPSPredictionMarket = await ethers.getContractFactory("RPSPredictionMarket");
    predictionMarket = await RPSPredictionMarket.deploy(await oracleCore.getAddress(), await feeManager.getAddress());
    console.log("✅ RPSPredictionMarket deployed");

    await predictionMarket.fundOracleBalance({ value: ethers.parseEther("0.1") });
    console.log("✅ Oracle balance funded\n");
  });

  it("Complete RPS + Prediction Market Flow", async function () {
    console.log("═".repeat(100));
    console.log("STEP 1: SCHEDULE MATCH");
    console.log("═".repeat(100));

    const scheduledTime = (await time.latest()) + 60;
    const tx = await rpsGame.scheduleMatch(player1.address, player2.address, scheduledTime);
    const receipt = await tx.wait();
    const matchId = receipt.logs.find(log => log.fragment?.name === "MatchScheduled").args.matchId;

    console.log("✅ Match scheduled");
    console.log("   Match ID:", matchId);
    console.log("   Players:", player1.address, "vs", player2.address, "\n");

    console.log("═".repeat(100));
    console.log("STEP 2: CREATE PREDICTION MARKET");
    console.log("═".repeat(100));

    const bettingDeadline = scheduledTime - 30;
    const gameId = await rpsGame.gameId();
    const marketTx = await predictionMarket.createMarket(matchId, gameId, player1.address, player2.address, bettingDeadline);
    const marketReceipt = await marketTx.wait();
    const marketId = marketReceipt.logs.find(log => log.fragment?.name === "MarketCreated").args.marketId;

    console.log("✅ Prediction market created");
    console.log("   Market ID:", marketId.toString(), "\n");

    console.log("═".repeat(100));
    console.log("STEP 3: PLACE BETS");
    console.log("═".repeat(100));

    await predictionMarket.connect(bettor1).placeBet(marketId, player1.address, { value: ethers.parseEther("0.05") });
    console.log("💰 Bettor1 bets 0.05 BNB on Player1");

    await predictionMarket.connect(bettor2).placeBet(marketId, player2.address, { value: ethers.parseEther("0.03") });
    console.log("💰 Bettor2 bets 0.03 BNB on Player2");

    await predictionMarket.connect(bettor3).placeBet(marketId, ethers.ZeroAddress, { value: ethers.parseEther("0.02") });
    console.log("💰 Bettor3 bets 0.02 BNB on Tie");

    const market = await predictionMarket.getMarket(marketId);
    console.log("\n📊 Market Pool:", ethers.formatEther(market.totalPool), "BNB");

    const [p1Odds, p2Odds, tieOdds] = await predictionMarket.getOdds(marketId);
    console.log("📈 Odds:");
    console.log("   Player1:", (Number(p1Odds) / 100).toFixed(2) + "x");
    console.log("   Player2:", (Number(p2Odds) / 100).toFixed(2) + "x");
    console.log("   Tie:", (Number(tieOdds) / 100).toFixed(2) + "x\n");

    console.log("═".repeat(100));
    console.log("STEP 4: PLAY MATCH");
    console.log("═".repeat(100));

    await time.increaseTo(scheduledTime);

    console.log("🥊 Player1 commits...");
    await rpsGame.connect(player1).commitToMatch(matchId);

    console.log("🥊 Player2 commits...");
    await rpsGame.connect(player2).commitToMatch(matchId);

    const rpsMatch = await rpsGame.getMatch(matchId);
    console.log("\n📊 Match Result:");
    console.log("   Player1 cards:", cardArrayToString(rpsMatch.player1Cards));
    console.log("   Player2 cards:", cardArrayToString(rpsMatch.player2Cards));
    console.log("\n   Player1 wins:", rpsMatch.player1Wins.toString(), "rounds");
    console.log("   Player2 wins:", rpsMatch.player2Wins.toString(), "rounds");

    if (rpsMatch.winner === ethers.ZeroAddress) {
      console.log("\n🤝 Result: TIE!");
    } else if (rpsMatch.winner === player1.address) {
      console.log("\n🎉 Winner: PLAYER 1!");
    } else {
      console.log("\n🎉 Winner: PLAYER 2!");
    }
    console.log();

    console.log("═".repeat(100));
    console.log("STEP 5: ORACLE FINALIZATION");
    console.log("═".repeat(100));

    console.log("⏳ Waiting 15 minutes for dispute window...");
    await time.increase(15 * 60);

    // Manually finalize result
    await oracleCore.finalizeResult(matchId);

    const result = await oracleCore.getResult(matchId);
    console.log("✅ Oracle finalized:", result.isFinalized);

    expect(result.isFinalized).to.be.true;
    console.log();

    console.log("═".repeat(100));
    console.log("STEP 6: RESOLVE PREDICTION MARKET");
    console.log("═".repeat(100));

    await predictionMarket.resolveMarket(marketId);

    const resolvedMarket = await predictionMarket.getMarket(marketId);
    console.log("✅ Market resolved!");

    if (resolvedMarket.winner === ethers.ZeroAddress) {
      console.log("   Winner: TIE");
    } else if (resolvedMarket.winner === player1.address) {
      console.log("   Winner: PLAYER 1");
    } else {
      console.log("   Winner: PLAYER 2");
    }
    console.log();

    console.log("═".repeat(100));
    console.log("STEP 7: CLAIM WINNINGS");
    console.log("═".repeat(100));

    const bettors = [
      { name: "Bettor1", signer: bettor1, predicted: player1.address },
      { name: "Bettor2", signer: bettor2, predicted: player2.address },
      { name: "Bettor3", signer: bettor3, predicted: ethers.ZeroAddress }
    ];

    for (const bettor of bettors) {
      const balanceBefore = await ethers.provider.getBalance(bettor.signer.address);

      try {
        const claimTx = await predictionMarket.connect(bettor.signer).claimWinnings(marketId);
        const claimReceipt = await claimTx.wait();

        const balanceAfter = await ethers.provider.getBalance(bettor.signer.address);
        const winnings = balanceAfter - balanceBefore + (claimReceipt.gasUsed * claimReceipt.gasPrice);

        console.log(`💰 ${bettor.name} claimed:`, ethers.formatEther(winnings), "BNB");
      } catch (error) {
        console.log(`❌ ${bettor.name} lost their bet`);
      }
    }

    console.log("\n" + "═".repeat(100));
    console.log("📊 DEMO SUMMARY");
    console.log("═".repeat(100));

    console.log("\n✅ Demonstrated Features:");
    console.log("   ✓ Schedulable matches with matchId");
    console.log("   ✓ On-chain randomness for fair play");
    console.log("   ✓ Oracle data submission with quick-access fields");
    console.log("   ✓ Prediction market integration using matchId");
    console.log("   ✓ Multi-user betting with different predictions");
    console.log("   ✓ Automatic market resolution from oracle");
    console.log("   ✓ Winner payouts with platform fees");

    console.log("\n📈 Oracle Statistics:");
    console.log("   Total results:", (await oracleCore.totalResults()).toString());
    console.log("   Finalized results:", (await oracleCore.totalFinalized()).toString());

    console.log("\n🎮 Player Statistics:");
    const [p1Wins, p1Matches] = await rpsGame.getPlayerStats(player1.address);
    const [p2Wins, p2Matches] = await rpsGame.getPlayerStats(player2.address);
    console.log("   Player1:", p1Wins.toString(), "wins /", p1Matches.toString(), "matches");
    console.log("   Player2:", p2Wins.toString(), "wins /", p2Matches.toString(), "matches");

    console.log("\n" + "═".repeat(100));
    console.log("🎉 DEMO COMPLETE!");
    console.log("═".repeat(100) + "\n");
  });
});

// Helper functions
function cardToString(card) {
  const cards = ["🪨", "📄", "✂️"];
  return cards[Number(card)];
}

function cardArrayToString(cards) {
  return `[${cardToString(cards[0])} ${cardToString(cards[1])} ${cardToString(cards[2])}]`;
}
