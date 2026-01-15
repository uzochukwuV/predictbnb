npx hardhat run scripts/deployFullStack.js --network tenderlyVirtual
[dotenv@17.2.3] injecting env (6) from .env -- tip: 🔑 add access controls to secrets: https://dotenvx.com/ops
[dotenv@17.2.3] injecting env (0) from .env -- tip: 🛠️  run anywhere with `dotenvx run -- yourcommand`
🚀 Deploying PredictBNB Full Stack (All Games + Markets)...

Deploying contracts with account: 0x8AaEe2071A400cC60927e46D53f751e521ef4D35


ASUSFX95G@DESKTOP-V1MEA7D MINGW64 ~/Documents/web3-security/predictbnb/predictbnb (main)
$ npx hardhat run scripts/deployFullStack.js --network mantleSepolia
[dotenv@17.2.3] injecting env (6) from .env -- tip: ⚙️  write to custom object with { processEnv: myObject }
[dotenv@17.2.3] injecting env (0) from .env -- tip: 📡 add observability to secrets: https://dotenvx.com/ops
🚀 Deploying PredictBNB Full Stack (All Games + Markets)...

Deploying contracts with account: 0x8AaEe2071A400cC60927e46D53f751e521ef4D35
Account balance: 4.0914820937168 BNB

📝 Deploying GameRegistry (UUPS Proxy)...
✅ GameRegistry deployed to: 0x7Cf8b09c4949aD928C938f4d147368825dF32106

🪙 Deploying PredictToken...
✅ PredictToken deployed to: 0xf88Bc787c1c74Df62cb3666DE1f209b088fc8BE9

💰 Deploying FeeManagerV2 (UUPS Proxy)...
✅ FeeManagerV2 deployed to: 0x8E7c0E4f8439988F10e0016deA08e21FEa4204d2

🔮 Deploying OracleCore (UUPS Proxy)...
✅ OracleCore deployed to: 0x8AcefAE169a8507D6Ed9A8004812929B4D3eABa9

⚖️  Deploying DisputeResolver (UUPS Proxy)...
✅ DisputeResolver deployed to: 0x42c9D8A4BE1Ca4381772DcDCC4e895FafE01aC1F

🔗 Connecting contract references...
✅ All contracts connected

💸 Funding incentive pools...
✅ Marketing budget funded: 0.001 BNB
✅ Streak reward pool funded: 0.0005 BNB

🎮 Deploying RockPaperScissors game...
✅ RockPaperScissors deployed to: 0xE8d63cc085C9748B16cDe8572C5be839a0D29e9C

📋 Registering RPS game with oracle...
✅ RPS Game registered with ID: 0x824f259fa23bca99527959b0ae66fe76384f34b186c80173d1c10493878c8c92

📊 Deploying RPSPredictionMarket...
✅ RPSPredictionMarket deployed to: 0xAE14E57e52985a34375e5049F9EA7516F4cFCe98

⚽ Deploying VirtualFootballGame...
✅ VirtualFootballGame deployed to: 0xa98881Cf79fcd8Db36C04E5E74Fe5A3999b6960a

📋 Registering VirtualFootball game with oracle...
✅ VF Game registered with ID: 0x497f72b770ca532226327b67c170ef6e65bb4612a96e5beed5b6b606aea06a39

📊 Deploying VirtualFootballMarket...
✅ VirtualFootballMarket deployed to: 0x6F9278be3791B49ae05bB565291E5728a5b739b7

📄 Deployment info saved to: C:\Users\ASUS FX95G\Documents\web3-security\predictbnb\predictbnb\deployments\deployment-fullstack-mantleSepolia-1767035662616.json

📝 Generating frontend .env.local file...
✅ Frontend .env.local created at: C:\Users\ASUS FX95G\Documents\web3-security\predictbnb\predictbnb\frontend\.env.local

================================================================================
🎉 FULL STACK DEPLOYMENT COMPLETE!
================================================================================

📦 Core Infrastructure:
-------------------
GameRegistry:        0x7Cf8b09c4949aD928C938f4d147368825dF32106
OracleCore:          0x8AcefAE169a8507D6Ed9A8004812929B4D3eABa9
FeeManagerV2:        0x8E7c0E4f8439988F10e0016deA08e21FEa4204d2
DisputeResolver:     0x42c9D8A4BE1Ca4381772DcDCC4e895FafE01aC1F
PredictToken:        0xf88Bc787c1c74Df62cb3666DE1f209b088fc8BE9

🎮 RPS Game:
-------------------
RockPaperScissors:   0xE8d63cc085C9748B16cDe8572C5be839a0D29e9C
  └─ Game ID:        0x824f259fa23bca99527959b0ae66fe76384f34b186c80173d1c10493878c8c92
RPSPredictionMarket: 0xAE14E57e52985a34375e5049F9EA7516F4cFCe98

⚽ Virtual Football:
-------------------
VirtualFootballGame: 0xa98881Cf79fcd8Db36C04E5E74Fe5A3999b6960a
  └─ Game ID:        0x497f72b770ca532226327b67c170ef6e65bb4612a96e5beed5b6b606aea06a39
VirtualFootballMarket: 0x6F9278be3791B49ae05bB565291E5728a5b739b7

⚙️  Configuration:
-------------------
Minimum Stake:       0.1 BNB
Query Fee:           0.00416 BNB
Challenge Stake:     0.2 BNB

📚 Next Steps:
-------------------

1. Export ABIs to frontend:
   npm run export-abis

2. Start automation bot for Virtual Football:
   VIRTUAL_FOOTBALL_GAME_ADDRESS=0xa98881Cf79fcd8Db36C04E5E74Fe5A3999b6960a \
   AUTO_CREATE_SEASONS=true \
   npx hardhat run scripts/automateVirtualFootball.js --network mantleSepolia

3. Start frontend development server:
   cd frontend && npm run dev

4. Test workflows:
   - RPS: Schedule match → Place bets → Play → Resolve → Claim
   - VF: Create season → Vote (FREE) → Bet on matches → Simulate → Claim

================================================================================
  