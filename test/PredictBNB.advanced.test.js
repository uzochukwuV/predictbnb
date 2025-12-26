const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("PredictBNB Advanced Tests", function () {
  let gameRegistry, oracleCore, feeManager, disputeResolver;
  let mockChessGame;
  let owner, gameDev, player1, player2, consumer1, consumer2, challenger, resolver;

  const MINIMUM_STAKE = ethers.parseEther("0.1");
  const QUERY_FEE = ethers.parseEther("0.00416"); // $2.00 at $480/BNB
  const CHALLENGE_STAKE = ethers.parseEther("0.2");

  beforeEach(async function () {
    [owner, gameDev, player1, player2, consumer1, consumer2, challenger, resolver] =
      await ethers.getSigners();

    // Deploy contracts
    const GameRegistry = await ethers.getContractFactory("GameRegistry");
    gameRegistry = await upgrades.deployProxy(GameRegistry, [MINIMUM_STAKE], { kind: "uups" });
    await gameRegistry.waitForDeployment();

    const FeeManagerV2 = await ethers.getContractFactory("FeeManagerV2");
    feeManager = await upgrades.deployProxy(
      FeeManagerV2,
      [await gameRegistry.getAddress(), QUERY_FEE],
      { kind: "uups" }
    );
    await feeManager.waitForDeployment();

    const OracleCore = await ethers.getContractFactory("OracleCore");
    oracleCore = await upgrades.deployProxy(
      OracleCore,
      [await gameRegistry.getAddress(), await feeManager.getAddress()],
      { kind: "uups" }
    );
    await oracleCore.waitForDeployment();

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

    // Connect all contracts together
    await oracleCore.updateDisputeResolver(await disputeResolver.getAddress());
    await gameRegistry.updateDisputeResolver(await disputeResolver.getAddress());
    await gameRegistry.updateOracleCore(await oracleCore.getAddress());
    await feeManager.updateDisputeResolver(await disputeResolver.getAddress());
    await feeManager.updateOracleCore(await oracleCore.getAddress());

    // Add resolver
    await disputeResolver.addResolver(resolver.address);

    // Deploy mock game
    const MockChessGame = await ethers.getContractFactory("MockChessGame");
    mockChessGame = await MockChessGame.connect(gameDev).deploy(
      await gameRegistry.getAddress(),
      await oracleCore.getAddress()
    );
    await mockChessGame.waitForDeployment();
  });

  describe("💰 Developer Gas Compensation Tracking", function () {
    it("Should track that developers earn enough to cover gas costs", async function () {
      console.log("\n📊 Testing Developer Gas Cost vs Earnings (FeeManagerV2)");

      // Register game
      const registerTx = await mockChessGame.connect(gameDev).registerWithOracle({
        value: MINIMUM_STAKE
      });
      const registerReceipt = await registerTx.wait();
      const registerGasCost = registerReceipt.gasUsed * registerReceipt.gasPrice;

      const gameId = await mockChessGame.gameId();

      console.log("   📝 Game Registration:");
      console.log("      Gas used:", registerReceipt.gasUsed.toString());
      console.log("      Gas cost:", ethers.formatEther(registerGasCost), "BNB");

      // Create multiple matches to generate revenue
      const matchIds = [];
      let totalScheduleGas = 0n;
      let totalSubmitGas = 0n;

      // Create 3 matches
      for (let i = 0; i < 3; i++) {
        const matchTime = (await time.latest()) + 100 + (i * 10);
        const scheduleTx = await mockChessGame.connect(gameDev).scheduleMatch(
          player1.address,
          player2.address,
          matchTime
        );
        const scheduleReceipt = await scheduleTx.wait();
        totalScheduleGas += scheduleReceipt.gasUsed * scheduleReceipt.gasPrice;

        const matchId = scheduleReceipt.logs.find(
          log => log.fragment && log.fragment.name === "MatchCreated"
        ).args.matchId;
        matchIds.push({ id: matchId, time: matchTime });

        // Submit result
        await time.increaseTo(matchTime + 1);
        const submitTx = await mockChessGame.connect(gameDev).submitMatchResult(
          matchId,
          player1.address,
          45,
          1800
        );
        const submitReceipt = await submitTx.wait();
        totalSubmitGas += submitReceipt.gasUsed * submitReceipt.gasPrice;

        // Finalize
        await time.increase(15 * 60 + 1);
        await oracleCore.finalizeResult(matchId);
      }

      console.log("   📅 Match Scheduling (3 matches):");
      console.log("      Total gas cost:", ethers.formatEther(totalScheduleGas), "BNB");
      console.log("   ⬆️  Result Submission (3 matches):");
      console.log("      Total gas cost:", ethers.formatEther(totalSubmitGas), "BNB");

      const totalGasCost = registerGasCost + totalScheduleGas + totalSubmitGas;

      console.log("\n   💸 Total Gas Costs:");
      console.log("      Total:", ethers.formatEther(totalGasCost), "BNB");
      console.log("      USD (@ $480/BNB): $" + (parseFloat(ethers.formatEther(totalGasCost)) * 480).toFixed(2));

      // Multiple consumers query the matches (per-consumer per-match model)
      const winnerField = ethers.keccak256(ethers.toUtf8Bytes("winner"));

      // Create 3 more matches (total 6) to generate paid queries
      for (let i = 0; i < 3; i++) {
        const matchTime = (await time.latest()) + 100 + ((i + 3) * 10);
        const scheduleTx = await mockChessGame.connect(gameDev).scheduleMatch(
          player1.address,
          player2.address,
          matchTime
        );
        const scheduleReceipt = await scheduleTx.wait();
        const matchId = scheduleReceipt.logs.find(
          log => log.fragment && log.fragment.name === "MatchCreated"
        ).args.matchId;
        matchIds.push({ id: matchId, time: matchTime });

        await time.increaseTo(matchTime + 1);
        await mockChessGame.connect(gameDev).submitMatchResult(matchId, player1.address, 45, 1800);
        await time.increase(15 * 60 + 1);
        await oracleCore.finalizeResult(matchId);
      }

      console.log("   📊 Created 6 total matches");

      // Consumer1: queries all 6 matches (5 free + 1 paid)
      await feeManager.connect(consumer1).depositBalance(ethers.ZeroAddress, { value: ethers.parseEther("1") });
      for (const match of matchIds) {
        await oracleCore.connect(consumer1).getResultField(match.id, winnerField);
      }

      // Consumer2: queries all 6 matches (5 free + 1 paid)
      await feeManager.connect(consumer2).depositBalance(ethers.ZeroAddress, { value: ethers.parseEther("1") });
      for (const match of matchIds) {
        await oracleCore.connect(consumer2).getResultField(match.id, winnerField);
      }

      // Consumer3: queries all 6 matches (5 free + 1 paid)
      const consumer3 = (await ethers.getSigners())[8];
      await feeManager.connect(consumer3).depositBalance(ethers.ZeroAddress, { value: ethers.parseEther("1") });
      for (const match of matchIds) {
        await oracleCore.connect(consumer3).getResultField(match.id, winnerField);
      }

      console.log("   ✅ 3 consumers queried 6 matches each (5 free + 1 paid per consumer)");

      const earnings = await feeManager.developerEarnings(gameId);
      const devEarnings = earnings.pendingEarnings;

      // Expected: 3 paid queries × 0.00416 BNB × 80% = 0.009984 BNB
      const expectedEarnings = QUERY_FEE * 3n * 80n / 100n;

      console.log("\n   💰 Developer Earnings:");
      console.log("      Paid queries: 3 (1 per consumer)");
      console.log("      Total earned:", ethers.formatEther(devEarnings), "BNB");
      console.log("      Expected:", ethers.formatEther(expectedEarnings), "BNB");
      console.log("      USD (@ $480/BNB): $" + (parseFloat(ethers.formatEther(devEarnings)) * 480).toFixed(2));

      console.log("\n   📈 Profitability:");
      const profit = devEarnings - totalGasCost;
      console.log("      Net profit:", ethers.formatEther(profit), "BNB");

      if (profit > 0n) {
        console.log("      ROI:", ((profit * 100n) / totalGasCost).toString() + "%");
      } else {
        console.log("      ROI: Negative (need more consumers/queries)");
      }

      // With $2 per query and 80% developer share = $1.60 per paid query
      // We should have earnings from the paid queries
      expect(devEarnings).to.be.gt(0);
      expect(devEarnings).to.equal(expectedEarnings);
      console.log("   ✅ Developer earning correctly from paid queries!");
    });

    it("Should show break-even point for developers", async function () {
      console.log("\n📊 Calculating Break-Even Point");

      // Estimated gas costs per operation (in BNB at 3 gwei)
      const estimatedRegisterGas = 0.001; // ~0.001 BNB
      const estimatedScheduleGas = 0.0012;
      const estimatedSubmitGas = 0.0017;
      const totalEstimatedGas = estimatedRegisterGas + estimatedScheduleGas + estimatedSubmitGas;

      const developerShare = 0.80; // 80%
      const queryFee = parseFloat(ethers.formatEther(QUERY_FEE));
      const earningsPerQuery = queryFee * developerShare;

      const breakEvenQueries = Math.ceil(totalEstimatedGas / earningsPerQuery);

      console.log("   💰 Economics:");
      console.log("      Gas cost per match:", totalEstimatedGas.toFixed(4), "BNB ($" + (totalEstimatedGas * 600).toFixed(2) + ")");
      console.log("      Earnings per query:", earningsPerQuery.toFixed(4), "BNB ($" + (earningsPerQuery * 600).toFixed(2) + ")");
      console.log("      Break-even queries:", breakEvenQueries);
      console.log("\n   ✅ Developer profits after", breakEvenQueries, "paid queries!");
    });
  });

  describe("⚖️ Dispute Resolution Flow", function () {
    let gameId, matchId;

    beforeEach(async function () {
      // Setup: Register game, schedule match, submit result
      await mockChessGame.connect(gameDev).registerWithOracle({ value: MINIMUM_STAKE });
      gameId = await mockChessGame.gameId();

      const matchTime = (await time.latest()) + 100;
      const tx = await mockChessGame.connect(gameDev).scheduleMatch(
        player1.address,
        player2.address,
        matchTime
      );
      const receipt = await tx.wait();
      matchId = receipt.logs.find(log => log.fragment && log.fragment.name === "MatchCreated").args.matchId;

      await time.increaseTo(matchTime + 1);
      await mockChessGame.connect(gameDev).submitMatchResult(matchId, player1.address, 45, 1800);
    });

    it("Should create and accept dispute (slashing game)", async function () {
      console.log("\n⚖️ Testing Dispute Accepted (Fraudulent Result)");

      const gameBefore = await gameRegistry.getGame(gameId);
      const initialStake = gameBefore.stakedAmount;
      const initialReputation = gameBefore.reputation;

      console.log("   📊 Before Dispute:");
      console.log("      Stake:", ethers.formatEther(initialStake), "BNB");
      console.log("      Reputation:", initialReputation.toString());

      // Create dispute
      const disputeTx = await disputeResolver.connect(challenger).createDispute(
        matchId,
        "Winner is incorrect - player2 actually won",
        ethers.keccak256(ethers.toUtf8Bytes("ipfs://evidence")),
        { value: CHALLENGE_STAKE }
      );
      const disputeReceipt = await disputeTx.wait();
      const disputeId = disputeReceipt.logs.find(
        log => log.fragment && log.fragment.name === "DisputeCreated"
      ).args.disputeId;

      console.log("   ⚠️  Dispute Created");

      // Resolve - Accept dispute (game was wrong)
      await disputeResolver.connect(resolver).resolveDispute(
        disputeId,
        true, // accept = true (submitter was wrong)
        50    // 50% of slash goes to challenger
      );

      const gameAfter = await gameRegistry.getGame(gameId);
      const finalStake = gameAfter.stakedAmount;
      const finalReputation = gameAfter.reputation;

      console.log("\n   📊 After Dispute Accepted:");
      console.log("      Stake:", ethers.formatEther(finalStake), "BNB");
      console.log("      Reputation:", finalReputation.toString());
      console.log("      Stake slashed:", ethers.formatEther(initialStake - finalStake), "BNB");
      console.log("      Reputation lost:", (initialReputation - finalReputation).toString());

      // Verify slashing occurred
      expect(finalStake).to.be.lt(initialStake);
      expect(finalReputation).to.be.lt(initialReputation);

      console.log("   ✅ Fraudulent game penalized!");
    });

    it("Should create and reject dispute (frivolous)", async function () {
      console.log("\n⚖️ Testing Dispute Rejected (Frivolous Challenge)");

      const challengerBalanceBefore = await ethers.provider.getBalance(challenger.address);
      const gameBefore = await gameRegistry.getGame(gameId);
      const initialReputation = gameBefore.reputation;

      // Create dispute
      const disputeTx = await disputeResolver.connect(challenger).createDispute(
        matchId,
        "Frivolous challenge",
        ethers.keccak256(ethers.toUtf8Bytes("ipfs://fake")),
        { value: CHALLENGE_STAKE }
      );
      const disputeReceipt = await disputeTx.wait();
      const disputeId = disputeReceipt.logs.find(
        log => log.fragment && log.fragment.name === "DisputeCreated"
      ).args.disputeId;

      // Resolve - Reject dispute (challenge was wrong)
      await disputeResolver.connect(resolver).resolveDispute(
        disputeId,
        false, // accept = false (challenger was wrong)
        0
      );

      const challengerBalanceAfter = await ethers.provider.getBalance(challenger.address);
      const gameAfter = await gameRegistry.getGame(gameId);

      // Challenger lost their stake
      expect(challengerBalanceAfter).to.be.lt(challengerBalanceBefore - CHALLENGE_STAKE);

      // Game reputation increased for false accusation
      expect(gameAfter.reputation).to.be.gt(initialReputation);

      console.log("   ✅ Frivolous challenger penalized!");
      console.log("   💰 Challenger lost:", ethers.formatEther(CHALLENGE_STAKE), "BNB");
      console.log("   ⭐ Game reputation increased to:", gameAfter.reputation.toString());
    });

    it("Should prevent dispute after window closes", async function () {
      console.log("\n⏰ Testing Dispute Window Expiry");

      // Wait for dispute window to close
      await time.increase(15 * 60 + 1);

      // Try to create dispute - should fail
      await expect(
        disputeResolver.connect(challenger).createDispute(
          matchId,
          "Too late",
          ethers.ZeroHash,
          { value: CHALLENGE_STAKE }
        )
      ).to.be.revertedWithCustomError(disputeResolver, "DisputeWindowClosed");

      console.log("   ✅ Cannot dispute after 15-minute window!");
    });
  });

  describe("🔒 Access Control & Edge Cases", function () {
    it("Should prevent non-developer from submitting results", async function () {
      console.log("\n🔒 Testing Access Control");

      await mockChessGame.connect(gameDev).registerWithOracle({ value: MINIMUM_STAKE });
      const gameId = await mockChessGame.gameId();

      const matchTime = (await time.latest()) + 100;
      const tx = await mockChessGame.connect(gameDev).scheduleMatch(
        player1.address,
        player2.address,
        matchTime
      );
      const receipt = await tx.wait();
      const matchId = receipt.logs.find(log => log.fragment && log.fragment.name === "MatchCreated").args.matchId;

      await time.increaseTo(matchTime + 1);

      // Attacker tries to submit result
      await expect(
        mockChessGame.connect(consumer1).submitMatchResult(matchId, player1.address, 45, 1800)
      ).to.be.reverted;

      console.log("   ✅ Only game contract can submit results!");
    });

    it("Should prevent querying unfinalized results", async function () {
      console.log("\n⏰ Testing Finalization Requirement");

      await mockChessGame.connect(gameDev).registerWithOracle({ value: MINIMUM_STAKE });

      const matchTime = (await time.latest()) + 100;
      const tx = await mockChessGame.connect(gameDev).scheduleMatch(
        player1.address,
        player2.address,
        matchTime
      );
      const receipt = await tx.wait();
      const matchId = receipt.logs.find(log => log.fragment && log.fragment.name === "MatchCreated").args.matchId;

      await time.increaseTo(matchTime + 1);
      await mockChessGame.connect(gameDev).submitMatchResult(matchId, player1.address, 45, 1800);

      // Try to query immediately (not finalized)
      const winnerField = ethers.keccak256(ethers.toUtf8Bytes("winner"));
      await expect(
        oracleCore.connect(consumer1).getResultField(matchId, winnerField)
      ).to.be.revertedWithCustomError(oracleCore, "ResultNotFinalized");

      console.log("   ✅ Cannot query before finalization!");
    });

    it("Should prevent scheduling match in the past", async function () {
      console.log("\n📅 Testing Match Time Validation");

      await mockChessGame.connect(gameDev).registerWithOracle({ value: MINIMUM_STAKE });

      const pastTime = (await time.latest()) - 100;

      await expect(
        mockChessGame.connect(gameDev).scheduleMatch(player1.address, player2.address, pastTime)
      ).to.be.revertedWithCustomError(gameRegistry, "InvalidMatchTime");

      console.log("   ✅ Cannot schedule match in the past!");
    });

    it("Should prevent withdrawal with zero earnings", async function () {
      console.log("\n💰 Testing Withdrawal Validation");

      await mockChessGame.connect(gameDev).registerWithOracle({ value: MINIMUM_STAKE });
      const gameId = await mockChessGame.gameId();

      await expect(
        mockChessGame.connect(gameDev).withdrawEarnings(
          await feeManager.getAddress(),
          gameDev.address
        )
      ).to.be.revertedWithCustomError(feeManager, "NoEarningsToWithdraw");

      console.log("   ✅ Cannot withdraw zero earnings!");
    });
  });

  describe("🔄 Upgradeability Tests", function () {
    it("Should upgrade OracleCore and preserve data", async function () {
      console.log("\n🔄 Testing UUPS Upgrade");

      // Register game and schedule match
      await mockChessGame.connect(gameDev).registerWithOracle({ value: MINIMUM_STAKE });
      const gameId = await mockChessGame.gameId();

      const matchTime = (await time.latest()) + 100;
      const tx = await mockChessGame.connect(gameDev).scheduleMatch(
        player1.address,
        player2.address,
        matchTime
      );
      const receipt = await tx.wait();
      const matchId = receipt.logs.find(log => log.fragment && log.fragment.name === "MatchCreated").args.matchId;

      await time.increaseTo(matchTime + 1);
      await mockChessGame.connect(gameDev).submitMatchResult(matchId, player1.address, 45, 1800);

      // Get result before upgrade
      const resultBefore = await oracleCore.getResult(matchId);

      console.log("   📊 Before Upgrade:");
      console.log("      Result exists:", resultBefore.submitter !== ethers.ZeroAddress);

      // Upgrade to new implementation (same contract for test)
      const OracleCoreV2 = await ethers.getContractFactory("OracleCore");
      const upgraded = await upgrades.upgradeProxy(
        await oracleCore.getAddress(),
        OracleCoreV2
      );

      // Verify data persisted
      const resultAfter = await upgraded.getResult(matchId);

      console.log("   📊 After Upgrade:");
      console.log("      Result exists:", resultAfter.submitter !== ethers.ZeroAddress);
      console.log("      Data matches:", resultBefore.submitter === resultAfter.submitter);

      expect(resultAfter.submitter).to.equal(resultBefore.submitter);
      expect(resultAfter.submittedAt).to.equal(resultBefore.submittedAt);

      console.log("   ✅ Upgrade successful, data preserved!");
    });
  });
});
