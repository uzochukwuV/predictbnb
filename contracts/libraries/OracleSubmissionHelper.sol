// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

/**
 * @title OracleSubmissionHelper
 * @notice Helper library to make result submission easier for game developers
 * @dev Provides common encoding patterns and quick field helpers
 */
library OracleSubmissionHelper {
    // ============ Common Field Hashes ============

    bytes32 public constant WINNER_FIELD = keccak256("winner");
    bytes32 public constant SCORE1_FIELD = keccak256("score1");
    bytes32 public constant SCORE2_FIELD = keccak256("score2");
    bytes32 public constant KILLS_FIELD = keccak256("kills");
    bytes32 public constant DEATHS_FIELD = keccak256("deaths");
    bytes32 public constant ASSISTS_FIELD = keccak256("assists");
    bytes32 public constant MVP_FIELD = keccak256("mvp");
    bytes32 public constant DURATION_FIELD = keccak256("duration");
    bytes32 public constant TEAM1_FIELD = keccak256("team1");
    bytes32 public constant TEAM2_FIELD = keccak256("team2");

    // ============ Common Decode Schemas ============

    string public constant SIMPLE_SCHEMA = "simple";
    string public constant WINNER_SCORE_SCHEMA = "(address winner, uint256 score1, uint256 score2)";
    string public constant FPS_SCHEMA = "(address winner, uint256 kills, uint256 deaths, uint256 assists)";
    string public constant MOBA_SCHEMA = "(address winner, uint256 kills, uint256 deaths, uint256 assists, uint256 gold, uint256 damage)";

    // ============ Encoding Functions ============

    /**
     * @notice Encode simple winner + scores result
     * @param winner Address of the winner
     * @param score1 Score of player/team 1
     * @param score2 Score of player/team 2
     */
    function encodeSimpleResult(
        address winner,
        uint256 score1,
        uint256 score2
    ) internal pure returns (
        bytes memory encodedData,
        string memory decodeSchema,
        bytes32[] memory keys,
        bytes32[] memory values
    ) {
        // Encode data
        encodedData = abi.encode(winner, score1, score2);
        decodeSchema = WINNER_SCORE_SCHEMA;

        // Quick fields
        keys = new bytes32[](3);
        values = new bytes32[](3);

        keys[0] = WINNER_FIELD;
        values[0] = bytes32(uint256(uint160(winner)));

        keys[1] = SCORE1_FIELD;
        values[1] = bytes32(score1);

        keys[2] = SCORE2_FIELD;
        values[2] = bytes32(score2);
    }

    /**
     * @notice Encode FPS game result
     * @param winner Address of the winner
     * @param kills Total kills
     * @param deaths Total deaths
     * @param assists Total assists
     */
    function encodeFPSResult(
        address winner,
        uint256 kills,
        uint256 deaths,
        uint256 assists
    ) internal pure returns (
        bytes memory encodedData,
        string memory decodeSchema,
        bytes32[] memory keys,
        bytes32[] memory values
    ) {
        // Encode data
        encodedData = abi.encode(winner, kills, deaths, assists);
        decodeSchema = FPS_SCHEMA;

        // Quick fields
        keys = new bytes32[](4);
        values = new bytes32[](4);

        keys[0] = WINNER_FIELD;
        values[0] = bytes32(uint256(uint160(winner)));

        keys[1] = KILLS_FIELD;
        values[1] = bytes32(kills);

        keys[2] = DEATHS_FIELD;
        values[2] = bytes32(deaths);

        keys[3] = ASSISTS_FIELD;
        values[3] = bytes32(assists);
    }

    /**
     * @notice Encode MOBA game result
     * @param winner Address of the winning team
     * @param kills Total kills
     * @param deaths Total deaths
     * @param assists Total assists
     * @param gold Total gold earned
     * @param damage Total damage dealt
     */
    function encodeMOBAResult(
        address winner,
        uint256 kills,
        uint256 deaths,
        uint256 assists,
        uint256 gold,
        uint256 damage
    ) internal pure returns (
        bytes memory encodedData,
        string memory decodeSchema,
        bytes32[] memory keys,
        bytes32[] memory values
    ) {
        // Encode data
        encodedData = abi.encode(winner, kills, deaths, assists, gold, damage);
        decodeSchema = MOBA_SCHEMA;

        // Quick fields
        keys = new bytes32[](4); // Only most commonly queried fields
        values = new bytes32[](4);

        keys[0] = WINNER_FIELD;
        values[0] = bytes32(uint256(uint160(winner)));

        keys[1] = KILLS_FIELD;
        values[1] = bytes32(kills);

        keys[2] = DEATHS_FIELD;
        values[2] = bytes32(deaths);

        keys[3] = ASSISTS_FIELD;
        values[3] = bytes32(assists);
    }

    // ============ Decoding Functions ============

    /**
     * @notice Decode simple winner + scores result
     * @param encodedData The encoded data
     */
    function decodeSimpleResult(bytes memory encodedData)
        internal
        pure
        returns (address winner, uint256 score1, uint256 score2)
    {
        (winner, score1, score2) = abi.decode(encodedData, (address, uint256, uint256));
    }

    /**
     * @notice Decode FPS game result
     * @param encodedData The encoded data
     */
    function decodeFPSResult(bytes memory encodedData)
        internal
        pure
        returns (address winner, uint256 kills, uint256 deaths, uint256 assists)
    {
        (winner, kills, deaths, assists) = abi.decode(
            encodedData,
            (address, uint256, uint256, uint256)
        );
    }

    /**
     * @notice Decode MOBA game result
     * @param encodedData The encoded data
     */
    function decodeMOBAResult(bytes memory encodedData)
        internal
        pure
        returns (
            address winner,
            uint256 kills,
            uint256 deaths,
            uint256 assists,
            uint256 gold,
            uint256 damage
        )
    {
        (winner, kills, deaths, assists, gold, damage) = abi.decode(
            encodedData,
            (address, uint256, uint256, uint256, uint256, uint256)
        );
    }

    // ============ Field Hash Helpers ============

    /**
     * @notice Generate field hash from string
     * @param fieldName The field name
     */
    function getFieldHash(string memory fieldName) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(fieldName));
    }

    /**
     * @notice Convert address to bytes32 for quick field storage
     * @param addr The address to convert
     */
    function addressToBytes32(address addr) internal pure returns (bytes32) {
        return bytes32(uint256(uint160(addr)));
    }

    /**
     * @notice Convert bytes32 to address for quick field retrieval
     * @param b The bytes32 value
     */
    function bytes32ToAddress(bytes32 b) internal pure returns (address) {
        return address(uint160(uint256(b)));
    }

    /**
     * @notice Convert uint256 to bytes32 for quick field storage
     * @param value The uint256 value
     */
    function uint256ToBytes32(uint256 value) internal pure returns (bytes32) {
        return bytes32(value);
    }

    /**
     * @notice Convert bytes32 to uint256 for quick field retrieval
     * @param b The bytes32 value
     */
    function bytes32ToUint256(bytes32 b) internal pure returns (uint256) {
        return uint256(b);
    }

    // ============ Validation Helpers ============

    /**
     * @notice Validate that arrays have matching lengths
     * @param keys Array of keys
     * @param values Array of values
     */
    function validateArrays(bytes32[] memory keys, bytes32[] memory values)
        internal
        pure
        returns (bool)
    {
        return keys.length == values.length;
    }

    /**
     * @notice Validate that score is reasonable (not overflow)
     * @param score The score to validate
     * @param maxScore Maximum allowed score
     */
    function validateScore(uint256 score, uint256 maxScore)
        internal
        pure
        returns (bool)
    {
        return score <= maxScore;
    }

    /**
     * @notice Validate that timestamp is in the past
     * @param timestamp The timestamp to validate
     */
    function validatePastTimestamp(uint256 timestamp) internal view returns (bool) {
        return timestamp < block.timestamp;
    }
}
