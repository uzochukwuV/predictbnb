@echo off
echo 🚀 PredictBNB Subgraph Setup Script
echo ====================================

if not exist "..\artifacts\contracts" (
    echo ❌ Error: Contract artifacts not found. Please compile contracts first:
    echo    npx hardhat compile
    exit /b 1
)

if not exist "abis" mkdir abis

echo 📦 Copying contract ABIs...
copy "..\artifacts\contracts\GameRegistry.sol\GameRegistry.json" "abis\" >nul
copy "..\artifacts\contracts\OracleCore.sol\OracleCore.json" "abis\" >nul
copy "..\artifacts\contracts\FeeManager.sol\FeeManager.json" "abis\" >nul
copy "..\artifacts\contracts\DisputeResolver.sol\DisputeResolver.json" "abis\" >nul

echo ✅ ABIs copied successfully
echo.
echo 📥 Installing dependencies...
call npm install

echo.
echo ✅ Setup complete!
echo.
echo 📝 Next steps:
echo 1. Deploy your contracts to BSC (testnet or mainnet)
echo 2. Update subgraph.yaml with deployed contract addresses
echo 3. Create a subgraph on The Graph Studio: https://thegraph.com/studio/
echo 4. Authenticate: graph auth --studio YOUR_DEPLOY_KEY
echo 5. Deploy: npm run codegen ^&^& npm run build ^&^& npm run deploy
echo.
echo 📚 See README.md for detailed instructions
