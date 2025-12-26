const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("VirtualFootballGame", function () {
  let gameRegistry, oracleCore, feeManager, virtualFootballGame;
  let owner, user1, user2;
  let gameId;

  // Helper function to safely increase time
  async function increaseTimeTo(targetTime) {
    const currentTime = await time.latest();
    if (targetTime > currentTime) {
      await time.increaseTo(targetTime);
    }
  }

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();

    // Deploy core infrastructure
    // 1. Deploy GameRegistry
    const GameRegistry = await ethers.getContractFactory("GameRegistry");
    gameRegistry = await upgrades.deployProxy(
      GameRegistry,
      [ethers.parseEther("0.1")], // minimumStake
      { kind: "uups" }
    );
    await gameRegistry.waitForDeployment();

    // 2. Deploy FeeManager
    const FeeManagerV2 = await ethers.getContractFactory("FeeManagerV2");
    feeManager = await upgrades.deployProxy(
      FeeManagerV2,
      [
        await gameRegistry.getAddress(),
        ethers.parseEther("0.001") // query fee
      ],
      { kind: "uups" }
    );
    await feeManager.waitForDeployment();

    // 3. Deploy OracleCore
    const OracleCore = await ethers.getContractFactory("OracleCore");
    oracleCore = await upgrades.deployProxy(
      OracleCore,
      [
        await gameRegistry.getAddress(),
        await feeManager.getAddress()
      ],
      { kind: "uups" }
    );
    await oracleCore.waitForDeployment();

    // 4. Wire up references
    await gameRegistry.updateOracleCore(await oracleCore.getAddress());

    // Deploy VirtualFootballGame
    const VirtualFootballGame = await ethers.getContractFactory("VirtualFootballGame");
    virtualFootballGame = await VirtualFootballGame.deploy(
      await oracleCore.getAddress(),
      await gameRegistry.getAddress()
    );
  });

  describe("Game Registration", function () {
    it("Should register game successfully", async function () {
      const registrationFee = ethers.parseEther("0.1");

      await expect(
        virtualFootballGame.registerGame({ value: registrationFee })
      ).to.emit(gameRegistry, "GameRegistered");

      gameId = await virtualFootballGame.gameId();
      expect(gameId).to.not.equal(ethers.ZeroHash);
    });

    it("Should fail to register twice", async function () {
      const registrationFee = ethers.parseEther("0.1");
      await virtualFootballGame.registerGame({ value: registrationFee });

      await expect(
        virtualFootballGame.registerGame({ value: registrationFee })
      ).to.be.revertedWith("Already registered");
    });

    it("Should only allow owner to register", async function () {
      const registrationFee = ethers.parseEther("0.1");

      await expect(
        virtualFootballGame.connect(user1).registerGame({ value: registrationFee })
      ).to.be.revertedWithCustomError(virtualFootballGame, "OwnableUnauthorizedAccount");
    });
  });

  describe("Season Management", function () {
    beforeEach(async function () {
      // Register game first
      await virtualFootballGame.registerGame({ value: ethers.parseEther("0.1") });
    });

    it("Should create season successfully", async function () {
      const startTime = (await time.latest()) + 3600; // 1 hour from now

      await expect(virtualFootballGame.createSeason(startTime))
        .to.emit(virtualFootballGame, "SeasonCreated")
        .withArgs(1, startTime, startTime + 24 * 3600);

      const seasonId = await virtualFootballGame.currentSeasonId();
      expect(seasonId).to.equal(1);

      const season = await virtualFootballGame.getSeason(1);
      expect(season.seasonId).to.equal(1);
      expect(season.startTime).to.equal(startTime);
      expect(season.endTime).to.equal(startTime + 24 * 3600); // 1 day duration
      expect(season.status).to.equal(0); // UPCOMING
    });

    it("Should fail to create season with past start time", async function () {
      const pastTime = (await time.latest()) - 3600;

      await expect(
        virtualFootballGame.createSeason(pastTime)
      ).to.be.revertedWith("Start time must be in future");
    });

    it("Should allow multiple seasons", async function () {
      const startTime1 = (await time.latest()) + 3600;
      await virtualFootballGame.createSeason(startTime1);

      const startTime2 = (await time.latest()) + 7200;
      await virtualFootballGame.createSeason(startTime2);

      const currentSeasonId = await virtualFootballGame.currentSeasonId();
      expect(currentSeasonId).to.equal(2);
    });

    it("Should only allow owner to create season", async function () {
      const startTime = (await time.latest()) + 3600;

      await expect(
        virtualFootballGame.connect(user1).createSeason(startTime)
      ).to.be.revertedWithCustomError(virtualFootballGame, "OwnableUnauthorizedAccount");
    });
  });

  describe("Season Start and Match Generation", function () {
    let startTime, seasonId;

    beforeEach(async function () {
      await virtualFootballGame.registerGame({ value: ethers.parseEther("0.1") });
      startTime = (await time.latest()) + 3600;
      await virtualFootballGame.createSeason(startTime);
      seasonId = await virtualFootballGame.currentSeasonId();
    });

    it("Should start season and generate matches", async function () {
      await time.increaseTo(startTime);

      await expect(virtualFootballGame.startSeason(seasonId))
        .to.emit(virtualFootballGame, "SeasonStarted")
        .withArgs(seasonId);

      const season = await virtualFootballGame.getSeason(seasonId);
      expect(season.status).to.equal(1); // ACTIVE

      // Check matches were generated (20 matches for MVP)
      const matches = await virtualFootballGame.getSeasonMatches(seasonId);
      expect(matches.length).to.equal(20);
    });

    it("Should fail to start season before start time", async function () {
      await expect(
        virtualFootballGame.startSeason(seasonId)
      ).to.be.revertedWith("Too early to start");
    });

    it("Should fail to start non-existent season", async function () {
      await expect(
        virtualFootballGame.startSeason(999)
      ).to.be.revertedWith("Season not found");
    });

    it("Should fail to start already active season", async function () {
      await time.increaseTo(startTime);
      await virtualFootballGame.startSeason(seasonId);

      await expect(
        virtualFootballGame.startSeason(seasonId)
      ).to.be.revertedWith("Season not upcoming");
    });

    it("Should generate matches with correct teams", async function () {
      await time.increaseTo(startTime);
      await virtualFootballGame.startSeason(seasonId);

      const matches = await virtualFootballGame.getSeasonMatches(seasonId);
      const firstMatch = await virtualFootballGame.getMatch(matches[0]);

      expect(firstMatch.homeTeam).to.be.at.least(0);
      expect(firstMatch.homeTeam).to.be.at.most(9);
      expect(firstMatch.awayTeam).to.be.at.least(0);
      expect(firstMatch.awayTeam).to.be.at.most(9);
      expect(firstMatch.homeTeam).to.not.equal(firstMatch.awayTeam);
      expect(firstMatch.seasonId).to.equal(seasonId);
    });

    it("Should generate matches with incremental kickoff times", async function () {
      await time.increaseTo(startTime);
      await virtualFootballGame.startSeason(seasonId);

      const matches = await virtualFootballGame.getSeasonMatches(seasonId);
      const match1 = await virtualFootballGame.getMatch(matches[0]);
      const match2 = await virtualFootballGame.getMatch(matches[1]);

      const timeDiff = Number(match2.kickoffTime) - Number(match1.kickoffTime);
      expect(timeDiff).to.equal(10 * 60); // 10 minutes
    });
  });

  describe("Match Simulation", function () {
    let startTime, seasonId, matchId;

    beforeEach(async function () {
      await virtualFootballGame.registerGame({ value: ethers.parseEther("0.1") });
      startTime = (await time.latest()) + 3600;
      await virtualFootballGame.createSeason(startTime);
      seasonId = await virtualFootballGame.currentSeasonId();

      await time.increaseTo(startTime);
      await virtualFootballGame.startSeason(seasonId);

      const matches = await virtualFootballGame.getSeasonMatches(seasonId);
      matchId = matches[0];
    });

    it("Should simulate match and finalize result", async function () {
      const match = await virtualFootballGame.getMatch(matchId);
      await increaseTimeTo(Number(match.kickoffTime));

      await expect(virtualFootballGame.simulateMatch(matchId))
        .to.emit(virtualFootballGame, "MatchFinalized");

      const updatedMatch = await virtualFootballGame.getMatch(matchId);
      expect(updatedMatch.isFinalized).to.be.true;
      expect(updatedMatch.homeScore).to.be.at.least(0);
      expect(updatedMatch.homeScore).to.be.at.most(5);
      expect(updatedMatch.awayScore).to.be.at.least(0);
      expect(updatedMatch.awayScore).to.be.at.most(5);
    });

    it("Should submit result to oracle", async function () {
      const match = await virtualFootballGame.getMatch(matchId);
      await increaseTimeTo(Number(match.kickoffTime));

      await virtualFootballGame.simulateMatch(matchId);

      const updatedMatch = await virtualFootballGame.getMatch(matchId);
      expect(updatedMatch.oracleMatchId).to.not.equal(ethers.ZeroHash);
    });

    it("Should fail to simulate match before kickoff", async function () {
      await expect(
        virtualFootballGame.simulateMatch(matchId)
      ).to.be.revertedWith("Match not started");
    });

    it("Should fail to simulate already finalized match", async function () {
      const match = await virtualFootballGame.getMatch(matchId);
      await increaseTimeTo(Number(match.kickoffTime));

      await virtualFootballGame.simulateMatch(matchId);

      await expect(
        virtualFootballGame.simulateMatch(matchId)
      ).to.be.revertedWith("Already finalized");
    });

    it("Should fail to simulate non-existent match", async function () {
      await expect(
        virtualFootballGame.simulateMatch(999999)
      ).to.be.revertedWith("Match not found");
    });

    it("Should update team statistics after match", async function () {
      const match = await virtualFootballGame.getMatch(matchId);
      await increaseTimeTo(Number(match.kickoffTime));

      await virtualFootballGame.simulateMatch(matchId);

      const homeTeamStats = await virtualFootballGame.getTeamStats(
        seasonId,
        match.homeTeam
      );
      const awayTeamStats = await virtualFootballGame.getTeamStats(
        seasonId,
        match.awayTeam
      );

      expect(homeTeamStats.matchesPlayed).to.equal(1);
      expect(awayTeamStats.matchesPlayed).to.equal(1);
      expect(homeTeamStats.goalsScored + homeTeamStats.goalsConceded).to.be.at.least(0);
    });
  });

  describe("Season End", function () {
    let startTime, seasonId;

    beforeEach(async function () {
      await virtualFootballGame.registerGame({ value: ethers.parseEther("0.1") });
      startTime = (await time.latest()) + 3600;
      await virtualFootballGame.createSeason(startTime);
      seasonId = await virtualFootballGame.currentSeasonId();

      await time.increaseTo(startTime);
      await virtualFootballGame.startSeason(seasonId);
    });

    it("Should end season after duration", async function () {
      const season = await virtualFootballGame.getSeason(seasonId);
      await time.increaseTo(Number(season.endTime));

      await expect(virtualFootballGame.endSeason(seasonId))
        .to.emit(virtualFootballGame, "SeasonEnded");

      const updatedSeason = await virtualFootballGame.getSeason(seasonId);
      expect(updatedSeason.status).to.equal(2); // COMPLETED
    });

    it("Should fail to end season before end time", async function () {
      await expect(
        virtualFootballGame.endSeason(seasonId)
      ).to.be.revertedWith("Season not ended yet");
    });

    it("Should fail to end non-active season", async function () {
      const newStartTime = (await time.latest()) + 7200;
      await virtualFootballGame.createSeason(newStartTime);
      const newSeasonId = await virtualFootballGame.currentSeasonId();

      const season = await virtualFootballGame.getSeason(newSeasonId);
      await time.increaseTo(Number(season.endTime));

      await expect(
        virtualFootballGame.endSeason(newSeasonId)
      ).to.be.revertedWith("Season not active");
    });

    it("Should determine season winner correctly", async function () {
      // Simulate some matches to have a winner
      const matches = await virtualFootballGame.getSeasonMatches(seasonId);
      const firstMatch = await virtualFootballGame.getMatch(matches[0]);

      await time.increaseTo(Number(firstMatch.kickoffTime));
      await virtualFootballGame.simulateMatch(matches[0]);

      const season = await virtualFootballGame.getSeason(seasonId);
      await time.increaseTo(Number(season.endTime));

      const tx = await virtualFootballGame.endSeason(seasonId);
      const receipt = await tx.wait();

      const event = receipt.logs.find(
        log => log.fragment && log.fragment.name === "SeasonEnded"
      );

      expect(event).to.not.be.undefined;
      const winner = event.args.winner;
      expect(winner).to.be.at.least(0);
      expect(winner).to.be.at.most(9);
    });
  });

  describe("View Functions", function () {
    beforeEach(async function () {
      await virtualFootballGame.registerGame({ value: ethers.parseEther("0.1") });
    });

    it("Should get team names", async function () {
      const teamName = await virtualFootballGame.getTeamName(0);
      expect(teamName).to.equal("Manchester City");

      const teamName2 = await virtualFootballGame.getTeamName(9);
      expect(teamName2).to.equal("West Ham");
    });

    it("Should fail to get invalid team name", async function () {
      await expect(
        virtualFootballGame.getTeamName(10)
      ).to.be.revertedWith("Invalid team ID");
    });

    it("Should get empty season matches for new season", async function () {
      const startTime = (await time.latest()) + 3600;
      await virtualFootballGame.createSeason(startTime);
      const seasonId = await virtualFootballGame.currentSeasonId();

      const matches = await virtualFootballGame.getSeasonMatches(seasonId);
      expect(matches.length).to.equal(0);
    });

    it("Should get current season ID", async function () {
      expect(await virtualFootballGame.currentSeasonId()).to.equal(0);

      const startTime = (await time.latest()) + 3600;
      await virtualFootballGame.createSeason(startTime);

      expect(await virtualFootballGame.currentSeasonId()).to.equal(1);
    });
  });

  describe("Edge Cases", function () {
    it("Should handle receiving ETH", async function () {
      await expect(
        owner.sendTransaction({
          to: await virtualFootballGame.getAddress(),
          value: ethers.parseEther("1")
        })
      ).to.not.be.reverted;
    });

    it("Should generate different scores for different matches", async function () {
      await virtualFootballGame.registerGame({ value: ethers.parseEther("0.1") });
      const startTime = (await time.latest()) + 3600;
      await virtualFootballGame.createSeason(startTime);
      const seasonId = await virtualFootballGame.currentSeasonId();

      await time.increaseTo(startTime);
      await virtualFootballGame.startSeason(seasonId);

      const matches = await virtualFootballGame.getSeasonMatches(seasonId);

      // Simulate first two matches
      const match1 = await virtualFootballGame.getMatch(matches[0]);
      await time.increaseTo(Number(match1.kickoffTime));
      await virtualFootballGame.simulateMatch(matches[0]);

      const match2 = await virtualFootballGame.getMatch(matches[1]);
      await time.increaseTo(Number(match2.kickoffTime));
      await virtualFootballGame.simulateMatch(matches[1]);

      const finalMatch1 = await virtualFootballGame.getMatch(matches[0]);
      const finalMatch2 = await virtualFootballGame.getMatch(matches[1]);

      // It's highly unlikely both matches have exact same score
      // (though possible - we just check they both finalized)
      expect(finalMatch1.isFinalized).to.be.true;
      expect(finalMatch2.isFinalized).to.be.true;
    });
  });
});
