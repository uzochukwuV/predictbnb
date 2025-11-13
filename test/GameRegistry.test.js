const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("GameRegistry", function () {
  let gameRegistry;
  let owner, developer1, developer2;
  const REGISTRATION_STAKE = ethers.parseEther("0.1");

  beforeEach(async function () {
    [owner, developer1, developer2] = await ethers.getSigners();

    const GameRegistry = await ethers.getContractFactory("GameRegistry");
    gameRegistry = await GameRegistry.deploy();
    await gameRegistry.waitForDeployment();
  });

  describe("Game Registration", function () {
    it("Should register a new game with correct stake", async function () {
      const tx = await gameRegistry.connect(developer1).registerGame(
        "lol-001",
        "League of Legends",
        0, // MOBA
        { value: REGISTRATION_STAKE }
      );

      await expect(tx)
        .to.emit(gameRegistry, "GameRegistered")
        .withArgs("lol-001", "League of Legends", 0, developer1.address, REGISTRATION_STAKE);

      const game = await gameRegistry.getGame("lol-001");
      expect(game.name).to.equal("League of Legends");
      expect(game.developer).to.equal(developer1.address);
      expect(game.isActive).to.be.true;
      expect(game.reputationScore).to.equal(500);
    });

    it("Should fail with incorrect stake amount", async function () {
      await expect(
        gameRegistry.connect(developer1).registerGame(
          "lol-001",
          "League of Legends",
          0,
          { value: ethers.parseEther("0.05") }
        )
      ).to.be.revertedWith("GameRegistry: Incorrect stake amount");
    });

    it("Should fail with empty game ID", async function () {
      await expect(
        gameRegistry.connect(developer1).registerGame(
          "",
          "League of Legends",
          0,
          { value: REGISTRATION_STAKE }
        )
      ).to.be.revertedWith("GameRegistry: Empty game ID");
    });

    it("Should fail to register duplicate game ID", async function () {
      await gameRegistry.connect(developer1).registerGame(
        "lol-001",
        "League of Legends",
        0,
        { value: REGISTRATION_STAKE }
      );

      await expect(
        gameRegistry.connect(developer2).registerGame(
          "lol-001",
          "Another Game",
          1,
          { value: REGISTRATION_STAKE }
        )
      ).to.be.revertedWith("GameRegistry: Game already registered");
    });

    it("Should track multiple games per developer", async function () {
      await gameRegistry.connect(developer1).registerGame(
        "lol-001",
        "League of Legends",
        0,
        { value: REGISTRATION_STAKE }
      );

      await gameRegistry.connect(developer1).registerGame(
        "valorant-001",
        "Valorant",
        1,
        { value: REGISTRATION_STAKE }
      );

      const developerGames = await gameRegistry.getDeveloperGames(developer1.address);
      expect(developerGames.length).to.equal(2);
      expect(developerGames[0]).to.equal("lol-001");
      expect(developerGames[1]).to.equal("valorant-001");
    });
  });

  describe("Match Scheduling", function () {
    beforeEach(async function () {
      await gameRegistry.connect(developer1).registerGame(
        "lol-001",
        "League of Legends",
        0,
        { value: REGISTRATION_STAKE }
      );
    });

    it("Should schedule a match for future time", async function () {
      const futureTime = (await time.latest()) + 3600; // 1 hour from now

      const tx = await gameRegistry.connect(developer1).scheduleMatch(
        "lol-001",
        "match-001",
        futureTime,
        '{"team1": "TSM", "team2": "C9"}'
      );

      await expect(tx).to.emit(gameRegistry, "MatchScheduled");

      const game = await gameRegistry.getGame("lol-001");
      expect(game.totalMatches).to.equal(1);
    });

    it("Should fail to schedule match in the past", async function () {
      const pastTime = (await time.latest()) - 3600;

      await expect(
        gameRegistry.connect(developer1).scheduleMatch(
          "lol-001",
          "match-001",
          pastTime,
          '{"team1": "TSM", "team2": "C9"}'
        )
      ).to.be.revertedWith("GameRegistry: Must schedule in future");
    });

    it("Should only allow game developer to schedule matches", async function () {
      const futureTime = (await time.latest()) + 3600;

      await expect(
        gameRegistry.connect(developer2).scheduleMatch(
          "lol-001",
          "match-001",
          futureTime,
          '{"team1": "TSM", "team2": "C9"}'
        )
      ).to.be.revertedWith("GameRegistry: Only game developer can schedule");
    });

    it("Should fail to schedule match for inactive game", async function () {
      await gameRegistry.connect(developer1).deactivateGame("lol-001");

      const futureTime = (await time.latest()) + 3600;

      await expect(
        gameRegistry.connect(developer1).scheduleMatch(
          "lol-001",
          "match-001",
          futureTime,
          '{"team1": "TSM", "team2": "C9"}'
        )
      ).to.be.revertedWith("GameRegistry: Game not active");
    });
  });

  describe("Stake Management", function () {
    beforeEach(async function () {
      await gameRegistry.connect(developer1).registerGame(
        "lol-001",
        "League of Legends",
        0,
        { value: REGISTRATION_STAKE }
      );
    });

    it("Should allow slashing stake", async function () {
      const slashAmount = ethers.parseEther("0.05");

      await expect(
        gameRegistry.slashStake("lol-001", slashAmount, "Fraudulent result")
      )
        .to.emit(gameRegistry, "StakeSlashed")
        .withArgs("lol-001", developer1.address, slashAmount, "Fraudulent result");

      const game = await gameRegistry.getGame("lol-001");
      expect(game.stakedAmount).to.equal(ethers.parseEther("0.05"));
    });

    it("Should deactivate game if stake drops below minimum", async function () {
      await expect(
        gameRegistry.slashStake("lol-001", REGISTRATION_STAKE, "Major violation")
      )
        .to.emit(gameRegistry, "GameDeactivated")
        .withArgs("lol-001", developer1.address);

      const game = await gameRegistry.getGame("lol-001");
      expect(game.isActive).to.be.false;
    });

    it("Should allow developer to deactivate their game", async function () {
      await expect(
        gameRegistry.connect(developer1).deactivateGame("lol-001")
      )
        .to.emit(gameRegistry, "GameDeactivated")
        .withArgs("lol-001", developer1.address);

      const game = await gameRegistry.getGame("lol-001");
      expect(game.isActive).to.be.false;
    });

    it("Should not allow non-developer to deactivate game", async function () {
      await expect(
        gameRegistry.connect(developer2).deactivateGame("lol-001")
      ).to.be.revertedWith("GameRegistry: Only developer can deactivate");
    });

    it("Should allow stake withdrawal after cooldown", async function () {
      await gameRegistry.connect(developer1).deactivateGame("lol-001");

      // Fast forward 7 days
      await time.increase(7 * 24 * 60 * 60);

      const initialBalance = await ethers.provider.getBalance(developer1.address);

      const tx = await gameRegistry.connect(developer1).withdrawStake("lol-001");
      const receipt = await tx.wait();
      const gasUsed = receipt.gasUsed * receipt.gasPrice;

      const finalBalance = await ethers.provider.getBalance(developer1.address);

      expect(finalBalance).to.be.closeTo(
        initialBalance + REGISTRATION_STAKE - gasUsed,
        ethers.parseEther("0.001")
      );
    });

    it("Should fail stake withdrawal before cooldown", async function () {
      await gameRegistry.connect(developer1).deactivateGame("lol-001");

      await expect(
        gameRegistry.connect(developer1).withdrawStake("lol-001")
      ).to.be.revertedWith("GameRegistry: Cooldown period not elapsed");
    });
  });

  describe("Reputation System", function () {
    beforeEach(async function () {
      await gameRegistry.connect(developer1).registerGame(
        "lol-001",
        "League of Legends",
        0,
        { value: REGISTRATION_STAKE }
      );
    });

    it("Should update reputation score", async function () {
      await expect(
        gameRegistry.updateReputation("lol-001", 750)
      )
        .to.emit(gameRegistry, "ReputationUpdated")
        .withArgs("lol-001", 500, 750);

      const game = await gameRegistry.getGame("lol-001");
      expect(game.reputationScore).to.equal(750);
    });

    it("Should not allow reputation above 1000", async function () {
      await expect(
        gameRegistry.updateReputation("lol-001", 1001)
      ).to.be.revertedWith("GameRegistry: Score must be <= 1000");
    });
  });

  describe("View Functions", function () {
    it("Should return all registered games", async function () {
      await gameRegistry.connect(developer1).registerGame(
        "lol-001",
        "League of Legends",
        0,
        { value: REGISTRATION_STAKE }
      );

      await gameRegistry.connect(developer2).registerGame(
        "valorant-001",
        "Valorant",
        1,
        { value: REGISTRATION_STAKE }
      );

      const allGames = await gameRegistry.getAllGames();
      expect(allGames.length).to.equal(2);

      const totalGames = await gameRegistry.getTotalGames();
      expect(totalGames).to.equal(2);
    });

    it("Should return matches for a game", async function () {
      await gameRegistry.connect(developer1).registerGame(
        "lol-001",
        "League of Legends",
        0,
        { value: REGISTRATION_STAKE }
      );

      const futureTime = (await time.latest()) + 3600;

      await gameRegistry.connect(developer1).scheduleMatch(
        "lol-001",
        "match-001",
        futureTime,
        '{"team1": "TSM", "team2": "C9"}'
      );

      await gameRegistry.connect(developer1).scheduleMatch(
        "lol-001",
        "match-002",
        futureTime + 7200,
        '{"team1": "TL", "team2": "100T"}'
      );

      const gameMatches = await gameRegistry.getGameMatches("lol-001");
      expect(gameMatches.length).to.equal(2);
    });
  });
});
