import { BigInt } from "@graphprotocol/graph-ts";
import {
  ResultSubmitted,
  ResultFinalized,
  ResultQueried,
  QuickFieldAdded as QuickFieldAddedEvent,
} from "../generated/OracleCore/OracleCore";
import {
  Result,
  QuickField,
  Query,
  Match,
  ProtocolStats,
  DailyStats,
} from "../generated/schema";

export function handleResultSubmitted(event: ResultSubmitted): void {
  let result = new Result(event.params.matchId.toHex());

  result.match = event.params.matchId.toHex();
  result.game = event.params.gameId.toHex();
  result.submitter = event.params.submitter;
  result.encodedData = new Uint8Array(0); // Will be populated if needed
  result.decodeSchema = "";
  result.submittedAt = event.params.submittedAt;
  result.isFinalized = false;
  result.isDisputed = false;
  result.createdAt = event.block.timestamp;

  result.save();

  // Update protocol stats
  let stats = ProtocolStats.load("protocol");
  if (stats != null) {
    stats.totalResults = stats.totalResults + 1;
    stats.updatedAt = event.block.timestamp;
    stats.save();
  }

  // Update daily stats
  let dayTimestamp = event.block.timestamp.toI32() / 86400 * 86400;
  let dailyStats = DailyStats.load(dayTimestamp.toString());
  if (dailyStats != null) {
    dailyStats.resultsSubmitted = dailyStats.resultsSubmitted + 1;
    dailyStats.save();
  }
}

export function handleResultFinalized(event: ResultFinalized): void {
  let result = Result.load(event.params.matchId.toHex());
  if (result != null) {
    result.isFinalized = true;
    result.finalizedAt = event.params.finalizedAt;
    result.save();
  }
}

export function handleResultQueried(event: ResultQueried): void {
  // Create query record
  let queryId = event.transaction.hash.toHex() + "-" + event.logIndex.toString();
  let query = new Query(queryId);

  query.consumer = event.params.consumer;
  query.result = event.params.matchId.toHex();
  query.isQuickField = event.params.isQuickField;
  query.fee = event.params.fee;
  query.timestamp = event.block.timestamp;

  // Get game from result
  let result = Result.load(event.params.matchId.toHex());
  if (result != null) {
    query.game = result.game;
  }

  query.save();

  // Update protocol stats
  let stats = ProtocolStats.load("protocol");
  if (stats != null) {
    stats.totalQueries = stats.totalQueries.plus(BigInt.fromI32(1));
    stats.totalRevenue = stats.totalRevenue.plus(event.params.fee);
    stats.updatedAt = event.block.timestamp;
    stats.save();
  }

  // Update daily stats
  let dayTimestamp = event.block.timestamp.toI32() / 86400 * 86400;
  let dailyStats = DailyStats.load(dayTimestamp.toString());
  if (dailyStats != null) {
    dailyStats.queriesMade = dailyStats.queriesMade + 1;
    dailyStats.revenue = dailyStats.revenue.plus(event.params.fee);
    dailyStats.save();
  }
}

export function handleQuickFieldAdded(event: QuickFieldAddedEvent): void {
  let fieldId = event.params.matchId.toHex() + "-" + event.params.fieldHash.toHex();
  let quickField = new QuickField(fieldId);

  quickField.result = event.params.matchId.toHex();
  quickField.fieldHash = event.params.fieldHash;
  quickField.fieldValue = event.params.value;
  quickField.createdAt = event.block.timestamp;

  quickField.save();
}

export function handleDisputeInitiated(event: DisputeInitiated): void {
  let result = Result.load(event.params.matchId.toHex());
  if (result != null) {
    result.isDisputed = true;
    result.save();
  }
}
