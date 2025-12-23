const fs = require('fs');
const path = require('path');

async function main() {
  const contractsToExport = [
    'RockPaperScissors',
    'RPSPredictionMarket',
    'GameRegistry',
    'OracleCore',
    'FeeManager'
  ];

  const frontendAbiDir = path.join(__dirname, '../frontend/lib/abis');

  // Create ABIs directory if it doesn't exist
  if (!fs.existsSync(frontendAbiDir)) {
    fs.mkdirSync(frontendAbiDir, { recursive: true });
  }

  for (const contractName of contractsToExport) {
    try {
      const artifactPath = path.join(
        __dirname,
        `../artifacts/contracts/${getContractPath(contractName)}.sol/${contractName}.json`
      );

      if (fs.existsSync(artifactPath)) {
        const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));

        const abiExport = {
          contractName: contractName,
          abi: artifact.abi,
          bytecode: artifact.bytecode
        };

        const outputPath = path.join(frontendAbiDir, `${contractName}.json`);
        fs.writeFileSync(outputPath, JSON.stringify(abiExport, null, 2));

        console.log(`✅ Exported ABI for ${contractName}`);
      } else {
        console.log(`⚠️  Artifact not found for ${contractName}: ${artifactPath}`);
      }
    } catch (error) {
      console.error(`❌ Error exporting ${contractName}:`, error.message);
    }
  }

  console.log('\n✨ ABI export complete!');
}

function getContractPath(contractName) {
  const pathMap = {
    'RockPaperScissors': 'games/RockPaperScissors',
    'RPSPredictionMarket': 'examples/RPSPredictionMarket',
    'GameRegistry': 'GameRegistry',
    'OracleCore': 'OracleCore',
    'FeeManager': 'FeeManager'
  };

  return pathMap[contractName] || contractName;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
