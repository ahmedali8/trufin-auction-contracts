// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.26;

import { State, Status, Bid } from "../types/DataTypes.sol";

/// @title BidLibrary
/// @notice Optimized bid insertion using a sorted doubly linked list
/// @dev This library reduces gas costs by minimizing storage reads/writes
library BidLibrary {
    using BidLibrary for State;

    /// @dev Inserts a bid into the sorted doubly linked list based on auction rules.
    /// @param state The auction state containing the linked list
    /// @param bids Mapping of bidders to their bid information
    /// @param bidder The address of the bidder placing the bid
    function insertBid(
        State storage state,
        mapping(address => Bid) storage bids,
        address bidder
    )
        internal
    {
        Bid storage newBid = bids[bidder]; // SSTORE: Create a new bid

        // If the auction has no bids yet, set this bid as the first and last
        if (state.topBidder == address(0)) {
            state.topBidder = bidder; // SSTORE: Set first top bidder
            state.lastBidder = bidder; // SSTORE: Set first last bidder
            return; // Exit early to save gas
        }

        address _current = state.topBidder; // STORAGE READ: Start at the top bidder
        address _previous = address(0); // In-memory variable (not stored)

        // Fetch new bid values **into memory** to avoid multiple storage reads
        uint128 newPrice = newBid.pricePerToken;
        uint128 newQuantity = newBid.quantity;
        uint40 newTimestamp = newBid.timestamp;

        // Iterate to find correct position (sorted order)
        while (_current != address(0)) {
            Bid storage currentBid = bids[_current]; // STORAGE READ: Load bid details

            // Compare and find insertion point
            if (newPrice > currentBid.pricePerToken) break;
            if (newPrice == currentBid.pricePerToken && newQuantity > currentBid.quantity) break;
            if (
                newPrice == currentBid.pricePerToken && newQuantity == currentBid.quantity
                    && newTimestamp < currentBid.timestamp
            ) break;

            // Move to next bid
            _previous = _current;
            _current = currentBid.next; // STORAGE READ: Fetch next bid
        }

        // SSTORE: Update bid pointers in the linked list
        newBid.next = _current;
        newBid.prev = _previous;

        if (_previous == address(0)) {
            // Case 1: Insert **at the top**
            newBid.next = state.topBidder; // Link new bid to the old top
            bids[state.topBidder].prev = bidder; // Update old top bid’s `prev`
            state.topBidder = bidder; // Update highest-priority bid
        } else {
            // Case 2 & 3: Insert **in the middle** or **at the end**
            bids[_previous].next = bidder; // Update previous bid’s `next`

            if (_current != address(0)) {
                // Case 2: Insert in **the middle**
                bids[_current].prev = bidder; // Update next bid’s `prev`
            } else {
                // Case 3: Insert at **the end**
                state.lastBidder = bidder; // Update last bidder
            }
        }
    }
}
