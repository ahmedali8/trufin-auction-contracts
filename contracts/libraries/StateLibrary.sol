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
        if (!self.token.isAddressZero()) revert Errors.AuctionAlreadyExists();

        // Ensure token address is valid
        params.token.checkAddressZero();

        if (params.totalTokens == 0) revert Errors.InvalidTotalTokens();

        // Ensure start and end time are valid
        if (params.startTime < block.timestamp || params.endTime <= params.startTime) {
            revert Errors.InvalidAuctionTime();
        }

        // Set auction parameters
        self.status = Status.STARTED;
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
        if (self.status != Status.STARTED) revert Errors.AuctionNotActive();
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
        if (self.status != Status.STARTED) {
            revert Errors.AuctionNotActive();
        }

        if (!params.merkleRoot.isMerkleRootValid()) {
            revert Errors.InvalidMerkleRoot();
        }

        if (!params.digest.isMultiHashValid(params.hashFunction, params.size)) {
            revert Errors.InvalidMultiHash();
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
        if (self.status != Status.MERKLE_SUBMITTED) {
            revert Errors.InvalidAuctionStatus();
        }

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
        if (self.status != Status.ENDED) {
            revert Errors.AuctionNotFinalized();
        }

        if (currentBid.bidder != caller) {
            revert Errors.BidDoesNotExist();
        }

        // Verify the Merkle proof to prevent false claims
        bytes32 _leaf = keccak256(bytes.concat(keccak256(abi.encode(caller, params.quantity))));
        if (!MerkleProof.verify(params.proof, self.merkleRoot, _leaf)) {
            revert Errors.InvalidProof();
        }

        // Remove the bid from storage after successful validation
        delete bids[params.bidId];
    }

    function slash(State storage self, IAuction.MerkleDataParams memory params) internal {
        // Validate auction status
        if (self.status != Status.MERKLE_SUBMITTED) {
            revert Errors.InvalidAuctionStatus();
        }

        // Ensure new Merkle root is different and valid
        if (!params.merkleRoot.isMerkleRootValid() || params.merkleRoot == self.merkleRoot) {
            revert Errors.InvalidMerkleRoot();
        }

        // Ensure the new IPFS hash (digest) is different and valid
        if (
            !MultiHashLibrary.isMultiHashValid(params.digest, params.hashFunction, params.size)
                || (
                    self.digest == params.digest && self.hashFunction == params.hashFunction
                        && self.size == params.size
                )
        ) {
            revert Errors.InvalidMultiHash();
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
}
