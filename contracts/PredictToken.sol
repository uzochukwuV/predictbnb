// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title PredictToken
 * @notice Governance and utility token for PredictBNB platform
 * @dev Includes airdrop functionality with activity-based allocation
 */
contract PredictToken is ERC20, Ownable {
    // ============ Constants ============

    uint256 public constant TOTAL_SUPPLY = 1_000_000_000 * 1e18; // 1 billion tokens

    // Distribution
    uint256 public constant AIRDROP_POOL = 400_000_000 * 1e18;      // 40%
    uint256 public constant TEAM_ALLOCATION = 200_000_000 * 1e18;   // 20%
    uint256 public constant TREASURY = 200_000_000 * 1e18;          // 20%
    uint256 public constant LIQUIDITY_MINING = 150_000_000 * 1e18; // 15%
    uint256 public constant IDO_ALLOCATION = 50_000_000 * 1e18;    // 5%

    // Vesting
    uint64 public constant TEAM_VESTING_DURATION = 730 days; // 2 years
    uint64 public constant TEAM_VESTING_CLIFF = 180 days;    // 6 months

    // Activity scoring weights
    uint8 public constant QUERY_WEIGHT = 40;      // 40%
    uint8 public constant DEPOSIT_WEIGHT = 30;    // 30%
    uint8 public constant REFERRAL_WEIGHT = 20;   // 20%
    uint8 public constant EARLY_ADOPTER_WEIGHT = 10; // 10%

    // ============ Structs (Max 8 fields) ============

    struct UserActivity {
        uint128 totalQueries;        // Total queries made
        uint128 totalDeposited;      // Total BNB deposited
        uint32 referralCount;        // Users referred
        uint32 activityScore;        // Calculated score
        bool isEarlyAdopter;         // Joined in first month
        bool hasClaimedAirdrop;      // Claimed airdrop tokens
    }

    struct VestingSchedule {
        uint128 totalAmount;         // Total tokens to vest
        uint128 releasedAmount;      // Amount already released
        uint64 startTime;            // Vesting start time
        uint64 cliffEnd;             // Cliff end time
    }

    // ============ State Variables ============

    /// @notice Airdrop snapshot taken flag
    bool public snapshotTaken;

    /// @notice Total allocation points for airdrop
    uint256 public totalAllocationPoints;

    /// @notice Airdrop claim window
    uint64 public airdropClaimStart;
    uint64 public airdropClaimEnd;

    /// @notice User activity tracking
    mapping(address => UserActivity) public userActivity;

    /// @notice Individual airdrop allocations
    mapping(address => uint256) public airdropAllocation;

    /// @notice Team vesting schedules
    mapping(address => VestingSchedule) public vestingSchedules;

    /// @notice Early adopter cutoff timestamp
    uint64 public earlyAdopterCutoff;

    /// @notice FeeManager reference for activity tracking
    address public feeManager;

    // ============ Events ============

    event SnapshotTaken(uint256 totalPoints, uint256 timestamp);
    event AirdropCalculated(address indexed user, uint256 allocation, uint256 score);
    event AirdropClaimed(address indexed user, uint256 amount);
    event VestingScheduleCreated(address indexed beneficiary, uint256 amount);
    event TokensReleased(address indexed beneficiary, uint256 amount);
    event ActivityRecorded(address indexed user, uint256 queries, uint256 deposits, uint256 referrals);

    // ============ Constructor ============

    constructor() ERC20("PredictBNB", "PREDICT") Ownable(msg.sender) {
        // Mint total supply to owner initially
        _mint(msg.sender, TOTAL_SUPPLY);

        // Set early adopter cutoff (30 days from now)
        earlyAdopterCutoff = uint64(block.timestamp + 30 days);

        // Set airdrop claim window (starts when snapshot is taken)
        airdropClaimStart = 0; // Will be set when snapshot is taken
        airdropClaimEnd = 0;
    }

    // ============ External Functions ============

    /**
     * @notice Update user activity (called by FeeManager)
     * @param user User address
     * @param queries New query count
     * @param deposited New deposit amount
     * @param referrals New referral count
     */
    function updateActivity(
        address user,
        uint256 queries,
        uint256 deposited,
        uint256 referrals
    ) external {
        require(msg.sender == feeManager || msg.sender == owner(), "Not authorized");

        UserActivity storage activity = userActivity[user];
        activity.totalQueries = uint128(queries);
        activity.totalDeposited = uint128(deposited);
        activity.referralCount = uint32(referrals);

        // Mark as early adopter if within first month
        if (!activity.isEarlyAdopter && block.timestamp <= earlyAdopterCutoff) {
            activity.isEarlyAdopter = true;
        }

        emit ActivityRecorded(user, queries, deposited, referrals);
    }

    /**
     * @notice Take snapshot and calculate all airdrops
     * @param users List of all eligible users
     */
    function takeSnapshot(address[] calldata users) external onlyOwner {
        require(!snapshotTaken, "Snapshot already taken");

        totalAllocationPoints = 0;

        // Calculate scores for all users
        for (uint256 i = 0; i < users.length; i++) {
            address user = users[i];
            UserActivity storage activity = userActivity[user];

            // Calculate weighted score
            uint256 queryScore = activity.totalQueries * QUERY_WEIGHT;
            uint256 depositScore = activity.totalDeposited * DEPOSIT_WEIGHT / 1e18; // Normalize BNB
            uint256 referralScore = activity.referralCount * 1000 * REFERRAL_WEIGHT;
            uint256 earlyScore = activity.isEarlyAdopter ? 1000 * EARLY_ADOPTER_WEIGHT : 0;

            uint32 totalScore = uint32(
                (queryScore + depositScore + referralScore + earlyScore) / 100
            );

            activity.activityScore = totalScore;
            totalAllocationPoints += totalScore;
        }

        // Calculate individual allocations
        for (uint256 i = 0; i < users.length; i++) {
            address user = users[i];
            uint32 score = userActivity[user].activityScore;

            if (score > 0) {
                uint256 allocation = (AIRDROP_POOL * score) / totalAllocationPoints;
                airdropAllocation[user] = allocation;

                emit AirdropCalculated(user, allocation, score);
            }
        }

        snapshotTaken = true;
        airdropClaimStart = uint64(block.timestamp);
        airdropClaimEnd = uint64(block.timestamp + 90 days); // 90-day claim window

        emit SnapshotTaken(totalAllocationPoints, block.timestamp);
    }

    /**
     * @notice Claim airdrop tokens
     */
    function claimAirdrop() external {
        require(snapshotTaken, "Snapshot not taken yet");
        require(block.timestamp >= airdropClaimStart, "Claim not started");
        require(block.timestamp <= airdropClaimEnd, "Claim window closed");

        UserActivity storage activity = userActivity[msg.sender];
        require(!activity.hasClaimedAirdrop, "Already claimed");

        uint256 allocation = airdropAllocation[msg.sender];
        require(allocation > 0, "No allocation");

        activity.hasClaimedAirdrop = true;

        // Transfer tokens from owner (who holds the airdrop pool)
        _transfer(owner(), msg.sender, allocation);

        emit AirdropClaimed(msg.sender, allocation);
    }

    /**
     * @notice Create vesting schedule for team member
     * @param beneficiary Team member address
     * @param amount Total amount to vest
     */
    function createVestingSchedule(
        address beneficiary,
        uint256 amount
    ) external onlyOwner {
        require(vestingSchedules[beneficiary].totalAmount == 0, "Schedule exists");
        require(amount > 0, "Invalid amount");

        vestingSchedules[beneficiary] = VestingSchedule({
            totalAmount: uint128(amount),
            releasedAmount: 0,
            startTime: uint64(block.timestamp),
            cliffEnd: uint64(block.timestamp + TEAM_VESTING_CLIFF)
        });

        emit VestingScheduleCreated(beneficiary, amount);
    }

    /**
     * @notice Release vested tokens
     */
    function releaseVestedTokens() external {
        VestingSchedule storage schedule = vestingSchedules[msg.sender];
        require(schedule.totalAmount > 0, "No vesting schedule");
        require(block.timestamp >= schedule.cliffEnd, "Cliff not reached");

        uint128 vested = _calculateVestedAmount(schedule);
        uint128 releasable = vested - schedule.releasedAmount;
        require(releasable > 0, "No tokens to release");

        schedule.releasedAmount += releasable;

        // Transfer from owner
        _transfer(owner(), msg.sender, releasable);

        emit TokensReleased(msg.sender, releasable);
    }

    // ============ View Functions ============

    function getVestedAmount(address beneficiary) external view returns (uint256) {
        VestingSchedule memory schedule = vestingSchedules[beneficiary];
        if (schedule.totalAmount == 0) return 0;
        if (block.timestamp < schedule.cliffEnd) return 0;

        return _calculateVestedAmount(schedule);
    }

    function getReleasableAmount(address beneficiary) external view returns (uint256) {
        VestingSchedule memory schedule = vestingSchedules[beneficiary];
        if (schedule.totalAmount == 0) return 0;
        if (block.timestamp < schedule.cliffEnd) return 0;

        uint128 vested = _calculateVestedAmount(schedule);
        return vested - schedule.releasedAmount;
    }

    function getUserScore(address user) external view returns (uint32) {
        return userActivity[user].activityScore;
    }

    function hasClaimedAirdrop(address user) external view returns (bool) {
        return userActivity[user].hasClaimedAirdrop;
    }

    // ============ Admin Functions ============

    function setFeeManager(address _feeManager) external onlyOwner {
        feeManager = _feeManager;
    }

    function setEarlyAdopterCutoff(uint64 _cutoff) external onlyOwner {
        earlyAdopterCutoff = _cutoff;
    }

    // ============ Internal Functions ============

    function _calculateVestedAmount(VestingSchedule memory schedule) internal view returns (uint128) {
        if (block.timestamp < schedule.cliffEnd) {
            return 0;
        }

        uint64 elapsed = uint64(block.timestamp) - schedule.startTime;
        if (elapsed >= TEAM_VESTING_DURATION) {
            return schedule.totalAmount;
        }

        return uint128((uint256(schedule.totalAmount) * elapsed) / TEAM_VESTING_DURATION);
    }
}
