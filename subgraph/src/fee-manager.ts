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
  ProtocolStats,
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
