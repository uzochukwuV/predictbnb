#!/bin/bash

echo "🚀 PredictBNB Subgraph Setup Script"
echo "===================================="

# Check if contract artifacts exist
if [ ! -d "../artifacts/contracts" ]; then
    echo "❌ Error: Contract artifacts not found. Please compile contracts first:"
    echo "   npx hardhat compile"
    exit 1
fi

# Create abis directory
mkdir -p abis

# Copy ABIs
echo "📦 Copying contract ABIs..."
cp ../artifacts/contracts/GameRegistry.sol/GameRegistry.json abis/
cp ../artifacts/contracts/OracleCore.sol/OracleCore.json abis/
cp ../artifacts/contracts/FeeManager.sol/FeeManager.json abis/
cp ../artifacts/contracts/DisputeResolver.sol/DisputeResolver.json abis/

echo "✅ ABIs copied successfully"

# Install dependencies
echo ""
echo "📥 Installing dependencies..."
npm install

echo ""
echo "✅ Setup complete!"
echo ""
echo "📝 Next steps:"
echo "1. Deploy your contracts to BSC (testnet or mainnet)"
echo "2. Update subgraph.yaml with deployed contract addresses"
echo "3. Create a subgraph on The Graph Studio: https://thegraph.com/studio/"
echo "4. Authenticate: graph auth --studio YOUR_DEPLOY_KEY"
echo "5. Deploy: npm run codegen && npm run build && npm run deploy"
echo ""
echo "📚 See README.md for detailed instructions"
