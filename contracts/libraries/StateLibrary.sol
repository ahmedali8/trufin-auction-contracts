// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import { State, Status, Bid } from "../types/DataTypes.sol";
import { Errors } from "./Errors.sol";
import { AddressLibrary } from "./AddressLibrary.sol";
import { MultiHashLibrary } from "./MultiHashLibrary.sol";
import { MerkleRootLibrary } from "./MerkleRootLibrary.sol";
import { IAuction } from "../interfaces/IAuction.sol";
import { Constants } from "./Constants.sol";
import { MerkleProof } from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import { MultiHashLibrary } from "./MultiHashLibrary.sol";
import { console } from "hardhat/console.sol";

library StateLibrary {
    using StateLibrary for State;
    using AddressLibrary for address;
    using MultiHashLibrary for bytes32;
    using MerkleRootLibrary for bytes32;

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
        self._checkStatus({ expected: Status.ACTIVE });

        bidder.checkAddressZero();
        if (quantity == 0) revert Errors.InvalidBidQuantity();
        if (pricePerToken < Constants.MIN_BID_PRICE_PER_TOKEN) revert Errors.InvalidPricePerToken();

        // Store the bid
        bids[nextBidId] = Bid({ bidder: bidder, quantity: quantity, pricePerToken: pricePerToken });
    }

    function submitMerkleData(
        State storage self,
        IAuction.MerkleDataParams memory params
    )
        internal
    {
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

    function endAuction(State storage self) internal {
        self._checkStatus({ expected: Status.MERKLE_SUBMITTED });

        if (block.timestamp <= self.verificationDeadline) {
            revert Errors.VerificationPeriodNotOver();
        }

        // Mark auction as ended
        self.status = Status.ENDED;
    }

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

    function _checkStatus(State storage self, Status expected) internal view {
        if (self.status != expected) {
            revert Errors.InvalidAuctionStatus(expected, self.status);
        }
    }

    /// Time-Based Auction Checks ///

    function _checkAuctionTime(State storage self) internal view {
        if (block.timestamp < self.startTime) {
            revert Errors.InvalidAuctionStatus(Status.INACTIVE, Status.ACTIVE);
        }
        if (block.timestamp > self.endTime) {
            revert Errors.InvalidAuctionStatus(Status.ACTIVE, Status.ENDED);
        }
    }

    // // removed
    // function _checkAuctionStatusNotEnded(State storage self) internal view {
    //     if (self.status == Status.ENDED) {
    //         revert Errors.AuctionAlreadyEnded();
    //     }
    // }

    // // removed
    // function _checkAuctionStatusEnded(State storage self) internal view {
    //     if (self.status != Status.ACTIVE) {
    //         revert Errors.AuctionInActive();
    //     }
    // }

    // // removed
    // function _checkAuctionIsInActive(State storage self) internal view {
    //     if (block.timestamp <= self.endTime) {
    //         revert Errors.AuctionActive();
    //     }
    // }

    // // removed
    // function _checkAuctionIsMerkleSubmitted(State storage self) internal view {
    //     if (self.status != Status.MERKLE_SUBMITTED) {
    //         revert Errors.InvalidAuctionState(
    //             Errors.StatusCheck.MerkleSubmitted, Errors.StatusCheck.Active
    //         );
    //     }
    // }
}
