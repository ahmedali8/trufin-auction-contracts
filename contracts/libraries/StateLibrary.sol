// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

// LIBRARIES
import { Errors } from "./Errors.sol";
import { AddressLibrary } from "./AddressLibrary.sol";
import { MultiHashLibrary } from "./MultiHashLibrary.sol";
import { MerkleRootLibrary } from "./MerkleRootLibrary.sol";
import { Constants } from "./Constants.sol";
import { MerkleProof } from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import { MultiHashLibrary } from "./MultiHashLibrary.sol";

// INTERFACES
import { IAuction } from "../interfaces/IAuction.sol";

// DATA TYPES
import { State, Status, Bid } from "../types/DataTypes.sol";

/// @title StateLibrary
/// @notice Manages state-related operations for an auction contract, ensuring security and
/// correctness.
/// @dev Implements various functions for handling auction state transitions, bid placements, and
/// verification.
library StateLibrary {
    using StateLibrary for State;
    using AddressLibrary for address;
    using MultiHashLibrary for bytes32;
    using MerkleRootLibrary for bytes32;

    /// @notice Initializes and starts an auction.
    /// @dev Ensures valid parameters and sets the auction as ACTIVE.
    /// @param self The state of the auction.
    /// @param params The auction parameters, including token address, total tokens, start time, and
    /// end time.
    function startAuction(State storage self, IAuction.StartAuctionParams memory params) internal {
        if (!self.token.isAddressZero()) {
            revert Errors.AuctionExists();
        }

        // Ensure token address is valid
        params.token.checkAddressZero();

        if (params.totalTokens == 0) {
            revert Errors.ZeroTotalTokens();
        }

        // Ensure start and end time are valid
        if (params.startTime < block.timestamp || params.endTime <= params.startTime) {
            revert Errors.InvalidAuctionTimeParams(params.startTime, params.endTime);
        }

        // Set auction parameters
        self.status = Status.ACTIVE;
        self.token = params.token;
        self.totalTokens = params.totalTokens;
        self.startTime = params.startTime;
        self.endTime = params.endTime;
    }

    /// @notice Places a bid in the auction.
    /// @dev Ensures that bidding conditions are met before storing the bid.
    /// @param self The state of the auction.
    /// @param bids The mapping of bid IDs to bids.
    /// @param nextBidId The next available bid ID.
    /// @param bidder The address of the bidder.
    /// @param quantity The amount of tokens the bidder wants to buy.
    /// @param pricePerToken The price per token in ETH.
    function placeBid(
        State storage self,
        mapping(uint256 => Bid) storage bids,
        uint256 nextBidId,
        address bidder,
        uint128 quantity,
        uint128 pricePerToken
    )
        internal
    {
        self._checkAuctionHasStarted();
        self._checkAuctionHasEnded();
        self._checkStatus({ expected: Status.ACTIVE });

        bidder.checkAddressZero();

        if (quantity == 0) {
            revert Errors.InvalidBidQuantity();
        }

        if (pricePerToken < Constants.MIN_BID_PRICE_PER_TOKEN) {
            revert Errors.InvalidPricePerToken();
        }

        // Store the bid
        bids[nextBidId] = Bid({ bidder: bidder, quantity: quantity, pricePerToken: pricePerToken });
    }

    /// @notice Submits Merkle data after the auction ends.
    /// @dev Ensures the auction is in a valid state and only allows one submission.
    /// @param self The state of the auction.
    /// @param params The Merkle data parameters.
    function submitMerkleData(
        State storage self,
        IAuction.MerkleDataParams memory params
    )
        internal
    {
        self._checkAuctionHasStarted();
        self._checkAuctionIsOngoing();
        self.token.checkAddressZero();
        self._checkStatus({ expected: Status.ACTIVE });

        if (!params.merkleRoot.isMerkleRootValid()) {
            revert Errors.InvalidMerkleRoot(params.merkleRoot);
        }

        if (!params.digest.isMultiHashValid(params.hashFunction, params.size)) {
            revert Errors.InvalidMultiHash(params.digest, params.hashFunction, params.size);
        }

        if (self.merkleRoot.isMerkleRootValid()) {
            revert Errors.CanOnlySubmitOnce();
        }

        // Update state
        self.merkleRoot = params.merkleRoot;
        self.digest = params.digest;
        self.hashFunction = params.hashFunction;
        self.size = params.size;
        self.verificationDeadline = uint40(block.timestamp + Constants.VERIFICATION_WINDOW);
        self.status = Status.MERKLE_SUBMITTED;
    }

    /// @notice Ends the auction and transitions to the final state.
    /// @dev Ensures the verification period has passed before ending the auction.
    /// @param self The state of the auction.
    function endAuction(State storage self) internal {
        self._checkStatus({ expected: Status.MERKLE_SUBMITTED });

        if (block.timestamp <= self.verificationDeadline) {
            revert Errors.VerificationPeriodNotOver();
        }

        // Mark auction as ended
        self.status = Status.ENDED;
    }

    /// @notice Allows a winning bidder to claim tokens or a non-winning bidder to claim a refund.
    /// @dev Verifies the bid's validity using the Merkle proof.
    /// @param self The state of the auction.
    /// @param bids The mapping of bid IDs to bids.
    /// @param params The claim parameters.
    /// @param currentBid The bid details for the claimant.
    /// @param caller The address calling the function.
    function claim(
        State storage self,
        mapping(uint256 => Bid) storage bids,
        IAuction.ClaimParams memory params,
        Bid memory currentBid,
        address caller
    )
        internal
    {
        self._checkStatus({ expected: Status.ENDED });

        if (currentBid.bidder != caller) {
            revert Errors.BidDoesNotExist();
        }

        // Verify the Merkle proof to prevent false claims
        bytes32 _leaf = keccak256(bytes.concat(keccak256(abi.encode(caller, params.quantity))));
        if (!MerkleProof.verify(params.proof, self.merkleRoot, _leaf)) {
            revert Errors.InvalidMerkleProof(params.proof);
        }

        // Remove the bid from storage after successful validation
        delete bids[params.bidId];
    }

    /// @notice Slashes the auctioneer in case of fraud and rewards the verifier.
    /// @dev Ensures slashing happens within the verification window.
    /// @param self The state of the auction.
    /// @param params The Merkle data used for verification.
    function slash(State storage self, IAuction.MerkleDataParams memory params) internal {
        self._checkStatus({ expected: Status.MERKLE_SUBMITTED });

        // Ensure new Merkle root is different and valid
        if (!params.merkleRoot.isMerkleRootValid() || params.merkleRoot == self.merkleRoot) {
            revert Errors.InvalidMerkleRoot(params.merkleRoot);
        }

        // Ensure the new IPFS hash (digest) is different and valid
        if (
            !MultiHashLibrary.isMultiHashValid(params.digest, params.hashFunction, params.size)
                || (
                    self.digest == params.digest && self.hashFunction == params.hashFunction
                        && self.size == params.size
                )
        ) {
            revert Errors.InvalidMultiHash(params.digest, params.hashFunction, params.size);
        }

        // Ensure slashing happens within the verification window
        if (block.timestamp > self.verificationDeadline) {
            revert Errors.VerificationWindowExpired();
        }

        // Apply new values
        self.merkleRoot = params.merkleRoot;
        self.digest = params.digest;
        self.hashFunction = params.hashFunction;
        self.size = params.size;
        self.isOwnerSlashed = true;
    }

    /// Enum-Based Auction Checks ///

    /// @notice Ensures the auction is in a specific state before proceeding.
    /// @param self The state of the auction.
    /// @param expected The expected status.
    function _checkStatus(State storage self, Status expected) internal view {
        if (self.status != expected) {
            revert Errors.InvalidAuctionStatus(expected, self.status);
        }
    }

    /// Time-Based Auction Checks ///

    /// @notice Ensures the auction has started.
    /// @param self The state of the auction.
    function _checkAuctionHasStarted(State storage self) internal view {
        if (block.timestamp < self.startTime) {
            revert Errors.InvalidAuctionStatus(Status.INACTIVE, Status.ACTIVE);
        }
    }

    /// @notice Ensures the auction is ongoing.
    /// @param self The state of the auction.
    function _checkAuctionIsOngoing(State storage self) internal view {
        if (block.timestamp <= self.endTime) {
            revert Errors.InvalidAuctionStatus(Status.ACTIVE, Status.MERKLE_SUBMITTED);
        }
    }

    /// @notice Ensures the auction has ended.
    /// @param self The state of the auction.
    function _checkAuctionHasEnded(State storage self) internal view {
        if (block.timestamp > self.endTime) {
            revert Errors.InvalidAuctionStatus(Status.ACTIVE, Status.ENDED);
        }
    }
}
