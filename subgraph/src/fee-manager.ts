import { BigInt } from "@graphprotocol/graph-ts";
import {
  BalanceDeposited,
  QueryFeeCharged,
  RevenueDistributed,
  EarningsWithdrawn,
  FreeTierReset,
} from "../generated/FeeManager/FeeManager";
import {
  ConsumerBalance,
  GameEarnings,
  Query,
  Result,
  ProtocolStats,
  DailyStats,
} from "../generated/schema";

export function handleBalanceDeposited(event: BalanceDeposited): void {
  let balance = ConsumerBalance.load(event.params.consumer.toHex());

  if (balance == null) {
    balance = new ConsumerBalance(event.params.consumer.toHex());
    balance.consumer = event.params.consumer;
    balance.queriesUsed = 0;
    balance.freeQueriesUsed = 0;
    balance.lastResetTime = event.block.timestamp;
  }

  balance.depositedAmount = event.params.depositAmount;
  balance.creditAmount = event.params.creditAmount;
  balance.bonusTier = event.params.bonusTier;
  balance.updatedAt = event.block.timestamp;

  balance.save();
}

export function handleQueryFeeCharged(event: QueryFeeCharged): void {
  // Create Query entity
  let queryId = event.transaction.hash.toHex() + "-" + event.logIndex.toString();
  let query = new Query(queryId);

  query.consumer = event.params.consumer;
  query.result = event.params.matchId.toHex();
  query.isQuickField = event.params.isQuickField;
  query.fee = event.params.fee;
  query.timestamp = event.block.timestamp;

  // Load result to get game reference
  let result = Result.load(event.params.matchId.toHex());
  if (result != null) {
    query.game = result.game;
  } else {
    // Fallback to gameId from event
    query.game = event.params.gameId.toHex();
  }

  query.save();

  // Update consumer balance
  let balance = ConsumerBalance.load(event.params.consumer.toHex());

  if (balance != null) {
    balance.queriesUsed = balance.queriesUsed + 1;

    if (event.params.usedFreeTier) {
      balance.freeQueriesUsed = balance.freeQueriesUsed + 1;
    } else {
      balance.creditAmount = balance.creditAmount.minus(event.params.fee);
    }

    balance.updatedAt = event.block.timestamp;
    balance.save();
  }

  // Update protocol stats
  let stats = getOrCreateProtocolStats();
  stats.totalQueries = stats.totalQueries.plus(BigInt.fromI32(1));
  stats.totalRevenue = stats.totalRevenue.plus(event.params.fee);
  stats.updatedAt = event.block.timestamp;
  stats.save();

  // Update daily stats
  let dailyStats = getOrCreateDailyStats(event.block.timestamp);
  dailyStats.queriesMade = dailyStats.queriesMade + 1;
  dailyStats.revenue = dailyStats.revenue.plus(event.params.fee);
  dailyStats.save();
}

export function handleRevenueDistributed(event: RevenueDistributed): void {
  let earnings = GameEarnings.load(event.params.gameId.toHex());

  if (earnings == null) {
    earnings = new GameEarnings(event.params.gameId.toHex());
    earnings.game = event.params.gameId.toHex();
    earnings.totalEarned = BigInt.fromI32(0);
    earnings.withdrawn = BigInt.fromI32(0);
    earnings.pendingEarnings = BigInt.fromI32(0);
    earnings.totalQueries = 0;
  }

  earnings.totalEarned = earnings.totalEarned.plus(event.params.developerAmount);
  earnings.pendingEarnings = earnings.pendingEarnings.plus(event.params.developerAmount);
  earnings.totalQueries = earnings.totalQueries + 1;
  earnings.updatedAt = event.block.timestamp;

  earnings.save();

  // Update protocol stats
  let stats = ProtocolStats.load("protocol");
  if (stats != null) {
    stats.protocolBalance = stats.protocolBalance.plus(event.params.protocolAmount);
    stats.disputerPoolBalance = stats.disputerPoolBalance.plus(event.params.disputerAmount);
    stats.updatedAt = event.block.timestamp;
    stats.save();
  }
}

export function handleEarningsWithdrawn(event: EarningsWithdrawn): void {
  let earnings = GameEarnings.load(event.params.gameId.toHex());

  if (earnings != null) {
    earnings.withdrawn = earnings.withdrawn.plus(event.params.amount);
    earnings.pendingEarnings = earnings.pendingEarnings.minus(event.params.amount);
    earnings.updatedAt = event.block.timestamp;
    earnings.save();
  }
}

export function handleFreeTierReset(event: FreeTierReset): void {
  let balance = ConsumerBalance.load(event.params.consumer.toHex());

  if (balance != null) {
    balance.freeQueriesUsed = 0;
    balance.lastResetTime = event.params.resetTime;
    balance.updatedAt = event.block.timestamp;
    balance.save();
  }
}

// ============ Helper Functions ============

function getOrCreateProtocolStats(): ProtocolStats {
  let stats = ProtocolStats.load("protocol");

  if (stats == null) {
    stats = new ProtocolStats("protocol");
    stats.totalGames = 0;
    stats.totalMatches = 0;
    stats.totalResults = 0;
    stats.totalQueries = BigInt.fromI32(0);
    stats.totalRevenue = BigInt.fromI32(0);
    stats.protocolBalance = BigInt.fromI32(0);
    stats.disputerPoolBalance = BigInt.fromI32(0);
    stats.updatedAt = BigInt.fromI32(0);
  }

  return stats as ProtocolStats;
}

function getOrCreateDailyStats(timestamp: BigInt): DailyStats {
  // Get day start timestamp (midnight UTC)
  let dayTimestamp = timestamp.toI32() / 86400 * 86400;
  let id = dayTimestamp.toString();

  let stats = DailyStats.load(id);

  if (stats == null) {
    stats = new DailyStats(id);
    stats.date = BigInt.fromI32(dayTimestamp);
    stats.gamesRegistered = 0;
    stats.matchesScheduled = 0;
    stats.resultsSubmitted = 0;
    stats.queriesMade = 0;
    stats.revenue = BigInt.fromI32(0);
    stats.timestamp = timestamp;
  }

  return stats as DailyStats;
}
