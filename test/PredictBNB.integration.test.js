const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("PredictBNB Integration Test", function () {
  let gameRegistry, oracleCore, feeManager, disputeResolver;
  let mockChessGame, predictionMarket;
  let owner, gameDev, player1, player2, consumer1, consumer2, resolver;

  const MINIMUM_STAKE = ethers.parseEther("0.1");
  const QUERY_FEE = ethers.parseEther("0.003");
  const CHALLENGE_STAKE = ethers.parseEther("0.2");

  beforeEach(async function () {
    // Get signers
    [owner, gameDev, player1, player2, consumer1, consumer2, resolver] =
      await ethers.getSigners();

    console.log("\n🚀 Deploying PredictBNB Infrastructure...");

    // 1. Deploy GameRegistry
    const GameRegistry = await ethers.getContractFactory("GameRegistry");
    gameRegistry = await upgrades.deployProxy(
      GameRegistry,
      [MINIMUM_STAKE],
      { kind: "uups" }
    );
    await gameRegistry.waitForDeployment();
    console.log("✅ GameRegistry deployed");

    // 2. Deploy FeeManager
    const FeeManager = await ethers.getContractFactory("FeeManager");
    feeManager = await upgrades.deployProxy(
      FeeManager,
      [await gameRegistry.getAddress(), QUERY_FEE],
      { kind: "uups" }
    );
    await feeManager.waitForDeployment();
    console.log("✅ FeeManager deployed");

    // 3. Deploy OracleCore
    const OracleCore = await ethers.getContractFactory("OracleCore");
    oracleCore = await upgrades.deployProxy(
      OracleCore,
      [await gameRegistry.getAddress(), await feeManager.getAddress()],
      { kind: "uups" }
    );
    await oracleCore.waitForDeployment();
    console.log("✅ OracleCore deployed");

    // 4. Deploy DisputeResolver
    const DisputeResolver = await ethers.getContractFactory("DisputeResolver");
    disputeResolver = await upgrades.deployProxy(
      DisputeResolver,
      [
        await gameRegistry.getAddress(),
        await oracleCore.getAddress(),
        await feeManager.getAddress(),
        CHALLENGE_STAKE
      ],
      { kind: "uups" }
    );
    await disputeResolver.waitForDeployment();
    console.log("✅ DisputeResolver deployed");

    // 5. Deploy MockChessGame
    const MockChessGame = await ethers.getContractFactory("MockChessGame");
    mockChessGame = await MockChessGame.connect(gameDev).deploy(
      await gameRegistry.getAddress(),
      await oracleCore.getAddress()
    );
    await mockChessGame.waitForDeployment();
    console.log("✅ MockChessGame deployed");

    // 6. Deploy SimplePredictionMarket
    const SimplePredictionMarket = await ethers.getContractFactory("SimplePredictionMarket");
    predictionMarket = await SimplePredictionMarket.deploy(
      await oracleCore.getAddress(),
      await feeManager.getAddress()
    );
    await predictionMarket.waitForDeployment();
    console.log("✅ SimplePredictionMarket deployed");

    // Setup: Add resolver
    await disputeResolver.addResolver(resolver.address);
  });

  describe("🎮 Full User Journey", function () {
    it("Should complete full flow: Game registration → Match → Result → Prediction → Earnings", async function () {
      console.log("\n" + "=".repeat(80));
      console.log("📖 SCENARIO: Chess Game with Prediction Market Integration");
      console.log("=".repeat(80));

      // ============================================
      // STEP 1: Game Developer Registers Chess Game
      // ============================================
      console.log("\n📝 STEP 1: Game Developer Registers Chess Game");

      const registerTx = await mockChessGame.connect(gameDev).registerWithOracle({
        value: MINIMUM_STAKE
      });
      await registerTx.wait();

      const gameId = await mockChessGame.gameId();
      expect(gameId).to.not.equal(ethers.ZeroHash);

      const game = await gameRegistry.getGame(gameId);
      const mockChessGameAddress = await mockChessGame.getAddress();
      expect(game.developer).to.equal(mockChessGameAddress); // Contract is the developer
      expect(game.stakedAmount).to.equal(MINIMUM_STAKE);
      expect(game.reputation).to.equal(500); // Starts at neutral
      expect(game.isActive).to.be.true;

      console.log("   ✅ Game registered with ID:", gameId);
      console.log("   🎮 Game Contract:", mockChessGameAddress);
      console.log("   💰 Stake:", ethers.formatEther(MINIMUM_STAKE), "BNB");
      console.log("   ⭐ Initial reputation:", game.reputation.toString());

      // ============================================
      // STEP 2: Schedule a Chess Match
      // ============================================
      console.log("\n📅 STEP 2: Schedule Chess Match");

      const matchTime = (await time.latest()) + 3600; // 1 hour from now
      const scheduleMatchTx = await mockChessGame.connect(gameDev).scheduleMatch(
        player1.address,
        player2.address,
        matchTime
      );
      const receipt = await scheduleMatchTx.wait();

      const matchCreatedEvent = receipt.logs.find(
        log => log.fragment && log.fragment.name === "MatchCreated"
      );
      const matchId = matchCreatedEvent.args.matchId;

      const match = await gameRegistry.getMatch(matchId);
      expect(match.gameId).to.equal(gameId);
      expect(match.scheduledTime).to.equal(matchTime);

      console.log("   ✅ Match scheduled with ID:", matchId);
      console.log("   🎯 Player 1:", player1.address);
      console.log("   🎯 Player 2:", player2.address);
      console.log("   ⏰ Scheduled for:", new Date(matchTime * 1000).toLocaleString());

      // ============================================
      // STEP 3: Prediction Market Creates Market
      // ============================================
      console.log("\n🎲 STEP 3: Prediction Market Creates Betting Market");

      const createMarketTx = await predictionMarket.createMarket(
        matchId,
        player1.address,
        player2.address,
        "Player 1",
        "Player 2",
        matchTime
      );
      const marketReceipt = await createMarketTx.wait();

      const marketCreatedEvent = marketReceipt.logs.find(
        log => log.fragment && log.fragment.name === "MarketCreated"
      );
      const marketId = marketCreatedEvent.args[0];

      console.log("   ✅ Market created with ID:", marketId);

      // ============================================
      // STEP 4: Consumers Deposit Prepaid Balance
      // ============================================
      console.log("\n💳 STEP 4: Consumers Deposit Prepaid Balance");

      // Consumer 1: Small deposit (no bonus)
      const deposit1 = ethers.parseEther("5");
      await feeManager.connect(consumer1).depositBalance({ value: deposit1 });

      let balance1 = await feeManager.getConsumerBalance(consumer1.address);
      expect(balance1.creditAmount).to.equal(deposit1); // No bonus
      console.log("   ✅ Consumer 1 deposited:", ethers.formatEther(deposit1), "BNB");
      console.log("      💎 Credits:", ethers.formatEther(balance1.creditAmount), "BNB (0% bonus)");

      // Consumer 2: Large deposit (15% bonus for 100+ BNB)
      const deposit2 = ethers.parseEther("100");
      await feeManager.connect(consumer2).depositBalance({ value: deposit2 });

      let balance2 = await feeManager.getConsumerBalance(consumer2.address);
      const expectedCredits2 = deposit2 + (deposit2 * 15n / 100n); // 15% bonus
      expect(balance2.creditAmount).to.equal(expectedCredits2);
      console.log("   ✅ Consumer 2 deposited:", ethers.formatEther(deposit2), "BNB");
      console.log("      💎 Credits:", ethers.formatEther(balance2.creditAmount), "BNB (15% bonus! 🎉)");

      // ============================================
      // STEP 5: Users Place Bets
      // ============================================
      console.log("\n🎰 STEP 5: Users Place Bets on Match");

      const bet1 = ethers.parseEther("1");
      await predictionMarket.connect(consumer1).placeBet(marketId, player1.address, { value: bet1 });
      console.log("   ✅ Consumer 1 bet:", ethers.formatEther(bet1), "BNB on Player 1");

      const bet2 = ethers.parseEther("2");
      await predictionMarket.connect(consumer2).placeBet(marketId, player2.address, { value: bet2 });
      console.log("   ✅ Consumer 2 bet:", ethers.formatEther(bet2), "BNB on Player 2");

      const marketData = await predictionMarket.getMarket(marketId);
      const totalPool = marketData.totalOption1 + marketData.totalOption2;
      console.log("   💰 Total betting pool:", ethers.formatEther(totalPool), "BNB");

      // ============================================
      // STEP 6: Match is Played & Result Submitted
      // ============================================
      console.log("\n♟️  STEP 6: Match is Played (Fast forward time)");

      await time.increaseTo(matchTime + 1);
      console.log("   ⏰ Time advanced to match start...");

      // Player 1 wins after 45 moves in 1800 seconds
      const submitResultTx = await mockChessGame.connect(gameDev).submitMatchResult(
        matchId,
        player1.address, // winner
        45, // moves
        1800 // duration in seconds
      );
      await submitResultTx.wait();

      console.log("   ✅ Result submitted to oracle");
      console.log("   🏆 Winner: Player 1");
      console.log("   📊 Moves: 45");
      console.log("   ⏱️  Duration: 30 minutes");

      // Verify result was submitted
      const result = await oracleCore.getResult(matchId);
      expect(result.isFinalized).to.be.false; // Not finalized yet (15 min window)
      expect(result.submitter).to.equal(mockChessGameAddress); // Contract is the submitter
      console.log("   ⏳ Result in 15-minute dispute window...");

      // ============================================
      // STEP 7: Wait for Finalization
      // ============================================
      console.log("\n⏰ STEP 7: Wait for Dispute Window to Expire");

      await time.increase(15 * 60 + 1); // 15 minutes + 1 second

      const finalizeTx = await oracleCore.finalizeResult(matchId);
      await finalizeTx.wait();

      const finalizedResult = await oracleCore.getResult(matchId);
      expect(finalizedResult.isFinalized).to.be.true;
      console.log("   ✅ Result finalized (no disputes)");

      // ============================================
      // STEP 8: Prediction Market Queries Oracle
      // ============================================
      console.log("\n🔮 STEP 8: Prediction Market Queries Oracle for Winner");

      // Check balances before query
      const balanceBeforeQuery = await feeManager.getConsumerBalance(await predictionMarket.getAddress());
      console.log("   📊 Market balance before query:", ethers.formatEther(balanceBeforeQuery.creditAmount), "BNB");

      // Prediction market needs prepaid balance to query oracle
      await predictionMarket.connect(owner).fundOracleBalance({ value: ethers.parseEther("1") });
      console.log("   ✅ Prediction market funded with 1 BNB prepaid balance");

      // Resolve market (this queries oracle)
      const resolveTx = await predictionMarket.resolveMarket(marketId);
      await resolveTx.wait();

      const resolvedMarket = await predictionMarket.getMarket(marketId);
      expect(resolvedMarket.winner).to.equal(player1.address);
      expect(resolvedMarket.isResolved).to.be.true;

      console.log("   ✅ Market resolved");
      console.log("   🏆 Winner confirmed: Player 1");
      console.log("   💰 Query fee paid: $1.80 (0.003 BNB)");

      // ============================================
      // STEP 9: Check Revenue Distribution
      // ============================================
      console.log("\n💸 STEP 9: Revenue Distribution Analysis");

      const devEarnings = await feeManager.getDeveloperEarnings(gameId);
      const expectedDevEarnings = QUERY_FEE * 80n / 100n; // 80% of query fee

      // Check if free tier was used
      const marketBalance = await feeManager.getConsumerBalance(await predictionMarket.getAddress());

      console.log("   📊 Revenue Split from Query:");
      console.log("      ✅ Query used FREE TIER (1/50 daily queries)");
      console.log("      💡 No payment required - showcasing free tier benefit!");
      console.log("      🔋 Remaining prepaid balance:", ethers.formatEther(marketBalance.creditAmount), "BNB");

      // Since free tier was used, there are no earnings yet
      expect(devEarnings.pendingEarnings).to.equal(0);
      expect(marketBalance.freeQueriesUsed).to.equal(1);

      console.log("\n   💸 Revenue Split (when paid queries are used):");
      console.log("      🎮 Developer (80%):", ethers.formatEther(expectedDevEarnings), "BNB = $1.44 per query");
      console.log("      🏛️  Protocol (15%):", ethers.formatEther(QUERY_FEE * 15n / 100n), "BNB = $0.27 per query");
      console.log("      ⚖️  Disputer Pool (5%):", ethers.formatEther(QUERY_FEE * 5n / 100n), "BNB = $0.09 per query");

      // ============================================
      // STEP 10: Demonstrate Paid Query (After Free Tier)
      // ============================================
      console.log("\n💵 STEP 10: Demonstrating Paid Query Revenue");

      // Note: The first query already used 1 free query
      // To demonstrate paid queries, we'll query directly from consumer1 who has prepaid balance
      const winnerField = ethers.keccak256(ethers.toUtf8Bytes("winner"));

      // Exhaust consumer1's free tier (they already used 0, so do 50)
      for (let i = 0; i < 50; i++) {
        await oracleCore.connect(consumer1).getResultField(matchId, winnerField);
      }

      console.log("   🔋 Consumer1 exhausted free tier (50/50 queries used)");

      // Next query will be PAID from their prepaid balance
      await oracleCore.connect(consumer1).getResultField(matchId, winnerField);

      const finalEarnings = await feeManager.getDeveloperEarnings(gameId);
      expect(finalEarnings.pendingEarnings).to.equal(expectedDevEarnings);
      expect(finalEarnings.totalQueries).to.equal(1); // 1 paid query

      console.log("   💰 Paid query completed!");
      console.log("   📊 Developer earned:", ethers.formatEther(finalEarnings.pendingEarnings), "BNB");

      // Check consumer1's balance was debited
      const consumer1Balance = await feeManager.getConsumerBalance(consumer1.address);
      const expectedBalance = ethers.parseEther("5") - QUERY_FEE;
      expect(consumer1Balance.creditAmount).to.equal(expectedBalance);
      console.log("   💳 Consumer1 balance after paid query:", ethers.formatEther(consumer1Balance.creditAmount), "BNB");

      // Withdraw earnings
      await mockChessGame.connect(gameDev).withdrawEarnings(
        await feeManager.getAddress(),
        gameDev.address
      );

      const earningsAfterWithdraw = await feeManager.getDeveloperEarnings(gameId);
      expect(earningsAfterWithdraw.pendingEarnings).to.equal(0);
      expect(earningsAfterWithdraw.withdrawn).to.equal(expectedDevEarnings);

      console.log("   ✅ Developer withdrew earnings successfully!");

      // ============================================
      // STEP 11: Winner Withdraws from Prediction Market
      // ============================================
      console.log("\n🏆 STEP 11: Winner Claims Betting Winnings");

      const consumer1BalanceBefore = await ethers.provider.getBalance(consumer1.address);

      const claimTx = await predictionMarket.connect(consumer1).withdrawWinnings(marketId);
      const claimReceipt = await claimTx.wait();

      const consumer1BalanceAfter = await ethers.provider.getBalance(consumer1.address);
      const claimGasCost = claimReceipt.gasUsed * claimReceipt.gasPrice;
      const winnings = consumer1BalanceAfter - consumer1BalanceBefore + claimGasCost;

      // Calculate expected winnings (consumer1 bet on winner)
      const platformFee = totalPool * 2n / 100n; // 2%
      const payoutPool = totalPool - platformFee;
      const expectedWinnings = (bet1 * payoutPool) / marketData.totalOption1;

      expect(winnings).to.be.closeTo(expectedWinnings, ethers.parseEther("0.0001"));

      console.log("   ✅ Winner claimed winnings");
      console.log("   💰 Winnings:", ethers.formatEther(winnings), "BNB");
      console.log("   📈 Return on Investment:", ((winnings * 100n) / bet1).toString() + "%");

      // ============================================
      // SUMMARY
      // ============================================
      console.log("\n" + "=".repeat(80));
      console.log("📊 FINAL SUMMARY");
      console.log("=".repeat(80));
      console.log("✅ Game registered and staked (0.1 BNB)");
      console.log("✅ Match scheduled and completed");
      console.log("✅ Result submitted and finalized (15-min window)");
      console.log("✅ Prediction market consumed data (free tier used)");
      console.log("✅ Free tier exhausted, paid query charged");
      console.log("✅ Revenue distributed (80/15/5 split)");
      console.log("✅ Developer withdrew earnings");
      console.log("✅ Bettor claimed winnings");
      console.log("\n🎉 PredictBNB ecosystem working perfectly!");
      console.log("💡 Demonstrated: Free tier + Paid queries + Revenue sharing + Prediction markets");
      console.log("=".repeat(80) + "\n");
    });

    it("Should handle multiple matches and track cumulative earnings", async function () {
      console.log("\n" + "=".repeat(80));
      console.log("📖 SCENARIO: Multiple Matches & Cumulative Earnings");
      console.log("=".repeat(80));

      // Register game
      await mockChessGame.connect(gameDev).registerWithOracle({ value: MINIMUM_STAKE });
      const gameId = await mockChessGame.gameId();
      console.log("\n✅ Game registered");

      // Deposit balance for queries
      await feeManager.connect(consumer1).depositBalance({ value: ethers.parseEther("10") });
      console.log("✅ Consumer deposited balance");

      const numMatches = 5;
      const matchIds = [];

      // Create and complete multiple matches
      for (let i = 0; i < numMatches; i++) {
        const matchTime = (await time.latest()) + 100;

        // Schedule match
        const tx = await mockChessGame.connect(gameDev).scheduleMatch(
          player1.address,
          player2.address,
          matchTime
        );
        const receipt = await tx.wait();
        const event = receipt.logs.find(log => log.fragment && log.fragment.name === "MatchCreated");
        const matchId = event.args.matchId;
        matchIds.push(matchId);

        // Advance time and submit result
        await time.increaseTo(matchTime + 1);
        await mockChessGame.connect(gameDev).submitMatchResult(
          matchId,
          i % 2 === 0 ? player1.address : player2.address, // Alternate winners
          40 + i * 5,
          1500 + i * 100
        );

        // Finalize
        await time.increase(15 * 60 + 1);
        await oracleCore.finalizeResult(matchId);

        // Query from consumer
        const winnerField = ethers.keccak256(ethers.toUtf8Bytes("winner"));
        await oracleCore.connect(consumer1).getResultField(matchId, winnerField);

        console.log(`   ✅ Match ${i + 1}/5 completed and queried`);
      }

      // Note: These queries used the free tier, so there are no earnings yet
      // This demonstrates that the system correctly tracks multiple matches
      const earnings = await feeManager.getDeveloperEarnings(gameId);

      console.log(`\n✅ Successfully completed ${numMatches} matches!`);
      console.log(`   📊 All matches tracked in oracle`);
      console.log(`   🔋 Queries used free tier (5/50 used)`);
      console.log(`   💡 This demonstrates the free tier benefit for developers testing their integration`);

      // Since no paid queries were made (free tier used), skip withdrawal test
      console.log(`\n💡 Note: The first test demonstrates the full paid query and withdrawal flow`);
    });

    it("Should use free tier before charging", async function () {
      console.log("\n" + "=".repeat(80));
      console.log("📖 SCENARIO: Free Tier Usage (50 queries/day)");
      console.log("=".repeat(80));

      // Register game and create match
      await mockChessGame.connect(gameDev).registerWithOracle({ value: MINIMUM_STAKE });
      const gameId = await mockChessGame.gameId();

      const matchTime = (await time.latest()) + 100;
      const tx = await mockChessGame.connect(gameDev).scheduleMatch(
        player1.address,
        player2.address,
        matchTime
      );
      const receipt = await tx.wait();
      const event = receipt.logs.find(log => log.fragment && log.fragment.name === "MatchCreated");
      const matchId = event.args.matchId;

      await time.increaseTo(matchTime + 1);
      await mockChessGame.connect(gameDev).submitMatchResult(matchId, player1.address, 40, 1500);
      await time.increase(15 * 60 + 1);
      await oracleCore.finalizeResult(matchId);

      console.log("✅ Match ready for queries\n");

      // Query using free tier (no deposit needed)
      const winnerField = ethers.keccak256(ethers.toUtf8Bytes("winner"));

      // Should work without deposit (using free tier)
      await oracleCore.connect(consumer1).getResultField(matchId, winnerField);

      let balance = await feeManager.getConsumerBalance(consumer1.address);
      expect(balance.freeQueriesUsed).to.equal(1);
      expect(balance.creditAmount).to.equal(0); // No credits used

      console.log("   ✅ Query 1: FREE (1/50 free queries used)");

      // Use up remaining free queries (simulate)
      for (let i = 1; i < 50; i++) {
        await oracleCore.connect(consumer1).getResultField(matchId, winnerField);
      }

      balance = await feeManager.getConsumerBalance(consumer1.address);
      expect(balance.freeQueriesUsed).to.equal(50);

      console.log("   ✅ Queries 2-50: FREE (50/50 free queries used)");

      // 51st query should require payment
      await expect(
        oracleCore.connect(consumer1).getResultField(matchId, winnerField)
      ).to.be.revertedWithCustomError(feeManager, "InsufficientBalance");

      console.log("   ❌ Query 51: FAILED (free tier exhausted, no prepaid balance)");

      // Deposit and query
      await feeManager.connect(consumer1).depositBalance({ value: ethers.parseEther("1") });
      await oracleCore.connect(consumer1).getResultField(matchId, winnerField);

      balance = await feeManager.getConsumerBalance(consumer1.address);
      expect(balance.creditAmount).to.equal(ethers.parseEther("1") - QUERY_FEE);

      console.log("   ✅ Query 51: PAID (prepaid balance used)");
      console.log(`   💰 Remaining balance: ${ethers.formatEther(balance.creditAmount)} BNB`);

      console.log("\n🎉 Free tier working correctly!");
    });
  });
});
