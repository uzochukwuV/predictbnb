const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("OracleCoreV2 - Batch Operations", function () {
  let gameRegistry, schemaRegistry, schemaTemplates, oracleCore;
  let owner, gameDev, consumer;
  let matchIds = [];

  const REGISTRATION_STAKE = ethers.parseEther("0.1");

  beforeEach(async function () {
    [owner, gameDev, consumer] = await ethers.getSigners();

    // Deploy contracts
    const GameRegistry = await ethers.getContractFactory("GameRegistry");
    gameRegistry = await GameRegistry.deploy();
    await gameRegistry.waitForDeployment();

    const GameSchemaRegistry = await ethers.getContractFactory("GameSchemaRegistry");
    schemaRegistry = await GameSchemaRegistry.deploy();
    await schemaRegistry.waitForDeployment();

    const SchemaTemplates = await ethers.getContractFactory("SchemaTemplates");
    schemaTemplates = await SchemaTemplates.deploy(await schemaRegistry.getAddress());
    await schemaTemplates.waitForDeployment();

    const OracleCoreV2 = await ethers.getContractFactory("OracleCoreV2");
    oracleCore = await OracleCoreV2.deploy(
      await gameRegistry.getAddress(),
      await schemaRegistry.getAddress()
    );
    await oracleCore.waitForDeployment();

    // Transfer ownership
    await gameRegistry.transferOwnership(await oracleCore.getAddress());

    // Register game
    await gameRegistry.connect(gameDev).registerGame(
      "tournament-game-001",
      "Tournament Game",
      1, // FPS
      { value: REGISTRATION_STAKE }
    );

    // Schedule 10 matches
    const futureTime = (await time.latest()) + 3600;
    matchIds = [];

    for (let i = 0; i < 10; i++) {
      const tx = await gameRegistry.connect(gameDev).scheduleMatch(
        "tournament-game-001",
        `match-${i}`,
        futureTime + i * 100,
        `{"matchNumber": ${i}}`
      );

      const receipt = await tx.wait();
      const event = receipt.logs.find(log => {
        try {
          return gameRegistry.interface.parseLog(log).name === "MatchScheduled";
        } catch {
          return false;
        }
      });

      matchIds.push(gameRegistry.interface.parseLog(event).args.matchId);
    }

    // Fast forward past match times
    await time.increase(4000);
  });

  describe("Batch Submit Results", function () {
    it("Should batch submit 10 results successfully", async function () {
      const fpsSchemaId = await schemaTemplates.SCHEMA_FPS_PVP();

      // Prepare batch data
      const player1 = ethers.Wallet.createRandom().address;
      const player2 = ethers.Wallet.createRandom().address;

      const participants = new Array(10).fill(0).map(() => [player1, player2]);
      const scores = new Array(10).fill(0).map((_, i) => [16, 10 + i]); // Team 1 wins all
      const winnerIndices = new Array(10).fill(0);
      const durations = new Array(10).fill(2400);

      // Encode FPS data for each match
      const customDataArray = [];
      for (let i = 0; i < 10; i++) {
        const data = await schemaTemplates.encodeFPSData(
          10 + i,  // kills
          5,       // deaths
          7,       // assists
          4,       // headshots
          2000,    // damage
          0        // mvp
        );
        customDataArray.push(data);
      }

      // Batch submit
      const tx = await oracleCore.connect(gameDev).batchSubmitResultsV2(
        matchIds,
        gameDev.address,
        participants,
        scores,
        winnerIndices,
        durations,
        fpsSchemaId,
        customDataArray
      );

      const receipt = await tx.wait();

      // Check BatchResultsSubmitted event
      const batchEvent = receipt.logs.find(log => {
        try {
          return oracleCore.interface.parseLog(log).name === "BatchResultsSubmitted";
        } catch {
          return false;
        }
      });

      expect(batchEvent).to.not.be.undefined;
      const parsedEvent = oracleCore.interface.parseLog(batchEvent);
      expect(parsedEvent.args.successCount).to.equal(10);
      expect(parsedEvent.args.totalAttempted).to.equal(10);

      // Verify all results were submitted
      for (let i = 0; i < 10; i++) {
        const result = await oracleCore.getResultV2(matchIds[i]);
        expect(result.participants.length).to.equal(2);
        expect(result.scores[0]).to.equal(16);
        expect(result.winnerIndex).to.equal(0);
      }
    });

    it("Should handle partial batch submission (skip duplicates)", async function () {
      const fpsSchemaId = await schemaTemplates.SCHEMA_FPS_PVP();
      const player1 = ethers.Wallet.createRandom().address;
      const player2 = ethers.Wallet.createRandom().address;

      // Submit first 3 matches individually
      for (let i = 0; i < 3; i++) {
        const data = await schemaTemplates.encodeFPSData(10, 5, 7, 4, 2000, 0);
        await oracleCore.connect(gameDev).submitResultV2(
          matchIds[i],
          gameDev.address,
          [player1, player2],
          [16, 14],
          0,
          2400,
          fpsSchemaId,
          data
        );
      }

      // Try to batch submit all 10 (should skip first 3)
      const participants = new Array(10).fill(0).map(() => [player1, player2]);
      const scores = new Array(10).fill(0).map(() => [16, 14]);
      const winnerIndices = new Array(10).fill(0);
      const durations = new Array(10).fill(2400);
      const customDataArray = new Array(10).fill(
        await schemaTemplates.encodeFPSData(10, 5, 7, 4, 2000, 0)
      );

      const tx = await oracleCore.connect(gameDev).batchSubmitResultsV2(
        matchIds,
        gameDev.address,
        participants,
        scores,
        winnerIndices,
        durations,
        fpsSchemaId,
        customDataArray
      );

      const receipt = await tx.wait();
      const batchEvent = receipt.logs.find(log => {
        try {
          return oracleCore.interface.parseLog(log).name === "BatchResultsSubmitted";
        } catch {
          return false;
        }
      });

      const parsedEvent = oracleCore.interface.parseLog(batchEvent);
      expect(parsedEvent.args.successCount).to.equal(7); // Only 7 new ones
      expect(parsedEvent.args.totalAttempted).to.equal(10);
    });

    it("Should fail with batch too large", async function () {
      const tooManyIds = new Array(51).fill(ethers.ZeroHash);
      const participants = new Array(51).fill([]);
      const scores = new Array(51).fill([]);
      const winnerIndices = new Array(51).fill(0);
      const durations = new Array(51).fill(0);
      const customDataArray = new Array(51).fill("0x");

      await expect(
        oracleCore.connect(gameDev).batchSubmitResultsV2(
          tooManyIds,
          gameDev.address,
          participants,
          scores,
          winnerIndices,
          durations,
          ethers.ZeroHash,
          customDataArray
        )
      ).to.be.revertedWith("OracleCoreV2: Batch too large");
    });

    it("Should fail with mismatched array lengths", async function () {
      const participants = new Array(10).fill([]);
      const scores = new Array(5).fill([]); // Wrong length
      const winnerIndices = new Array(10).fill(0);
      const durations = new Array(10).fill(0);
      const customDataArray = new Array(10).fill("0x");

      await expect(
        oracleCore.connect(gameDev).batchSubmitResultsV2(
          matchIds,
          gameDev.address,
          participants,
          scores,
          winnerIndices,
          durations,
          ethers.ZeroHash,
          customDataArray
        )
      ).to.be.revertedWith("OracleCoreV2: Array length mismatch");
    });

    it("Should skip invalid entries in batch", async function () {
      const fpsSchemaId = await schemaTemplates.SCHEMA_FPS_PVP();
      const player1 = ethers.Wallet.createRandom().address;
      const player2 = ethers.Wallet.createRandom().address;

      // Create batch data with some invalid entries
      const participants = new Array(10).fill(0).map((_, i) => {
        if (i === 3 || i === 7) {
          return []; // Invalid: empty participants
        }
        return [player1, player2];
      });

      const scores = new Array(10).fill(0).map((_, i) => {
        if (i === 5) {
          return [16]; // Invalid: mismatched with participants length
        }
        return [16, 14];
      });

      const winnerIndices = new Array(10).fill(0).map((_, i) => {
        if (i === 2) {
          return 10; // Invalid: out of bounds
        }
        return 0;
      });

      const durations = new Array(10).fill(2400);
      const customDataArray = new Array(10).fill(
        await schemaTemplates.encodeFPSData(10, 5, 7, 4, 2000, 0)
      );

      const tx = await oracleCore.connect(gameDev).batchSubmitResultsV2(
        matchIds,
        gameDev.address,
        participants,
        scores,
        winnerIndices,
        durations,
        fpsSchemaId,
        customDataArray
      );

      const receipt = await tx.wait();
      const batchEvent = receipt.logs.find(log => {
        try {
          return oracleCore.interface.parseLog(log).name === "BatchResultsSubmitted";
        } catch {
          return false;
        }
      });

      const parsedEvent = oracleCore.interface.parseLog(batchEvent);
      expect(parsedEvent.args.successCount).to.be.lessThan(10); // Some should be skipped
    });
  });

  describe("Batch Finalize Results", function () {
    beforeEach(async function () {
      // Submit all 10 results first
      const fpsSchemaId = await schemaTemplates.SCHEMA_FPS_PVP();
      const player1 = ethers.Wallet.createRandom().address;
      const player2 = ethers.Wallet.createRandom().address;

      const participants = new Array(10).fill(0).map(() => [player1, player2]);
      const scores = new Array(10).fill(0).map(() => [16, 14]);
      const winnerIndices = new Array(10).fill(0);
      const durations = new Array(10).fill(2400);
      const customDataArray = new Array(10).fill(
        await schemaTemplates.encodeFPSData(10, 5, 7, 4, 2000, 0)
      );

      await oracleCore.connect(gameDev).batchSubmitResultsV2(
        matchIds,
        gameDev.address,
        participants,
        scores,
        winnerIndices,
        durations,
        fpsSchemaId,
        customDataArray
      );
    });

    it("Should batch finalize all results after dispute window", async function () {
      // Fast forward past dispute window
      await time.increase(16 * 60);

      const tx = await oracleCore.batchFinalizeResults(matchIds);
      const receipt = await tx.wait();

      const batchEvent = receipt.logs.find(log => {
        try {
          return oracleCore.interface.parseLog(log).name === "BatchResultsFinalized";
        } catch {
          return false;
        }
      });

      expect(batchEvent).to.not.be.undefined;
      const parsedEvent = oracleCore.interface.parseLog(batchEvent);
      expect(parsedEvent.args.successCount).to.equal(10);

      // Verify all are finalized
      for (const matchId of matchIds) {
        const result = await oracleCore.getResultV2(matchId);
        expect(result.isFinalized).to.be.true;
      }
    });

    it("Should skip results still in dispute window", async function () {
      // Fast forward only 10 minutes (not enough)
      await time.increase(10 * 60);

      const tx = await oracleCore.batchFinalizeResults(matchIds);
      const receipt = await tx.wait();

      const batchEvent = receipt.logs.find(log => {
        try {
          return oracleCore.interface.parseLog(log).name === "BatchResultsFinalized";
        } catch {
          return false;
        }
      });

      const parsedEvent = oracleCore.interface.parseLog(batchEvent);
      expect(parsedEvent.args.successCount).to.equal(0); // None finalized yet
    });

    it("Should skip already finalized results", async function () {
      // Fast forward past dispute window
      await time.increase(16 * 60);

      // Finalize first 3 individually
      for (let i = 0; i < 3; i++) {
        await oracleCore.finalizeResult(matchIds[i]);
      }

      // Batch finalize all (should skip first 3)
      const tx = await oracleCore.batchFinalizeResults(matchIds);
      const receipt = await tx.wait();

      const batchEvent = receipt.logs.find(log => {
        try {
          return oracleCore.interface.parseLog(log).name === "BatchResultsFinalized";
        } catch {
          return false;
        }
      });

      const parsedEvent = oracleCore.interface.parseLog(batchEvent);
      expect(parsedEvent.args.successCount).to.equal(7); // Only 7 new ones
    });

    it("Should fail with batch too large", async function () {
      const tooManyIds = new Array(101).fill(ethers.ZeroHash);

      await expect(
        oracleCore.batchFinalizeResults(tooManyIds)
      ).to.be.revertedWith("OracleCoreV2: Batch too large");
    });
  });

  describe("Gas Comparison: Batch vs Individual", function () {
    it("Should use less gas for batch submit vs individual submits", async function () {
      const fpsSchemaId = await schemaTemplates.SCHEMA_FPS_PVP();
      const player1 = ethers.Wallet.createRandom().address;
      const player2 = ethers.Wallet.createRandom().address;

      // Measure individual submissions (first 5 matches)
      let totalIndividualGas = 0n;
      for (let i = 0; i < 5; i++) {
        const data = await schemaTemplates.encodeFPSData(10, 5, 7, 4, 2000, 0);
        const tx = await oracleCore.connect(gameDev).submitResultV2(
          matchIds[i],
          gameDev.address,
          [player1, player2],
          [16, 14],
          0,
          2400,
          fpsSchemaId,
          data
        );
        const receipt = await tx.wait();
        totalIndividualGas += receipt.gasUsed;
      }

      const avgIndividualGas = totalIndividualGas / 5n;

      // Measure batch submission (last 5 matches)
      const batchMatchIds = matchIds.slice(5);
      const participants = new Array(5).fill(0).map(() => [player1, player2]);
      const scores = new Array(5).fill(0).map(() => [16, 14]);
      const winnerIndices = new Array(5).fill(0);
      const durations = new Array(5).fill(2400);
      const customDataArray = new Array(5).fill(
        await schemaTemplates.encodeFPSData(10, 5, 7, 4, 2000, 0)
      );

      const batchTx = await oracleCore.connect(gameDev).batchSubmitResultsV2(
        batchMatchIds,
        gameDev.address,
        participants,
        scores,
        winnerIndices,
        durations,
        fpsSchemaId,
        customDataArray
      );
      const batchReceipt = await batchTx.wait();
      const avgBatchGas = batchReceipt.gasUsed / 5n;

      console.log("Average individual gas:", avgIndividualGas.toString());
      console.log("Average batch gas:     ", avgBatchGas.toString());
      console.log("Gas savings:           ", ((avgIndividualGas - avgBatchGas) * 100n / avgIndividualGas).toString() + "%");

      // Batch should be at least 20% cheaper per result
      expect(avgBatchGas).to.be.lessThan(avgIndividualGas * 8n / 10n);
    });
  });
});
