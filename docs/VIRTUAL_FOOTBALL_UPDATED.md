# Virtual Football Season Structure - Updated

## Overview
Virtual Football now implements a proper **double round-robin league** format with 20 teams.

## Season Structure

### Teams
- **Total Teams**: 20 Premier League teams
- Teams are indexed 0-19

### Rounds
- **Total Rounds**: 36 rounds per season
- **Rounds 1-18**: First leg (each team plays every other team once)
- **Rounds 19-36**: Second leg (home/away reversed)

### Matches per Round
- **10 matches per round** (20 teams ÷ 2 = 10 simultaneous matches)
- **360 total matches per season** (36 rounds × 10 matches)

## Timing Configuration

```solidity
SEASON_DURATION = 36 days      // Total season length
ROUND_INTERVAL = 1 day         // Time between rounds
MATCH_INTERVAL = 2 hours       // Stagger between matches in same round
```

### Example Timeline
- **Season Start**: Day 0, 00:00
- **Round 1**: Day 0, 01:00 - 10 matches (staggered 2 hours apart)
- **Round 2**: Day 1, 01:00 - 10 matches
- **Round 3**: Day 2, 01:00 - 10 matches
- ...
- **Round 36**: Day 35, 01:00 - 10 matches (final round)

## Match Scheduling Algorithm

Uses **round-robin algorithm** for fair fixtures:
- Team 0 stays fixed
- Other teams rotate positions
- Ensures every team plays every other team exactly twice
- Home/away swaps for second half of season (rounds 19-36)

## Workflow

### 1. Create Season
```bash
npx hardhat run scripts/createSeason.js
```
Creates a new season with UPCOMING status.

### 2. Start Season
```bash
# Manually or via automation bot
contract.startSeason(seasonId)
```
- Generates all 360 matches upfront
- Schedules all matches with oracle
- Changes season status to ACTIVE

### 3. Automation Bot Simulates Matches
The bot monitors and simulates matches as they reach their kickoff time:
- Checks every 30 seconds (configurable)
- Simulates ready matches automatically
- Updates team statistics
- Submits results to oracle

### 4. End Season
After all matches complete (36 days):
```bash
contract.endSeason(seasonId)
```
- Calculates season winner (most points)
- Changes status to COMPLETED

## Team Statistics Tracked

For each team in each season:
- Matches Played
- Wins / Draws / Losses
- Goals Scored / Goals Conceded
- Points (3 for win, 1 for draw)

## Betting Integration

Users can bet on:
- **Match outcomes**: Home win, Away win, Draw
- **Season winner**: Which team will win the league
- **Top scorer**: Highest goal-scoring team

All results are submitted to the PredictBNB oracle for verification and betting settlement.

## Gas Considerations

Generating 360 matches in one transaction is gas-intensive. For production:
- Consider chunked generation (generate rounds incrementally)
- Or use L2/sidechain deployment
- Current implementation optimized for testing with all upfront generation
