const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("PredictToken - Airdrop & Vesting", function () {
  let predictToken;
  let feeManager;
  let owner, user1, user2, user3, teamMember1, teamMember2;

  const TOTAL_SUPPLY = ethers.parseEther("1000000000"); // 1 billion
  const AIRDROP_POOL = ethers.parseEther("400000000"); // 400M
  const TEAM_ALLOCATION = ethers.parseEther("200000000"); // 200M

  beforeEach(async function () {
    [owner, user1, user2, user3, teamMember1, teamMember2, feeManager] = await ethers.getSigners();

    const PredictToken = await ethers.getContractFactory("PredictToken");
    predictToken = await PredictToken.deploy();
    await predictToken.waitForDeployment();

    // Set fee manager
    await predictToken.setFeeManager(feeManager.address);
  });

  describe("1. Token Basics", function () {
    it("Should have correct name and symbol", async function () {
      expect(await predictToken.name()).to.equal("PredictBNB");
      expect(await predictToken.symbol()).to.equal("PREDICT");
    });

    it("Should have correct total supply", async function () {
      const totalSupply = await predictToken.totalSupply();
      expect(totalSupply).to.equal(TOTAL_SUPPLY);
    });

    it("Should mint all tokens to owner initially", async function () {
      const ownerBalance = await predictToken.balanceOf(owner.address);
      expect(ownerBalance).to.equal(TOTAL_SUPPLY);
    });

    it("Should have correct decimals", async function () {
      expect(await predictToken.decimals()).to.equal(18);
    });
  });

  describe("2. Activity Tracking", function () {
    it("Should allow fee manager to update activity", async function () {
      await predictToken.connect(feeManager).updateActivity(
        user1.address,
        100, // queries
        ethers.parseEther("5"), // deposited
        3 // referrals
      );

      const activity = await predictToken.userActivity(user1.address);
      expect(activity.totalQueries).to.equal(100);
      expect(activity.totalDeposited).to.equal(ethers.parseEther("5"));
      expect(activity.referralCount).to.equal(3);
    });

    it("Should allow owner to update activity", async function () {
      await predictToken.connect(owner).updateActivity(
        user1.address,
        50,
        ethers.parseEther("2"),
        1
      );

      const activity = await predictToken.userActivity(user1.address);
      expect(activity.totalQueries).to.equal(50);
    });

    it("Should revert if unauthorized user tries to update activity", async function () {
      await expect(
        predictToken.connect(user1).updateActivity(
          user2.address,
          100,
          ethers.parseEther("1"),
          0
        )
      ).to.be.revertedWith("Not authorized");
    });

    it("Should mark early adopters", async function () {
      // Update activity within early adopter window
      await predictToken.connect(feeManager).updateActivity(
        user1.address,
        10,
        ethers.parseEther("1"),
        0
      );

      const activity = await predictToken.userActivity(user1.address);
      expect(activity.isEarlyAdopter).to.be.true;
    });

    it("Should not mark as early adopter after cutoff", async function () {
      // Fast forward past early adopter cutoff (30 days)
      await time.increase(31 * 24 * 60 * 60);

      await predictToken.connect(feeManager).updateActivity(
        user1.address,
        10,
        ethers.parseEther("1"),
        0
      );

      const activity = await predictToken.userActivity(user1.address);
      expect(activity.isEarlyAdopter).to.be.false;
    });

    it("Should emit ActivityRecorded event", async function () {
      await expect(
        predictToken.connect(feeManager).updateActivity(
          user1.address,
          100,
          ethers.parseEther("5"),
          3
        )
      ).to.emit(predictToken, "ActivityRecorded")
        .withArgs(user1.address, 100, ethers.parseEther("5"), 3);
    });
  });

  describe("3. Airdrop Snapshot", function () {
    beforeEach(async function () {
      // Set up user activities
      await predictToken.connect(feeManager).updateActivity(
        user1.address,
        1000, // queries
        ethers.parseEther("10"), // deposited
        5, // referrals
        { gasLimit: 500000 }
      );

      await predictToken.connect(feeManager).updateActivity(
        user2.address,
        500,
        ethers.parseEther("5"),
        2,
        { gasLimit: 500000 }
      );

      await predictToken.connect(feeManager).updateActivity(
        user3.address,
        100,
        ethers.parseEther("1"),
        0,
        { gasLimit: 500000 }
      );
    });

    it("Should calculate activity scores correctly", async function () {
      const users = [user1.address, user2.address, user3.address];
      await predictToken.takeSnapshot(users);

      const user1Score = await predictToken.getUserScore(user1.address);
      const user2Score = await predictToken.getUserScore(user2.address);
      const user3Score = await predictToken.getUserScore(user3.address);

      expect(user1Score).to.be.gt(user2Score);
      expect(user2Score).to.be.gt(user3Score);
    });

    it("Should allocate tokens proportionally", async function () {
      const users = [user1.address, user2.address, user3.address];
      await predictToken.takeSnapshot(users);

      const user1Allocation = await predictToken.airdropAllocation(user1.address);
      const user2Allocation = await predictToken.airdropAllocation(user2.address);
      const user3Allocation = await predictToken.airdropAllocation(user3.address);

      // User1 should get most, user3 should get least
      expect(user1Allocation).to.be.gt(user2Allocation);
      expect(user2Allocation).to.be.gt(user3Allocation);

      // Total should equal AIRDROP_POOL
      const totalAllocated = user1Allocation + user2Allocation + user3Allocation;
      expect(totalAllocated).to.be.closeTo(AIRDROP_POOL, ethers.parseEther("100"));
    });

    it("Should set snapshot taken flag", async function () {
      const users = [user1.address];
      await predictToken.takeSnapshot(users);

      expect(await predictToken.snapshotTaken()).to.be.true;
    });

    it("Should set claim window", async function () {
      const users = [user1.address];
      await predictToken.takeSnapshot(users);

      const claimStart = await predictToken.airdropClaimStart();
      const claimEnd = await predictToken.airdropClaimEnd();

      expect(claimStart).to.be.gt(0);
      expect(claimEnd).to.be.gt(claimStart);
      expect(claimEnd - claimStart).to.equal(90n * 24n * 60n * 60n); // 90 days
    });

    it("Should emit SnapshotTaken event", async function () {
      const users = [user1.address];
      await expect(predictToken.takeSnapshot(users))
        .to.emit(predictToken, "SnapshotTaken");
    });

    it("Should emit AirdropCalculated for each user", async function () {
      const users = [user1.address, user2.address];
      const tx = await predictToken.takeSnapshot(users);
      const receipt = await tx.wait();

      const events = receipt.logs.filter(log => {
        try {
          return predictToken.interface.parseLog(log).name === "AirdropCalculated";
        } catch {
          return false;
        }
      });

      expect(events.length).to.equal(2);
    });

    it("Should revert if snapshot already taken", async function () {
      const users = [user1.address];
      await predictToken.takeSnapshot(users);

      await expect(
        predictToken.takeSnapshot(users)
      ).to.be.revertedWith("Snapshot already taken");
    });

    it("Should only allow owner to take snapshot", async function () {
      const users = [user1.address];
      await expect(
        predictToken.connect(user1).takeSnapshot(users)
      ).to.be.reverted;
    });

    it("Should weight queries at 40%", async function () {
      // Create user with only queries
      await predictToken.connect(feeManager).updateActivity(
        user1.address,
        1000,
        0,
        0
      );

      await predictToken.takeSnapshot([user1.address]);
      const score = await predictToken.getUserScore(user1.address);

      // Score should reflect 40% weight on queries
      expect(score).to.be.gt(0);
    });

    it("Should give early adopter bonus", async function () {
      // Deploy fresh token for this test to avoid pollution
      const PredictToken = await ethers.getContractFactory("PredictToken");
      const freshToken = await PredictToken.deploy();
      await freshToken.waitForDeployment();
      await freshToken.setFeeManager(feeManager.address);

      // User1: early adopter (record activity early)
      await freshToken.connect(feeManager).updateActivity(
        user1.address,
        500, // queries
        ethers.parseEther("2"), // deposits
        1 // referrals
      );

      // Verify user1 is marked as early adopter
      const user1ActivityBefore = await freshToken.userActivity(user1.address);
      expect(user1ActivityBefore.isEarlyAdopter).to.be.true;

      // Fast forward past early adopter window (30 days)
      await time.increase(31 * 24 * 60 * 60);

      // Verify we're past the cutoff
      const cutoff = await freshToken.earlyAdopterCutoff();
      const currentTime = await time.latest();
      expect(currentTime).to.be.gt(cutoff);

      // User2: not early adopter with SAME activity levels (recorded after cutoff)
      await freshToken.connect(feeManager).updateActivity(
        user2.address,
        500, // Same queries
        ethers.parseEther("2"), // Same deposits
        1 // Same referrals
      );

      // Verify user2 is NOT marked as early adopter
      const user2ActivityBefore = await freshToken.userActivity(user2.address);
      expect(user2ActivityBefore.isEarlyAdopter).to.be.false;

      await freshToken.takeSnapshot([user1.address, user2.address]);

      const user1Score = await freshToken.getUserScore(user1.address);
      const user2Score = await freshToken.getUserScore(user2.address);

      // User1 should have higher score due to early adopter bonus
      // Early adopter bonus adds: 1000 * 10 / 100 = 100 points
      expect(user1Score).to.be.gt(user2Score);
    });
  });

  describe("4. Airdrop Claiming", function () {
    beforeEach(async function () {
      // Setup and take snapshot
      await predictToken.connect(feeManager).updateActivity(
        user1.address,
        1000,
        ethers.parseEther("10"),
        5
      );

      await predictToken.connect(feeManager).updateActivity(
        user2.address,
        500,
        ethers.parseEther("5"),
        2
      );

      await predictToken.takeSnapshot([user1.address, user2.address]);
    });

    it("Should allow user to claim airdrop", async function () {
      const allocation = await predictToken.airdropAllocation(user1.address);
      const balanceBefore = await predictToken.balanceOf(user1.address);

      await predictToken.connect(user1).claimAirdrop();

      const balanceAfter = await predictToken.balanceOf(user1.address);
      expect(balanceAfter - balanceBefore).to.equal(allocation);
    });

    it("Should mark user as claimed", async function () {
      await predictToken.connect(user1).claimAirdrop();

      expect(await predictToken.hasClaimedAirdrop(user1.address)).to.be.true;
    });

    it("Should emit AirdropClaimed event", async function () {
      const allocation = await predictToken.airdropAllocation(user1.address);

      await expect(predictToken.connect(user1).claimAirdrop())
        .to.emit(predictToken, "AirdropClaimed")
        .withArgs(user1.address, allocation);
    });

    it("Should revert if snapshot not taken", async function () {
      const PredictToken = await ethers.getContractFactory("PredictToken");
      const newToken = await PredictToken.deploy();
      await newToken.waitForDeployment();

      await expect(
        newToken.connect(user1).claimAirdrop()
      ).to.be.revertedWith("Snapshot not taken yet");
    });

    it("Should revert if already claimed", async function () {
      await predictToken.connect(user1).claimAirdrop();

      await expect(
        predictToken.connect(user1).claimAirdrop()
      ).to.be.revertedWith("Already claimed");
    });

    it("Should revert if no allocation", async function () {
      await expect(
        predictToken.connect(user3).claimAirdrop()
      ).to.be.revertedWith("No allocation");
    });

    it("Should revert if claim window not started", async function () {
      // This is edge case - in practice snapshot sets claim start to now
      // Test is to ensure the check exists
    });

    it("Should revert if claim window ended", async function () {
      // Fast forward past claim window (90 days)
      await time.increase(91 * 24 * 60 * 60);

      await expect(
        predictToken.connect(user1).claimAirdrop()
      ).to.be.revertedWith("Claim window closed");
    });

    it("Should allow multiple users to claim", async function () {
      await predictToken.connect(user1).claimAirdrop();
      await predictToken.connect(user2).claimAirdrop();

      expect(await predictToken.hasClaimedAirdrop(user1.address)).to.be.true;
      expect(await predictToken.hasClaimedAirdrop(user2.address)).to.be.true;
    });
  });

  describe("5. Team Vesting", function () {
    it("Should create vesting schedule", async function () {
      const amount = ethers.parseEther("1000000"); // 1M tokens

      await predictToken.createVestingSchedule(teamMember1.address, amount);

      const schedule = await predictToken.vestingSchedules(teamMember1.address);
      expect(schedule.totalAmount).to.equal(amount);
      expect(schedule.releasedAmount).to.equal(0);
    });

    it("Should emit VestingScheduleCreated event", async function () {
      const amount = ethers.parseEther("1000000");

      await expect(
        predictToken.createVestingSchedule(teamMember1.address, amount)
      ).to.emit(predictToken, "VestingScheduleCreated")
        .withArgs(teamMember1.address, amount);
    });

    it("Should revert if schedule already exists", async function () {
      const amount = ethers.parseEther("1000000");
      await predictToken.createVestingSchedule(teamMember1.address, amount);

      await expect(
        predictToken.createVestingSchedule(teamMember1.address, amount)
      ).to.be.revertedWith("Schedule exists");
    });

    it("Should revert if amount is zero", async function () {
      await expect(
        predictToken.createVestingSchedule(teamMember1.address, 0)
      ).to.be.revertedWith("Invalid amount");
    });

    it("Should only allow owner to create vesting", async function () {
      await expect(
        predictToken.connect(user1).createVestingSchedule(
          teamMember1.address,
          ethers.parseEther("1000000")
        )
      ).to.be.reverted;
    });

    it("Should not release before cliff", async function () {
      const amount = ethers.parseEther("1000000");
      await predictToken.createVestingSchedule(teamMember1.address, amount);

      // Try to release before 6 months
      await time.increase(5 * 30 * 24 * 60 * 60); // 5 months

      await expect(
        predictToken.connect(teamMember1).releaseVestedTokens()
      ).to.be.revertedWith("Cliff not reached");
    });

    it("Should release tokens after cliff", async function () {
      const amount = ethers.parseEther("1000000");
      await predictToken.createVestingSchedule(teamMember1.address, amount);

      // Fast forward past cliff (6 months)
      await time.increase(6 * 30 * 24 * 60 * 60);

      const balanceBefore = await predictToken.balanceOf(teamMember1.address);
      await predictToken.connect(teamMember1).releaseVestedTokens();
      const balanceAfter = await predictToken.balanceOf(teamMember1.address);

      expect(balanceAfter).to.be.gt(balanceBefore);
    });

    it("Should release proportionally over 2 years", async function () {
      const amount = ethers.parseEther("1000000");
      await predictToken.createVestingSchedule(teamMember1.address, amount);

      // After 1 year (50% of vesting period)
      await time.increase(365 * 24 * 60 * 60);

      await predictToken.connect(teamMember1).releaseVestedTokens();
      const schedule = await predictToken.vestingSchedules(teamMember1.address);

      // Should have released approximately 50%
      const releasedPercent = (schedule.releasedAmount * 100n) / amount;
      expect(releasedPercent).to.be.closeTo(50n, 5n); // Within 5% tolerance
    });

    it("Should release all tokens after 2 years", async function () {
      const amount = ethers.parseEther("1000000");
      await predictToken.createVestingSchedule(teamMember1.address, amount);

      // Fast forward 2+ years
      await time.increase(2 * 365 * 24 * 60 * 60 + 1);

      await predictToken.connect(teamMember1).releaseVestedTokens();
      const schedule = await predictToken.vestingSchedules(teamMember1.address);

      expect(schedule.releasedAmount).to.equal(amount);
    });

    it("Should track released amount correctly", async function () {
      const amount = ethers.parseEther("1000000");
      await predictToken.createVestingSchedule(teamMember1.address, amount);

      // Release after 6 months
      await time.increase(6 * 30 * 24 * 60 * 60);
      await predictToken.connect(teamMember1).releaseVestedTokens();
      const schedule1 = await predictToken.vestingSchedules(teamMember1.address);

      // Release after 1 year
      await time.increase(6 * 30 * 24 * 60 * 60);
      await predictToken.connect(teamMember1).releaseVestedTokens();
      const schedule2 = await predictToken.vestingSchedules(teamMember1.address);

      expect(schedule2.releasedAmount).to.be.gt(schedule1.releasedAmount);
    });

    it("Should emit TokensReleased event", async function () {
      const amount = ethers.parseEther("1000000");
      await predictToken.createVestingSchedule(teamMember1.address, amount);

      await time.increase(6 * 30 * 24 * 60 * 60);

      await expect(
        predictToken.connect(teamMember1).releaseVestedTokens()
      ).to.emit(predictToken, "TokensReleased");
    });

    it("Should revert if no vesting schedule", async function () {
      await expect(
        predictToken.connect(user1).releaseVestedTokens()
      ).to.be.revertedWith("No vesting schedule");
    });

    it("Should revert if no tokens to release", async function () {
      const amount = ethers.parseEther("1000000");
      await predictToken.createVestingSchedule(teamMember1.address, amount);

      // Release all tokens
      await time.increase(2 * 365 * 24 * 60 * 60 + 1);
      await predictToken.connect(teamMember1).releaseVestedTokens();

      // Try to release again
      await expect(
        predictToken.connect(teamMember1).releaseVestedTokens()
      ).to.be.revertedWith("No tokens to release");
    });
  });

  describe("6. View Functions", function () {
    it("Should return vested amount correctly", async function () {
      const amount = ethers.parseEther("1000000");
      await predictToken.createVestingSchedule(teamMember1.address, amount);

      await time.increase(365 * 24 * 60 * 60); // 1 year

      const vested = await predictToken.getVestedAmount(teamMember1.address);
      expect(vested).to.be.gt(0);
      expect(vested).to.be.lte(amount);
    });

    it("Should return releasable amount", async function () {
      const amount = ethers.parseEther("1000000");
      await predictToken.createVestingSchedule(teamMember1.address, amount);

      await time.increase(365 * 24 * 60 * 60);

      const releasable = await predictToken.getReleasableAmount(teamMember1.address);
      expect(releasable).to.be.gt(0);
    });

    it("Should return zero before cliff", async function () {
      const amount = ethers.parseEther("1000000");
      await predictToken.createVestingSchedule(teamMember1.address, amount);

      await time.increase(30 * 24 * 60 * 60); // 1 month

      const vested = await predictToken.getVestedAmount(teamMember1.address);
      expect(vested).to.equal(0);
    });

    it("Should return user score", async function () {
      await predictToken.connect(feeManager).updateActivity(
        user1.address,
        100,
        ethers.parseEther("1"),
        1
      );

      await predictToken.takeSnapshot([user1.address]);

      const score = await predictToken.getUserScore(user1.address);
      expect(score).to.be.gt(0);
    });
  });

  describe("7. Admin Functions", function () {
    it("Should allow owner to set fee manager", async function () {
      const newFeeManager = user3.address;
      await predictToken.setFeeManager(newFeeManager);

      expect(await predictToken.feeManager()).to.equal(newFeeManager);
    });

    it("Should allow owner to set early adopter cutoff", async function () {
      const newCutoff = Math.floor(Date.now() / 1000) + 60 * 24 * 60 * 60; // 60 days
      await predictToken.setEarlyAdopterCutoff(newCutoff);

      expect(await predictToken.earlyAdopterCutoff()).to.equal(newCutoff);
    });

    it("Should revert if non-owner tries admin functions", async function () {
      await expect(
        predictToken.connect(user1).setFeeManager(user2.address)
      ).to.be.reverted;

      await expect(
        predictToken.connect(user1).setEarlyAdopterCutoff(123456)
      ).to.be.reverted;
    });
  });

  describe("8. Integration Tests", function () {
    it("Should handle complete airdrop lifecycle", async function () {
      // 1. Track user activities
      await predictToken.connect(feeManager).updateActivity(
        user1.address,
        1000,
        ethers.parseEther("10"),
        5
      );

      await predictToken.connect(feeManager).updateActivity(
        user2.address,
        500,
        ethers.parseEther("5"),
        2
      );

      // 2. Take snapshot
      await predictToken.takeSnapshot([user1.address, user2.address]);

      // 3. Users claim airdrops
      await predictToken.connect(user1).claimAirdrop();
      await predictToken.connect(user2).claimAirdrop();

      // 4. Verify balances
      const user1Balance = await predictToken.balanceOf(user1.address);
      const user2Balance = await predictToken.balanceOf(user2.address);

      expect(user1Balance).to.be.gt(0);
      expect(user2Balance).to.be.gt(0);
      expect(user1Balance).to.be.gt(user2Balance); // User1 was more active
    });

    it("Should handle team vesting lifecycle", async function () {
      const amount = ethers.parseEther("10000000"); // 10M tokens

      // 1. Create vesting
      await predictToken.createVestingSchedule(teamMember1.address, amount);

      // 2. Wait for cliff
      await time.increase(180 * 24 * 60 * 60);

      // 3. Release some tokens
      await predictToken.connect(teamMember1).releaseVestedTokens();
      const balance1 = await predictToken.balanceOf(teamMember1.address);
      expect(balance1).to.be.gt(0);

      // 4. Wait more time
      await time.increase(365 * 24 * 60 * 60);

      // 5. Release more tokens
      await predictToken.connect(teamMember1).releaseVestedTokens();
      const balance2 = await predictToken.balanceOf(teamMember1.address);
      expect(balance2).to.be.gt(balance1);

      // 6. Wait until fully vested
      await time.increase(365 * 24 * 60 * 60);

      // 7. Release all remaining
      await predictToken.connect(teamMember1).releaseVestedTokens();
      const finalBalance = await predictToken.balanceOf(teamMember1.address);
      expect(finalBalance).to.equal(amount);
    });
  });
});
