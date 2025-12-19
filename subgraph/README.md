# PredictBNB Subgraph

The Graph indexer for PredictBNB Gaming Oracle. Indexes all events from GameRegistry, OracleCore, FeeManager, and DisputeResolver contracts.

## 📦 Setup

### 1. Install Dependencies

```bash
cd subgraph
npm install
```

### 2. Get Your Contract ABIs

Copy the compiled contract ABIs to the `abis/` directory:

```bash
# From project root
cp artifacts/contracts/GameRegistry.sol/GameRegistry.json subgraph/abis/
cp artifacts/contracts/OracleCore.sol/OracleCore.json subgraph/abis/
cp artifacts/contracts/FeeManager.sol/FeeManager.json subgraph/abis/
cp artifacts/contracts/DisputeResolver.sol/DisputeResolver.json subgraph/abis/
```

### 3. Update Contract Addresses

Edit `subgraph.yaml` and replace placeholder addresses with your deployed contract addresses:

```yaml
source:
  address: "0xYOUR_DEPLOYED_ADDRESS"
  startBlock: 12345678  # Block number when contract was deployed
```

### 4. Authenticate with The Graph

Visit [The Graph Studio](https://thegraph.com/studio/) and create a new subgraph.

```bash
# Get your deploy key from The Graph Studio
graph auth --studio YOUR_DEPLOY_KEY
```

## 🚀 Deployment

### Option 1: The Graph Studio (Recommended for BSC Mainnet)

```bash
# Generate TypeScript types from schema
npm run codegen

# Build the subgraph
npm run build

# Deploy to The Graph Studio
npm run deploy
```

### Option 2: Self-Hosted (Local Development)

Run a local Graph Node:

```bash
# Clone Graph Node
git clone https://github.com/graphprotocol/graph-node
cd graph-node/docker

# Update docker-compose.yml with your BSC RPC endpoint
# ethereum: 'bsc:https://bsc-dataseed.binance.org/'

# Start Graph Node
docker-compose up
```

Deploy locally:

```bash
npm run create-local
npm run deploy-local
```

### Option 3: Hosted Service (Being Deprecated)

```bash
graph deploy --product hosted-service YOUR_GITHUB_USERNAME/predictbnb
```

## 🔍 Query Examples

Once deployed, you can query your subgraph at:
`https://api.studio.thegraph.com/query/<SUBGRAPH_ID>/predictbnb-subgraph/<VERSION>`

### Get All Games

```graphql
{
  games(first: 10, orderBy: createdAt, orderDirection: desc) {
    id
    developer
    name
    stakedAmount
    reputation
    totalMatches
    isActive
  }
}
```

### Get Game with Matches and Results

```graphql
{
  game(id: "0x...") {
    id
    name
    developer
    stakedAmount
    reputation
    matches(first: 10) {
      id
      scheduledTime
      hasResult
      result {
        submittedAt
        isFinalized
        quickFields {
          fieldHash
          fieldValue
        }
      }
    }
    earnings {
      totalEarned
      pendingEarnings
      withdrawn
      totalQueries
    }
  }
}
```

### Get Recent Queries

```graphql
{
  queries(first: 20, orderBy: timestamp, orderDirection: desc) {
    id
    consumer
    game {
      name
    }
    result {
      match {
        scheduledTime
      }
    }
    fee
    timestamp
  }
}
```

### Get Protocol Stats

```graphql
{
  protocolStats(id: "protocol") {
    totalGames
    totalMatches
    totalResults
    totalQueries
    totalRevenue
    protocolBalance
    disputerPoolBalance
  }
}
```

### Get Daily Stats (Last 7 Days)

```graphql
{
  dailyStats(first: 7, orderBy: date, orderDirection: desc) {
    date
    gamesRegistered
    matchesScheduled
    resultsSubmitted
    queriesMade
    revenue
  }
}
```

### Get Consumer Balance

```graphql
{
  consumerBalance(id: "0xCONSUMER_ADDRESS") {
    consumer
    creditAmount
    queriesUsed
    freeQueriesUsed
    bonusTier
  }
}
```

### Get Active Disputes

```graphql
{
  disputes(where: { status: Pending }, first: 10) {
    id
    game {
      name
    }
    challenger
    stakeAmount
    reason
    createdAt
  }
}
```

## 📊 Entity Schema

### Core Entities

- **Game** - Registered games
- **Match** - Scheduled matches
- **Result** - Submitted results
- **QuickField** - Quick-access result fields
- **Query** - Oracle queries
- **Dispute** - Disputes
- **GameEarnings** - Developer earnings
- **ConsumerBalance** - Consumer prepaid balances
- **ProtocolStats** - Global protocol statistics
- **DailyStats** - Daily aggregated statistics

## 🔄 Updating the Subgraph

When you update your smart contracts:

1. Update ABIs in `abis/` directory
2. Update `subgraph.yaml` if event signatures changed
3. Update mappings in `src/` if needed
4. Increment version and redeploy:

```bash
npm run codegen
npm run build
npm run deploy
```

## 🧪 Testing

Add unit tests using [Matchstick](https://github.com/LimeChain/matchstick):

```bash
# Run tests
graph test

# Watch mode
graph test -w
```

## 🐛 Debugging

View logs in The Graph Studio or locally:

```bash
# Local logs
docker logs -f docker-graph-node-1
```

Common issues:

- **"Failed to decode"**: Check ABI matches deployed contract
- **"Failed to call handler"**: Check mapping code for errors
- **"No matching datasource"**: Verify contract addresses in subgraph.yaml

## 📈 Performance Tips

1. **Use specific fields** - Don't query everything
2. **Paginate results** - Use `first` and `skip`
3. **Add indexes** - Fields used in `where` are auto-indexed
4. **Cache on frontend** - Don't query on every render

## 🔗 Resources

- [The Graph Docs](https://thegraph.com/docs/)
- [AssemblyScript Book](https://www.assemblyscript.org/)
- [Subgraph Studio](https://thegraph.com/studio/)
- [Discord Support](https://discord.gg/graphprotocol)

## 📝 License

MIT
