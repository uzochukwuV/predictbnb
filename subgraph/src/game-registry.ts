import { BigInt, Bytes } from "@graphprotocol/graph-ts";
import {
  GameRegistered,
  MatchScheduled,
  StakeIncreased,
  StakeSlashed,
  ReputationUpdated,
  GameDeactivated,
  GameBanned,
  ResultSubmitted as MatchResultSubmitted,
} from "../generated/GameRegistry/GameRegistry";
import { Game, Match, ProtocolStats, DailyStats } from "../generated/schema";

export function handleGameRegistered(event: GameRegistered): void {
  let game = new Game(event.params.gameId.toHex());

  game.developer = event.params.developer;
  game.name = event.params.name;
  game.metadata = "";
  game.stakedAmount = event.params.stakedAmount;
  game.reputation = 500; // Default starting reputation
  game.registeredAt = event.params.timestamp;
  game.totalMatches = 0;
  game.totalDisputes = 0;
  game.isActive = true;
  game.isBanned = false;
  game.createdAt = event.block.timestamp;
  game.updatedAt = event.block.timestamp;

  game.save();

  // Update protocol stats
  let stats = getOrCreateProtocolStats();
  stats.totalGames = stats.totalGames + 1;
  stats.updatedAt = event.block.timestamp;
  stats.save();

  // Update daily stats
  let dailyStats = getOrCreateDailyStats(event.block.timestamp);
  dailyStats.gamesRegistered = dailyStats.gamesRegistered + 1;
  dailyStats.save();
}

export function handleMatchScheduled(event: MatchScheduled): void {
  let match = new Match(event.params.matchId.toHex());

  match.game = event.params.gameId.toHex();
  match.scheduledTime = event.params.scheduledTime;
  match.metadata = event.params.metadata;
  match.submitter = event.params.submitter;
  match.hasResult = false;
  match.createdAt = event.block.timestamp;

  match.save();

  // Update game
  let game = Game.load(event.params.gameId.toHex());
  if (game != null) {
    game.totalMatches = game.totalMatches + 1;
    game.updatedAt = event.block.timestamp;
    game.save();
  }

  // Update protocol stats
  let stats = getOrCreateProtocolStats();
  stats.totalMatches = stats.totalMatches + 1;
  stats.updatedAt = event.block.timestamp;
  stats.save();

  // Update daily stats
  let dailyStats = getOrCreateDailyStats(event.block.timestamp);
  dailyStats.matchesScheduled = dailyStats.matchesScheduled + 1;
  dailyStats.save();
}

export function handleStakeIncreased(event: StakeIncreased): void {
  let game = Game.load(event.params.gameId.toHex());
  if (game != null) {
    game.stakedAmount = event.params.newTotal;
    game.updatedAt = event.block.timestamp;
    game.save();
  }
}

export function handleStakeSlashed(event: StakeSlashed): void {
  let game = Game.load(event.params.gameId.toHex());
  if (game != null) {
    game.stakedAmount = event.params.remainingStake;
    game.updatedAt = event.block.timestamp;
    game.save();
  }
}

export function handleReputationUpdated(event: ReputationUpdated): void {
  let game = Game.load(event.params.gameId.toHex());
  if (game != null) {
    game.reputation = event.params.newReputation;
    game.updatedAt = event.block.timestamp;
    game.save();
  }
}

export function handleGameDeactivated(event: GameDeactivated): void {
  let game = Game.load(event.params.gameId.toHex());
  if (game != null) {
    game.isActive = false;
    game.updatedAt = event.block.timestamp;
    game.save();
  }
}

export function handleGameBanned(event: GameBanned): void {
  let game = Game.load(event.params.gameId.toHex());
  if (game != null) {
    game.isBanned = true;
    game.isActive = false;
    game.updatedAt = event.block.timestamp;
    game.save();
  }
}

export function handleMatchResultSubmitted(event: MatchResultSubmitted): void {
  let match = Match.load(event.params.matchId.toHex());
  if (match != null) {
    match.hasResult = true;
    match.save();
  }
}

// Helper functions
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

  return stats;
}

function getOrCreateDailyStats(timestamp: BigInt): DailyStats {
  let dayTimestamp = timestamp.toI32() / 86400 * 86400; // Round to start of day
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

  return stats;
}
