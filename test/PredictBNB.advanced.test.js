const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("PredictBNB Advanced Tests", function () {
  let gameRegistry, oracleCore, feeManager, disputeResolver;
  let mockChessGame;
  let owner, gameDev, player1, player2, consumer1, challenger, resolver;

  const MINIMUM_STAKE = ethers.parseEther("0.1");
  const QUERY_FEE = ethers.parseEther("0.003");
  const CHALLENGE_STAKE = ethers.parseEther("0.2");

  beforeEach(async function () {
    [owner, gameDev, player1, player2, consumer1, challenger, resolver] =
      await ethers.getSigners();

    // Deploy contracts
    const GameRegistry = await ethers.getContractFactory("GameRegistry");
    gameRegistry = await upgrades.deployProxy(GameRegistry, [MINIMUM_STAKE], { kind: "uups" });
    await gameRegistry.waitForDeployment();

    const FeeManager = await ethers.getContractFactory("FeeManager");
    feeManager = await upgrades.deployProxy(
      FeeManager,
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

    // Connect all contracts to DisputeResolver
    await oracleCore.updateDisputeResolver(await disputeResolver.getAddress());
    await gameRegistry.updateDisputeResolver(await disputeResolver.getAddress());
    await feeManager.updateDisputeResolver(await disputeResolver.getAddress());

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
      console.log("\n📊 Testing Developer Gas Cost vs Earnings");

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

      // Schedule match
      const matchTime = (await time.latest()) + 100;
      const scheduleTx = await mockChessGame.connect(gameDev).scheduleMatch(
        player1.address,
        player2.address,
        matchTime
      );
      const scheduleReceipt = await scheduleTx.wait();
      const scheduleGasCost = scheduleReceipt.gasUsed * scheduleReceipt.gasPrice;
      const matchId = scheduleReceipt.logs.find(
        log => log.fragment && log.fragment.name === "MatchCreated"
      ).args.matchId;

      console.log("   📅 Match Scheduling:");
      console.log("      Gas used:", scheduleReceipt.gasUsed.toString());
      console.log("      Gas cost:", ethers.formatEther(scheduleGasCost), "BNB");

      // Submit result
      await time.increaseTo(matchTime + 1);
      const submitTx = await mockChessGame.connect(gameDev).submitMatchResult(
        matchId,
        player1.address,
        45,
        1800
      );
      const submitReceipt = await submitTx.wait();
      const submitGasCost = submitReceipt.gasUsed * submitReceipt.gasPrice;

      console.log("   ⬆️  Result Submission:");
      console.log("      Gas used:", submitReceipt.gasUsed.toString());
      console.log("      Gas cost:", ethers.formatEther(submitGasCost), "BNB");

      const totalGasCost = registerGasCost + scheduleGasCost + submitGasCost;

      console.log("\n   💸 Total Gas Costs:");
      console.log("      Total:", ethers.formatEther(totalGasCost), "BNB");
      console.log("      USD (@ $600/BNB): $" + (parseFloat(ethers.formatEther(totalGasCost)) * 600).toFixed(2));

      // Finalize and generate queries
      await time.increase(15 * 60 + 1);
      await oracleCore.finalizeResult(matchId);

      // Consumer deposits and makes paid queries
      await feeManager.connect(consumer1).depositBalance({ value: ethers.parseEther("1") });

      const winnerField = ethers.keccak256(ethers.toUtf8Bytes("winner"));

      // Exhaust free tier
      for (let i = 0; i < 50; i++) {
        await oracleCore.connect(consumer1).getResultField(matchId, winnerField);
      }

      // Make paid queries
      const queriesNeeded = Math.ceil(parseFloat(ethers.formatEther(totalGasCost)) / parseFloat(ethers.formatEther(QUERY_FEE)) / 0.8) + 1;

      for (let i = 0; i < queriesNeeded; i++) {
        await oracleCore.connect(consumer1).getResultField(matchId, winnerField);
      }

      const earnings = await feeManager.getDeveloperEarnings(gameId);
      const devEarnings = earnings.pendingEarnings;

      console.log("\n   💰 Developer Earnings:");
      console.log("      Paid queries:", queriesNeeded);
      console.log("      Total earned:", ethers.formatEther(devEarnings), "BNB");
      console.log("      USD (@ $600/BNB): $" + (parseFloat(ethers.formatEther(devEarnings)) * 600).toFixed(2));

      console.log("\n   📈 Profitability:");
      const profit = devEarnings - totalGasCost;
      console.log("      Net profit:", ethers.formatEther(profit), "BNB");
      console.log("      ROI:", ((profit * 100n) / totalGasCost).toString() + "%");

      // Developer should profit after enough queries
      expect(devEarnings).to.be.gt(totalGasCost);
      console.log("   ✅ Developer compensated fairly for gas costs!");
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
