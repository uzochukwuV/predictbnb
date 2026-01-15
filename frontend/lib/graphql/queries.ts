// GraphQL queries for PredictBNB Subgraph
// These would be used when the subgraph is deployed

export const PROTOCOL_STATS_QUERY = `
  query ProtocolStats {
    protocolStats(id: "protocol") {
      totalGames
      totalMatches
      totalResults
      totalQueries
      totalRevenue
      protocolBalance
      disputerPoolBalance
      updatedAt
    }
  }
`

export const ALL_GAMES_QUERY = `
  query AllGames($first: Int!, $skip: Int!, $orderBy: String!, $orderDirection: String!) {
    games(
      first: $first
      skip: $skip
      orderBy: $orderBy
      orderDirection: $orderDirection
      where: { isActive: true }
    ) {
      id
      developer
      name
      metadata
      stakedAmount
      reputation
      registeredAt
      totalMatches
      totalDisputes
      isActive
      isBanned
      earnings {
        totalEarned
        withdrawn
        pendingEarnings
        totalQueries
      }
      createdAt
      updatedAt
    }
  }
`

export const DEVELOPER_GAMES_QUERY = `
  query DeveloperGames($developer: Bytes!) {
    games(where: { developer: $developer }) {
      id
      name
      metadata
      stakedAmount
      reputation
      registeredAt
      totalMatches
      totalDisputes
      isActive
      isBanned
      earnings {
        totalEarned
        withdrawn
        pendingEarnings
        totalQueries
      }
      createdAt
      updatedAt
    }
  }
`

export const GAME_DETAILS_QUERY = `
  query GameDetails($gameId: ID!) {
    game(id: $gameId) {
      id
      developer
      name
      metadata
      stakedAmount
      reputation
      registeredAt
      totalMatches
      totalDisputes
      isActive
      isBanned
      matches(first: 10, orderBy: createdAt, orderDirection: desc) {
        id
        scheduledTime
        metadata
        hasResult
        result {
          isFinalized
          isDisputed
        }
      }
      earnings {
        totalEarned
        withdrawn
        pendingEarnings
        totalQueries
      }
      createdAt
      updatedAt
    }
  }
`

export const RECENT_RESULTS_QUERY = `
  query RecentResults($first: Int!) {
    results(
      first: $first
      orderBy: createdAt
      orderDirection: desc
    ) {
      id
      game {
        id
        name
      }
      match {
        id
        scheduledTime
      }
      submitter
      isFinalized
      isDisputed
      submittedAt
      finalizedAt
      createdAt
    }
  }
`

export const RECENT_QUERIES_QUERY = `
  query RecentQueries($first: Int!) {
    queries(
      first: $first
      orderBy: timestamp
      orderDirection: desc
    ) {
      id
      consumer
      result {
        id
        game {
          name
        }
      }
      isQuickField
      fee
      timestamp
    }
  }
`

export const DISPUTES_QUERY = `
  query Disputes($status: DisputeStatus) {
    disputes(
      where: { status: $status }
      orderBy: createdAt
      orderDirection: desc
      first: 20
    ) {
      id
      game {
        id
        name
      }
      match {
        id
      }
      challenger
      stakeAmount
      status
      reason
      resolver
      createdAt
      resolvedAt
    }
  }
`

export const DAILY_STATS_QUERY = `
  query DailyStats($days: Int!) {
    dailyStats(
      first: $days
      orderBy: date
      orderDirection: desc
    ) {
      id
      date
      gamesRegistered
      matchesScheduled
      resultsSubmitted
      queriesMade
      revenue
      timestamp
    }
  }
`

export const LEADERBOARD_GAMES_QUERY = `
  query LeaderboardGames($first: Int!) {
    games(
      first: $first
      orderBy: totalQueries
      orderDirection: desc
      where: { isActive: true }
    ) {
      id
      name
      developer
      reputation
      earnings {
        totalQueries
        totalEarned
      }
    }
  }
`

export const CONSUMER_BALANCE_QUERY = `
  query ConsumerBalance($consumer: ID!) {
    consumerBalance(id: $consumer) {
      consumer
      depositedAmount
      creditAmount
      queriesUsed
      freeQueriesUsed
      bonusTier
      lastResetTime
      updatedAt
    }
  }
`
