// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.26;

/// @title IAuction
/// @notice Interface defining the core functionality of an auction contract.
/// @dev This interface should be implemented by the `Auction` contract to enable interaction with
/// external contracts.
interface IAuction {
    /// @notice Struct containing Merkle data for the auction settlement.
    /// @dev Used to verify winning bids and ensure correctness.
    /// @param merkleRoot The root hash of the Merkle tree used for verification.
    /// @param digest The digest of the IPFS MultiHash.
    /// @param hashFunction The hash function identifier used in IPFS MultiHash.
    /// @param size The size of the hash output.
    struct MerkleDataParams {
        bytes32 merkleRoot;
        // MultiHash
        bytes32 digest;
        uint8 hashFunction;
        uint8 size;
    }

    /// @notice Struct defining the parameters required to start an auction.
    /// @dev Used in the `startAuction` function to initialize the auction.
    /// @param totalTokens The total number of tokens available for the auction.
    /// @param startTime The timestamp at which the auction starts.
    /// @param endTime The timestamp at which the auction ends.
    /// @param token The address of the ERC-20 token being auctioned.
    struct StartAuctionParams {
        uint128 totalTokens;
        uint40 startTime;
        uint40 endTime;
        address token;
    }

    /// @notice Struct defining the parameters for a bid claim.
    /// @dev Used to validate bid claims against the Merkle tree.
    /// @param bidId The unique identifier of the bid.
    /// @param quantity The quantity of tokens won in the auction.
    /// @param proof The Merkle proof verifying the claim.
    struct ClaimParams {
        uint256 bidId;
        uint128 quantity;
        bytes32[] proof;
    }

    /// @notice Event emitted when an auction is started.
    event AuctionStarted(address token, uint128 totalTokens, uint40 startTime, uint40 endTime);

    /// @notice Event emitted when a bid is placed.
    event BidPlaced(uint256 indexed bidId, address bidder, uint128 quantity, uint128 pricePerToken);

    /// @notice Event emitted when Merkle root data is submitted.
    event MerkleRootSubmitted(bytes32 merkleRoot, bytes32 digest, uint8 hashFunction, uint8 size);

    /// @notice Event emitted when the auction is successfully ended.
    event AuctionEnded(address caller);

    /// @notice Event emitted when a winning bidder claims tokens.
    event TokensClaimed(address bidder, uint256 quantity);

    /// @notice Event emitted when a non-winning bidder claims a refund.
    event ETHClaimed(address bidder, uint256 amount);

    /// @notice Event emitted when the Merkle root is updated during a slashing event.
    event MerkleRootUpdated(bytes32 merkleRoot, bytes32 digest, uint8 hashFunction, uint8 size);

    /// @notice Event emitted when the auctioneer is penalized for misconduct.
    event AuctioneerPenalized(uint256 penaltyAmount);

    /// @notice Event emitted when a new verifier is set.
    event VerifierSet(address verifier);

    /// @notice Starts an auction with the specified parameters.
    /// @dev Callable only by the owner and requires an ETH security deposit.
    /// @param params The struct containing auction initialization parameters.
    /// @custom:requirements
    /// - `msg.sender` must be the auction owner.
    /// - `msg.value` must be equal to the required security deposit.
    /// - `params.startTime` must be in the future.
    /// - `params.endTime` must be greater than `params.startTime`.
    /// - `params.totalTokens` must be greater than zero.
    function startAuction(StartAuctionParams calldata params) external payable;

    /// @notice Places a bid on the auction.
    /// @dev Requires ETH payment equal to `quantity * pricePerToken`.
    /// @param quantity The number of tokens the bidder wants to buy.
    /// @param pricePerToken The price per token in ETH.
    /// @custom:requirements
    /// - `msg.sender` must not be the auction owner.
    /// - `msg.value` must equal `quantity * pricePerToken`.
    /// - The auction must be active (`Status.ACTIVE`).
    /// - `quantity` must be greater than zero.
    function placeBid(uint128 quantity, uint128 pricePerToken) external payable;

    /// @notice Submits the Merkle root data after the auction ends.
    /// @dev This function finalizes the auction results for verification.
    /// @param params The struct containing Merkle root data.
    /// @custom:requirements
    /// - `msg.sender` must be the auction owner.
    /// - The auction must have ended.
    /// - The Merkle root must not have been previously submitted.
    function submitMerkleData(MerkleDataParams calldata params) external;

    /// @notice Ends the auction and allows bidders to claim tokens or refunds.
    /// @dev Can be called by anyone after the verification period ends.
    /// @custom:requirements
    /// - The auction must have already ended.
    /// - The verification period must have expired.
    function endAuction() external;

    /// @notice Claims tokens for winning bidders or refunds for non-winning bidders.
    /// @dev Requires proof of winning status via Merkle proof.
    /// @param params The struct containing bid claim data.
    /// @custom:requirements
    /// - `msg.sender` must have placed a valid bid.
    /// - The Merkle proof must be valid.
    /// - The auction must be in `Status.ENDED`.
    function claim(ClaimParams calldata params) external;

    /// @notice Allows the verifier to slash the auctioneer if fraud is detected.
    /// @dev Updates the Merkle root and penalizes the auction owner.
    /// @param params The struct containing new Merkle root data.
    /// @custom:requirements
    /// - `msg.sender` must be the verifier.
    /// - The auction must be in `Status.MERKLE_SUBMITTED`.
    /// - The new Merkle root must differ from the previous root.
    /// - The verification window must not have expired.
    function slash(MerkleDataParams calldata params) external;

    /// @notice Computes the ETH price for a bid based on quantity and price per token.
    /// @dev Uses uint256 to prevent overflow before casting to uint128.
    /// @param quantity The number of tokens being bid for.
    /// @param pricePerToken The price per token in ETH.
    /// @return price The total price in ETH.
    function getBidPrice(
        uint128 quantity,
        uint128 pricePerToken
    )
        external
        pure
        returns (uint128 price);
}
