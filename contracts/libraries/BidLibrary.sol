// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.26;

import { State, Status, Bid } from "../types/DataTypes.sol";
import { Errors } from "./Errors.sol";
import { Constants } from "./Constants.sol";

/// @title BidLibrary
/// @notice Optimized bid insertion using a sorted doubly linked list
/// @dev This library reduces gas costs by minimizing storage reads/writes
library BidLibrary {
    using BidLibrary for State;

    function placeBid(
        State storage self,
        mapping(address => Bid) storage bids,
        address bidder,
        uint128 quantity,
        uint128 pricePerToken
    )
        internal
    {
        if (quantity == 0) {
            revert Errors.InvalidBidQuantity();
        }

        if (pricePerToken < Constants.MIN_BID_PRICE_PER_TOKEN) {
            revert Errors.InvalidPricePerToken();
        }

        if (getBidPrice(quantity, pricePerToken) != msg.value) {
            revert Errors.InvalidBidPrice();
        }

        if (self.status != Status.STARTED || uint40(block.timestamp) >= self.endTime) {
            revert Errors.AuctionEnded();
        }

        if (bids[bidder].quantity != 0) {
            revert Errors.BidAlreadyPlaced();
        }

        bids[bidder] = Bid({
            quantity: quantity,
            pricePerToken: pricePerToken,
            bidder: bidder,
            timestamp: uint40(block.timestamp),
            filled: false,
            prev: address(0),
            next: address(0)
        });

        insertBid(self, bids, bidder, quantity, pricePerToken);
        self.totalBidCount++;
    }

    /// @dev Inserts a bid into the sorted doubly linked list based on auction rules.
    /// @param self The auction state containing the linked list
    /// @param bids Mapping of bidders to their bid information
    /// @param bidder The address of the bidder placing the bid
    function insertBid(
        State storage self,
        mapping(address => Bid) storage bids,
        address bidder,
        uint128 quantity,
        uint128 pricePerToken
    )
        internal
    {
        bids[bidder] = Bid({
            quantity: quantity,
            pricePerToken: pricePerToken,
            bidder: bidder,
            timestamp: uint40(block.timestamp),
            filled: false,
            prev: address(0),
            next: address(0)
        });

        Bid storage newBid = bids[bidder]; // SSTORE: Create a new bid

        // If the auction has no bids yet, set this bid as the first and last
        if (self.topBidder == address(0)) {
            self.topBidder = bidder; // SSTORE: Set first top bidder
            self.lastBidder = bidder; // SSTORE: Set first last bidder
            return;
        }

        address _current = self.topBidder; // SLOAD: Start at the top bidder
        address _previous = address(0); // In-memory variable

        // Fetch new bid values `into memory` to avoid multiple storage reads
        uint128 _newPrice = newBid.pricePerToken;
        uint128 _newQuantity = newBid.quantity;

        // Traverse to find correct position (sorted order)
        while (_current != address(0)) {
            Bid storage currentBid = bids[_current]; // SLOAD: Load bid details

            // Compare and find insertion point //

            // Higher price -> higher priority
            if (_newPrice > currentBid.pricePerToken) break;

            // Same price, more quantity -> higher priority
            if (_newPrice == currentBid.pricePerToken && _newQuantity > currentBid.quantity) break;

            // FIFO (Tie) logic
            if (
                _newPrice == currentBid.pricePerToken && _newQuantity == currentBid.quantity
                    && newBid.timestamp < currentBid.timestamp
            ) break;

            // Move to next bid
            _previous = _current;
            _current = currentBid.next; // SLOAD: Fetch next bid
        }

        // SSTORE: Update bid pointers in the linked list
        newBid.next = _current;
        newBid.prev = _previous;

        if (_previous == address(0)) {
            // Case 1: Insert `at the top`
            newBid.next = self.topBidder; // Link new bid to the old top
            bids[self.topBidder].prev = bidder; // Update old top bid’s `prev`
            self.topBidder = bidder; // Update highest-priority bid
        } else {
            // Case 2 & 3: Insert `in the middle` or `at the end`
            bids[_previous].next = bidder; // Update previous bid’s `next`

            if (_current != address(0)) {
                // Case 2: Insert in `the middle`
                bids[_current].prev = bidder; // Update next bid’s `prev`
            } else {
                // Case 3: Insert at `the end`
                self.lastBidder = bidder; // Update last bidder
            }
        }
    }

    function getBidPrice(
        uint128 quantity,
        uint128 pricePerToken
    )
        public
        pure
        returns (uint128 price)
    {
        // use uint256 to avoid overflow
        price = uint128((uint256(quantity) * uint256(pricePerToken) + 1e18 - 1) / 1e18);
    }
}
