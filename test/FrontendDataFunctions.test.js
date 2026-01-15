const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("Frontend Data Functions - Comprehensive Test", function () {
  let gameRegistry, oracleCore, feeManager, rps;
  let owner, developer, player1, player2, consumer;
  let gameId, matchId1, matchId2, matchId3;

  const MINIMUM_STAKE = ethers.parseEther("0.1");
  const QUERY_FEE = ethers.parseEther("0.00416");

  beforeEach(async function () {
    [owner, developer, player1, player2, consumer] = await ethers.getSigners();

    // Deploy GameRegistry
    const GameRegistry = await ethers.getContractFactory("GameRegistry");
    gameRegistry = await upgrades.deployProxy(GameRegistry, [MINIMUM_STAKE], {
      initializer: "initialize",
      kind: "uups",
    });
    await gameRegistry.waitForDeployment();

    // Deploy FeeManagerV2
    const FeeManagerV2 = await ethers.getContractFactory("FeeManagerV2");
    feeManager = await upgrades.deployProxy(
      FeeManagerV2,
      [await gameRegistry.getAddress(), QUERY_FEE],
      {
        initializer: "initialize",
        kind: "uups",
      }
    );
    await feeManager.waitForDeployment();

    // Deploy OracleCore
    const OracleCore = await ethers.getContractFactory("OracleCore");
    oracleCore = await upgrades.deployProxy(
      OracleCore,
      [await gameRegistry.getAddress(), await feeManager.getAddress()],
      {
        initializer: "initialize",
        kind: "uups",
      }
    );
    await oracleCore.waitForDeployment();

    // Set OracleCore in FeeManager
    await feeManager.updateOracleCore(await oracleCore.getAddress());

    // Set OracleCore in GameRegistry (so it can call markResultSubmitted)
    await gameRegistry.updateOracleCore(await oracleCore.getAddress());

    // Deploy RPS game (owner will be the deployer - owner account)
    const RPS = await ethers.getContractFactory("RockPaperScissors");
    rps = await RPS.connect(owner).deploy(
      await gameRegistry.getAddress(),
      await oracleCore.getAddress()
    );
    await rps.waitForDeployment();

    // Register RPS game (from owner account since owner is the RPS owner)
    const tx = await rps.connect(owner).registerWithOracle({
      value: MINIMUM_STAKE,
    });
    await tx.wait();

    gameId = await rps.gameId();
  });

  describe("GameRegistry - Match Tracking", function () {
    beforeEach(async function () {
      // Schedule 3 matches
      const now = await time.latest();

      const tx1 = await rps
        .connect(owner)
        .scheduleMatch(
          player1.address,
          player2.address,
          now + 3600
        );
      await tx1.wait();

      const tx2 = await rps
        .connect(owner)
        .scheduleMatch(
          player1.address,
          consumer.address,
          now + 7200
        );
      await tx2.wait();

      const tx3 = await rps
        .connect(owner)
        .scheduleMatch(
          player2.address,
          consumer.address,
          now + 10800
        );
      await tx3.wait();

      // Get match IDs
      const allMatches = await rps.getAllMatches();
      matchId1 = allMatches[0];
      matchId2 = allMatches[1];
      matchId3 = allMatches[2];
    });

    it("should track all matches for a game", async function () {
      const matches = await gameRegistry.getGameMatches(gameId);
      expect(matches.length).to.equal(3);
    });

    it("should return correct match count", async function () {
      const count = await gameRegistry.gameMatchCount(gameId);
      expect(count).to.equal(3);
    });

    it("should support paginated match retrieval", async function () {
      const page1 = await gameRegistry.getGameMatchesPaginated(gameId, 0, 2);
      expect(page1.length).to.equal(2);

      const page2 = await gameRegistry.getGameMatchesPaginated(gameId, 2, 2);
      expect(page2.length).to.equal(1);
    });

    it("should validate match belongs to game with getGameMatch", async function () {
      const match = await gameRegistry.getGameMatch(gameId, matchId1);
      expect(match.gameId).to.equal(gameId);
    });

    it("should revert if match doesn't belong to game", async function () {
      const fakeGameId = ethers.keccak256(ethers.toUtf8Bytes("fake"));
      await expect(
        gameRegistry.getGameMatch(fakeGameId, matchId1)
      ).to.be.revertedWith("Match not from this game");
    });

    it("should batch get matches", async function () {
      const matches = await gameRegistry.getMatchesBatch([
        matchId1,
        matchId2,
        matchId3,
      ]);
      expect(matches.length).to.equal(3);
      expect(matches[0].gameId).to.equal(gameId);
    });

    it("should check if match exists for game", async function () {
      const exists = await gameRegistry.matchExists(gameId, matchId1);
      expect(exists).to.be.true;

      const fakeMatchId = ethers.keccak256(ethers.toUtf8Bytes("fake"));
      const notExists = await gameRegistry.matchExists(gameId, fakeMatchId);
      expect(notExists).to.be.false;
    });
  });

  describe("GameRegistry - Developer Stats", function () {
    beforeEach(async function () {
      // Schedule some matches
      const now = await time.latest();
      await rps
        .connect(owner)
        .scheduleMatch(player1.address, player2.address, now + 3600);
      await rps
        .connect(owner)
        .scheduleMatch(player1.address, player2.address, now + 7200);
    });

    it("should return correct developer stats", async function () {
      // Note: RPS is registered under contract address due to bug
      const rpsAddress = await rps.getAddress();
      const stats = await gameRegistry.getDeveloperStats(rpsAddress);

      expect(stats._totalGames).to.equal(1);
      expect(stats._totalMatches).to.equal(2);
      expect(stats.averageReputation).to.equal(500);
    });

    it("should return zero stats for developer with no games", async function () {
      const stats = await gameRegistry.getDeveloperStats(consumer.address);

      expect(stats._totalGames).to.equal(0);
      expect(stats._totalMatches).to.equal(0);
      expect(stats.averageReputation).to.equal(0);
    });
  });

  describe("GameRegistry - All Games & Pagination", function () {
    it("should track all game IDs", async function () {
      const totalGames = await gameRegistry.totalGames();
      expect(totalGames).to.equal(1);
    });

    it("should return paginated games", async function () {
      const games = await gameRegistry.getAllGames(0, 10);
      expect(games.length).to.equal(1);
      expect(games[0].name).to.equal("Rock Paper Scissors");
    });

    it("should return active games only", async function () {
      const activeGames = await gameRegistry.getActiveGames();
      expect(activeGames.length).to.equal(1);
      expect(activeGames[0]).to.equal(gameId);
    });

    it("should batch get games", async function () {
      const games = await gameRegistry.getGamesBatch([gameId]);
      expect(games.length).to.equal(1);
      expect(games[0].name).to.equal("Rock Paper Scissors");
    });
  });

  describe("OracleCore - Per-Game Stats", function () {
    beforeEach(async function () {
      // Schedule and complete some matches
      const now = await time.latest();

      // Schedule match
      const tx1 = await rps
        .connect(owner)
        .scheduleMatch(player1.address, player2.address, now + 100);
      await tx1.wait();

      const allMatches = await rps.getAllMatches();
      matchId1 = allMatches[0];

      // Fast forward to match time
      await time.increase(101);

      // Play match
      await rps.connect(player1).commitToMatch(matchId1);
      await rps.connect(player2).commitToMatch(matchId1);
    });

    it("should track results submitted per game", async function () {
      const stats = await oracleCore.getGameStats(gameId);
      expect(stats._totalResults).to.equal(1);
    });

    it("should track finalized results per game", async function () {
      // Wait for dispute window
      await time.increase(15 * 60 + 1);

      // Finalize result
      await oracleCore.finalizeResult(matchId1);

      const stats = await oracleCore.getGameStats(gameId);
      expect(stats._finalizedResults).to.equal(1);
    });

    it("should return game results array", async function () {
      const results = await oracleCore.getGameResults(gameId);
      expect(results.length).to.equal(1);
      expect(results[0]).to.equal(matchId1);
    });

    it("should validate result belongs to game with getGameResult", async function () {
      const result = await oracleCore.getGameResult(gameId, matchId1);
      expect(result.gameId).to.equal(gameId);
    });

    it("should revert if result doesn't belong to game", async function () {
      const fakeGameId = ethers.keccak256(ethers.toUtf8Bytes("fake"));
      await expect(
        oracleCore.getGameResult(fakeGameId, matchId1)
      ).to.be.revertedWith("Result not from this game");
    });

    it("should batch get results", async function () {
      const results = await oracleCore.getResultsBatch([matchId1]);
      expect(results.length).to.equal(1);
      expect(results[0].gameId).to.equal(gameId);
    });
  });

  describe("OracleCore - Global Stats", function () {
    beforeEach(async function () {
      // Schedule and complete a match
      const now = await time.latest();

      const tx1 = await rps
        .connect(owner)
        .scheduleMatch(player1.address, player2.address, now + 100);
      await tx1.wait();

      const allMatches = await rps.getAllMatches();
      matchId1 = allMatches[0];

      await time.increase(101);

      await rps.connect(player1).commitToMatch(matchId1);
      await rps.connect(player2).commitToMatch(matchId1);
    });

    it("should return global oracle stats", async function () {
      const stats = await oracleCore.getGlobalStats();
      expect(stats._totalResults).to.equal(1);
      expect(stats._totalFinalized).to.equal(0);
      expect(stats._totalDisputed).to.equal(0);
    });

    it("should track global finalized count", async function () {
      await time.increase(15 * 60 + 1);
      await oracleCore.finalizeResult(matchId1);

      const stats = await oracleCore.getGlobalStats();
      expect(stats._totalFinalized).to.equal(1);
    });
  });

  describe("OracleCore - Pending Results", function () {
    beforeEach(async function () {
      const now = await time.latest();

      // Schedule 2 matches
      const tx1 = await rps
        .connect(owner)
        .scheduleMatch(player1.address, player2.address, now + 100);
      await tx1.wait();

      const tx2 = await rps
        .connect(owner)
        .scheduleMatch(player1.address, consumer.address, now + 200);
      await tx2.wait();

      const allMatches = await rps.getAllMatches();
      matchId1 = allMatches[0];
      matchId2 = allMatches[1];

      await time.increase(101);

      // Complete first match only
      await rps.connect(player1).commitToMatch(matchId1);
      await rps.connect(player2).commitToMatch(matchId1);

      // Complete second match
      await time.increase(100);
      await rps.connect(player1).commitToMatch(matchId2);
      await rps.connect(consumer).commitToMatch(matchId2);
    });

    it("should return pending results for a game", async function () {
      const pending = await oracleCore.getPendingResults(gameId, 10);
      expect(pending.length).to.equal(2);
    });

    it("should respect limit parameter", async function () {
      const pending = await oracleCore.getPendingResults(gameId, 1);
      expect(pending.length).to.equal(1);
    });

    it("should exclude finalized results", async function () {
      await time.increase(15 * 60 + 1);
      await oracleCore.finalizeResult(matchId1);

      const pending = await oracleCore.getPendingResults(gameId, 10);
      expect(pending.length).to.equal(1);
      expect(pending[0]).to.equal(matchId2);
    });
  });

  describe("RockPaperScissors - Match Tracking", function () {
    beforeEach(async function () {
      const now = await time.latest();

      await rps
        .connect(owner)
        .scheduleMatch(player1.address, player2.address, now + 3600);
      await rps
        .connect(owner)
        .scheduleMatch(player1.address, consumer.address, now + 7200);
      await rps
        .connect(owner)
        .scheduleMatch(player2.address, consumer.address, now + 10800);
    });

    it("should return all matches", async function () {
      const matches = await rps.getAllMatches();
      expect(matches.length).to.equal(3);
    });

    it("should return recent matches with limit", async function () {
      const recent = await rps.getRecentMatches(2);
      expect(recent.length).to.equal(2);
      // Most recent first
      expect(recent[0].player2).to.equal(consumer.address);
    });

    it("should track matches by player", async function () {
      const player1Matches = await rps.getPlayerMatches(player1.address);
      expect(player1Matches.length).to.equal(2);

      const player2Matches = await rps.getPlayerMatches(player2.address);
      expect(player2Matches.length).to.equal(2);

      const consumerMatches = await rps.getPlayerMatches(consumer.address);
      expect(consumerMatches.length).to.equal(2);
    });

    it("should return game stats", async function () {
      const stats = await rps.getGameStats();
      expect(stats.totalMatches).to.equal(3);
      expect(stats.completedMatches).to.equal(0);
      expect(stats.activeMatches).to.equal(3);
    });

    it("should batch get RPS matches", async function () {
      const allMatchIds = await rps.getAllMatches();
      // Convert to regular array to avoid ethers.js read-only issue
      const matchIdsArray = [...allMatchIds];
      const matches = await rps.getMatchesBatch(matchIdsArray);

      expect(matches.length).to.equal(3);
      expect(matches[0].player1).to.equal(player1.address);
    });

    it("should validate game ID with getGameMatch", async function () {
      const allMatchIds = await rps.getAllMatches();
      const match = await rps.getGameMatch(gameId, allMatchIds[0]);

      expect(match.matchId).to.equal(allMatchIds[0]);
    });

    it("should revert with invalid game ID", async function () {
      const fakeGameId = ethers.keccak256(ethers.toUtf8Bytes("fake"));
      const allMatchIds = await rps.getAllMatches();

      await expect(
        rps.getGameMatch(fakeGameId, allMatchIds[0])
      ).to.be.revertedWith("Invalid game ID");
    });
  });

  describe("Integration - Complete Frontend Data Flow", function () {
    it("should fetch all data needed for game provider dashboard", async function () {
      // Get RPS contract address (since it's registered under contract)
      const rpsAddress = await rps.getAddress();

      // 1. Get developer's games
      const developerGames = await gameRegistry.getDeveloperGames(rpsAddress);
      expect(developerGames.length).to.equal(1);

      // 2. Get game details
      const game = await gameRegistry.games(gameId);
      expect(game.name).to.equal("Rock Paper Scissors");

      // 3. Get developer stats
      const stats = await gameRegistry.getDeveloperStats(rpsAddress);
      expect(stats._totalGames).to.equal(1);

      // 4. Get oracle stats for the game
      const oracleStats = await oracleCore.getGameStats(gameId);
      expect(oracleStats._totalResults).to.equal(0);
      expect(oracleStats._finalizedResults).to.equal(0);
      expect(oracleStats._disputedResults).to.equal(0);

      // 5. Get earnings (would be 0 initially)
      const earnings = await feeManager.developerEarnings(gameId);
      expect(earnings.totalEarned).to.equal(0);

      console.log("✅ All dashboard data fetched successfully");
    });

    it("should fetch all data needed for game detail page", async function () {
      // Schedule some matches
      const now = await time.latest();
      await rps
        .connect(owner)
        .scheduleMatch(player1.address, player2.address, now + 3600);

      // 1. Get game details
      const game = await gameRegistry.games(gameId);
      expect(game.name).to.equal("Rock Paper Scissors");

      // 2. Get all matches for game
      const matches = await gameRegistry.getGameMatches(gameId);
      expect(matches.length).to.equal(1);

      // 3. Get match details (convert read-only array)
      const matchDetails = await gameRegistry.getMatchesBatch([...matches]);
      expect(matchDetails.length).to.equal(1);

      // 4. Get oracle stats
      const oracleStats = await oracleCore.getGameStats(gameId);
      expect(oracleStats._totalResults).to.equal(0);

      // 5. Get RPS-specific stats
      const rpsStats = await rps.getGameStats();
      expect(rpsStats.totalMatches).to.equal(1);

      console.log("✅ All game detail page data fetched successfully");
    });
  });

  describe("GameRegistry - transferGameDeveloper", function () {
    it("should transfer game to new developer (owner only)", async function () {
      const rpsAddress = await rps.getAddress();

      // Verify current state
      let devGames = await gameRegistry.getDeveloperGames(rpsAddress);
      expect(devGames.length).to.equal(1);

      // Transfer to actual developer
      await gameRegistry.transferGameDeveloper(gameId, developer.address);

      // Verify new state
      const newDevGames = await gameRegistry.getDeveloperGames(developer.address);
      expect(newDevGames.length).to.equal(1);
      expect(newDevGames[0]).to.equal(gameId);

      // Verify old developer has no games
      const oldDevGames = await gameRegistry.getDeveloperGames(rpsAddress);
      expect(oldDevGames.length).to.equal(0);

      // Verify game details updated
      const game = await gameRegistry.games(gameId);
      expect(game.developer).to.equal(developer.address);
    });

    it("should revert if not owner", async function () {
      await expect(
        gameRegistry.connect(developer).transferGameDeveloper(gameId, developer.address)
      ).to.be.reverted;
    });
  });
});
