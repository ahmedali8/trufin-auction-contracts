// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import { State, Status, Bid } from "../types/DataTypes.sol";
import { Errors } from "./Errors.sol";
import { AddressLibrary } from "./AddressLibrary.sol";
import { IAuction } from "../interfaces/IAuction.sol";

library StateLibrary {
    using AddressLibrary for address;
    using StateLibrary for State;

    uint256 internal constant MIN_BID_PRICE_PER_TOKEN = 1e15; // 0.001 ETH

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
        if (pricePerToken < MIN_BID_PRICE_PER_TOKEN) revert Errors.InvalidPricePerToken();

        // Store the bid
        bids[nextBidId] = Bid({ bidder: bidder, quantity: quantity, pricePerToken: pricePerToken });
    }
}
