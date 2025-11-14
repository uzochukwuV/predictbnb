const hre = require("hardhat");

/**
 * Example script demonstrating batch submission for cost-effective result uploads
 * Use case: Tournament organizer submitting 20 match results in one transaction
 */
async function main() {
  console.log("🎮 Batch Submission Example\n");
  console.log("Demonstrating cost savings for tournament result uploads");
  console.log("=".repeat(80) + "\n");

  // Get deployment addresses (from latest deployment file)
  const fs = require("fs");
  const path = require("path");
  const deploymentsDir = path.join(__dirname, "..", "deployments");
  const files = fs.readdirSync(deploymentsDir).filter(f => f.startsWith("deployment-v2"));

  if (files.length === 0) {
    console.error("❌ No V2 deployment found. Please deploy first.");
    process.exit(1);
  }

  const latestDeployment = files.sort().reverse()[0];
  const deploymentInfo = JSON.parse(
    fs.readFileSync(path.join(deploymentsDir, latestDeployment), "utf8")
  );

  console.log("📄 Using deployment:", latestDeployment);
  console.log("Network:", deploymentInfo.network);
  console.log();

  // Get signers
  const [owner, tournamentOrganizer, player1, player2, player3, player4] = await hre.ethers.getSigners();

  console.log("👥 Accounts:");
  console.log("  Tournament Organizer:", tournamentOrganizer.address);
  console.log("  Players:", player1.address, player2.address, "...");
  console.log();

  // Get contract instances
  const gameRegistry = await hre.ethers.getContractAt(
    "GameRegistry",
    deploymentInfo.contracts.GameRegistry
  );

  const oracleCore = await hre.ethers.getContractAt(
    "OracleCoreV2",
    deploymentInfo.contracts.OracleCoreV2
  );

  const schemaTemplates = await hre.ethers.getContractAt(
    "SchemaTemplates",
    deploymentInfo.contracts.SchemaTemplates
  );

  console.log("=".repeat(80));
  console.log("STEP 1: Register Tournament Game");
  console.log("=".repeat(80));

  const REGISTRATION_STAKE = hre.ethers.parseEther("0.1");

  const registerTx = await gameRegistry.connect(tournamentOrganizer).registerGame(
    "fps-tournament-2025",
    "FPS Championship 2025",
    1, // FPS
    { value: REGISTRATION_STAKE }
  );
  await registerTx.wait();

  console.log("✅ Game registered: FPS Championship 2025");
  console.log("   Game ID: fps-tournament-2025");
  console.log();

  console.log("=".repeat(80));
  console.log("STEP 2: Schedule 20 Tournament Matches");
  console.log("=".repeat(80));

  const matchIds = [];
  const futureTime = Math.floor(Date.now() / 1000) + 3600;

  console.log("📅 Scheduling Round 1 (10 matches), Round 2 (8 matches), Finals (2 matches)...");

  // Schedule 20 matches
  for (let i = 0; i < 20; i++) {
    const scheduleTx = await gameRegistry.connect(tournamentOrganizer).scheduleMatch(
      "fps-tournament-2025",
      `tournament-match-${i + 1}`,
      futureTime + (i * 1800), // 30 min apart
      JSON.stringify({
        round: i < 10 ? "Round 1" : i < 18 ? "Round 2" : "Finals",
        matchNumber: (i % 10) + 1
      })
    );

    const receipt = await scheduleTx.wait();
    const event = receipt.logs.find(log => {
      try {
        return gameRegistry.interface.parseLog(log).name === "MatchScheduled";
      } catch {
        return false;
      }
    });

    matchIds.push(gameRegistry.interface.parseLog(event).args.matchId);
  }

  console.log("✅ Scheduled 20 matches");
  console.log(`   First match ID: ${matchIds[0].slice(0, 10)}...`);
  console.log(`   Last match ID:  ${matchIds[19].slice(0, 10)}...`);
  console.log();

  console.log("=".repeat(80));
  console.log("STEP 3: Simulate Tournament Completion");
  console.log("=".repeat(80));

  console.log("⏩ Fast-forwarding time (tournament is over)...");
  await hre.network.provider.send("evm_increaseTime", [12 * 3600]); // 12 hours
  await hre.network.provider.send("evm_mine");
  console.log("✅ Time advanced");
  console.log();

  console.log("=".repeat(80));
  console.log("STEP 4: Prepare Batch Result Data");
  console.log("=".repeat(80));

  const fpsSchemaId = await schemaTemplates.SCHEMA_FPS_PVP();
  console.log("Using FPS-PvP schema:", fpsSchemaId.slice(0, 10) + "...");

  // Prepare 20 match results
  const participants = [];
  const scores = [];
  const winnerIndices = [];
  const durations = [];
  const customDataArray = [];

  for (let i = 0; i < 20; i++) {
    // Simulate match participants and results
    participants.push([player1.address, player2.address]);

    // Varying scores
    const team1Score = 16;
    const team2Score = Math.floor(Math.random() * 15); // 0-14
    scores.push([team1Score, team2Score]);

    // Team 1 always wins in this example
    winnerIndices.push(0);

    // Match durations (35-45 minutes)
    durations.push(2100 + Math.floor(Math.random() * 600));

    // FPS stats for winner (varying)
    const customData = await schemaTemplates.encodeFPSData(
      15 + Math.floor(Math.random() * 10), // kills: 15-24
      5 + Math.floor(Math.random() * 5),   // deaths: 5-9
      8 + Math.floor(Math.random() * 5),   // assists: 8-12
      5 + Math.floor(Math.random() * 8),   // headshots: 5-12
      2000 + Math.floor(Math.random() * 1000), // damage: 2000-3000
      0  // MVP (player 1)
    );
    customDataArray.push(customData);
  }

  console.log("✅ Prepared data for 20 matches");
  console.log("   Participants: Team battles (2v2 format)");
  console.log("   Schema: FPS-PvP with kills, deaths, assists, headshots, damage");
  console.log("   Duration: 35-45 minutes per match");
  console.log();

  console.log("=".repeat(80));
  console.log("STEP 5: BATCH SUBMIT (Single Transaction!)");
  console.log("=".repeat(80));

  console.log("📤 Submitting 20 results in ONE transaction...");

  const batchTx = await oracleCore.connect(tournamentOrganizer).batchSubmitResultsV2(
    matchIds,
    tournamentOrganizer.address,
    participants,
    scores,
    winnerIndices,
    durations,
    fpsSchemaId,
    customDataArray
  );

  console.log("⏳ Waiting for transaction confirmation...");
  const batchReceipt = await batchTx.wait();

  const batchEvent = batchReceipt.logs.find(log => {
    try {
      return oracleCore.interface.parseLog(log).name === "BatchResultsSubmitted";
    } catch {
      return false;
    }
  });

  const parsedEvent = oracleCore.interface.parseLog(batchEvent);

  console.log("✅ BATCH SUBMISSION COMPLETE!");
  console.log();
  console.log("📊 Results:");
  console.log("   Successfully submitted: ", parsedEvent.args.successCount.toString());
  console.log("   Total attempted:        ", parsedEvent.args.totalAttempted.toString());
  console.log("   Transaction hash:       ", batchReceipt.hash);
  console.log("   Gas used:              ", batchReceipt.gasUsed.toString());
  console.log("   Gas per result:        ", (batchReceipt.gasUsed / BigInt(parsedEvent.args.successCount)).toString());
  console.log();

  console.log("=".repeat(80));
  console.log("STEP 6: Cost Comparison (Batch vs Individual)");
  console.log("=".repeat(80));

  // Estimate individual submission cost
  const individualGasEstimate = 150000n; // Approximate gas per individual submission
  const totalIndividualGas = individualGasEstimate * 20n;
  const batchGas = batchReceipt.gasUsed;
  const gasSaved = totalIndividualGas - batchGas;
  const savingsPercent = (gasSaved * 100n) / totalIndividualGas;

  console.log("Individual Submissions (estimated):");
  console.log("   Gas per submission:     ~150,000");
  console.log("   Total gas (20 txs):     ~" + totalIndividualGas.toString());
  console.log();
  console.log("Batch Submission (actual):");
  console.log("   Total gas (1 tx):       " + batchGas.toString());
  console.log();
  console.log("💰 SAVINGS:");
  console.log("   Gas saved:              " + gasSaved.toString());
  console.log("   Savings percentage:     ~" + savingsPercent.toString() + "%");
  console.log();

  // Calculate BNB savings (assuming 5 gwei gas price)
  const gasPrice = 5000000000n; // 5 gwei
  const bnbSaved = (gasSaved * gasPrice) / 10n**18n;
  console.log("   Estimated BNB saved:    ~" + bnbSaved.toString() + " BNB");
  console.log();

  console.log("=".repeat(80));
  console.log("STEP 7: Verify Results");
  console.log("=".repeat(80));

  // Query a few results to verify
  console.log("📊 Verifying sample results...");

  for (let i = 0; i < 3; i++) {
    const result = await oracleCore.getResultV2(matchIds[i]);
    console.log(`\nMatch ${i + 1}:`);
    console.log("   Participants: " + result.participants.length);
    console.log("   Winner:       Team 1 (index 0)");
    console.log("   Score:        " + result.scores[0] + "-" + result.scores[1]);
    console.log("   Duration:     " + result.duration + " seconds");
    console.log("   Schema:       " + (result.schemaId === fpsSchemaId ? "FPS-PvP ✓" : "Other"));
    console.log("   Finalized:    " + (result.isFinalized ? "Yes" : "No (in dispute window)"));

    // Decode custom data
    const decoded = hre.ethers.AbiCoder.defaultAbiCoder().decode(
      ["uint256", "uint256", "uint256", "uint256", "uint256", "uint8"],
      result.customData
    );

    console.log("   FPS Stats:");
    console.log("     Kills:      " + decoded[0]);
    console.log("     Deaths:     " + decoded[1]);
    console.log("     Assists:    " + decoded[2]);
    console.log("     Headshots:  " + decoded[3]);
  }

  console.log();

  console.log("=".repeat(80));
  console.log("STEP 8: Wait and Batch Finalize");
  console.log("=".repeat(80));

  console.log("⏩ Fast-forwarding past 15-min dispute window...");
  await hre.network.provider.send("evm_increaseTime", [16 * 60]);
  await hre.network.provider.send("evm_mine");
  console.log("✅ Dispute window passed");
  console.log();

  console.log("📤 Batch finalizing all 20 results...");
  const finalizeTx = await oracleCore.batchFinalizeResults(matchIds);
  const finalizeReceipt = await finalizeTx.wait();

  const finalizeEvent = finalizeReceipt.logs.find(log => {
    try {
      return oracleCore.interface.parseLog(log).name === "BatchResultsFinalized";
    } catch {
      return false;
    }
  });

  const finalizedCount = oracleCore.interface.parseLog(finalizeEvent).args.successCount;

  console.log("✅ BATCH FINALIZATION COMPLETE!");
  console.log("   Finalized:    " + finalizedCount.toString() + " results");
  console.log("   Gas used:     " + finalizeReceipt.gasUsed.toString());
  console.log("   Gas per result: " + (finalizeReceipt.gasUsed / finalizedCount).toString());
  console.log();

  console.log("=".repeat(80));
  console.log("✅ DEMO COMPLETE!");
  console.log("=".repeat(80));

  console.log("\n💡 Key Takeaways:");
  console.log("   ✓ 20 tournament results submitted in 1 transaction");
  console.log("   ✓ ~" + savingsPercent.toString() + "% gas savings vs individual submissions");
  console.log("   ✓ Rich FPS data (kills, deaths, assists, headshots) for each match");
  console.log("   ✓ Batch finalization saves even more gas");
  console.log("   ✓ Perfect for tournaments, daily batches, and bulk uploads");

  console.log("\n📊 Use Cases:");
  console.log("   • Tournament organizers (submit all brackets at once)");
  console.log("   • Daily batch uploads (accumulate results, submit once)");
  console.log("   • Historical data migration (bulk upload past matches)");
  console.log("   • High-volume games (reduce per-match cost)");

  console.log("\n" + "=".repeat(80) + "\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
