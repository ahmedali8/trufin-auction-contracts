// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.26;

/// @title IAuction
/// @notice Interface defining the core functionality of an auction contract.
/// @dev This interface should be implemented by the `Auction` contract to enable interaction with
/// external contracts.
interface IAuction {
    /// @notice Emitted when an auction is started.
    /// @param totalTokens The total number of tokens available for auction.
    /// @param startTime The timestamp when the auction starts.
    /// @param duration The duration of the auction in seconds.
    event AuctionStarted(uint128 totalTokens, uint40 startTime, uint40 duration);

    /// @notice Emitted when a bid is placed.
    /// @param bidder The address of the bidder.
    /// @param quantity The number of tokens the bidder wants to purchase.
    /// @param pricePerToken The price per token in ETH.
    event BidPlaced(address indexed bidder, uint128 quantity, uint128 pricePerToken);

    /// @notice Emitted when the auction ends successfully.
    event AuctionEnded();

    /// @notice Emitted when a refund is issued to a non-winning bidder.
    /// @param bidder The address of the refunded bidder.
    /// @param amount The amount of ETH refunded.
    event RefundIssued(address indexed bidder, uint256 amount);

    /// @notice Starts an auction with specified parameters.
    /// @dev Callable only by the contract owner and requires an ETH security deposit.
    /// @param totalTokens The total number of tokens available for sale.
    /// @param duration The duration of the auction in seconds.
    /// @custom:requirements
    /// - `msg.sender` must be the auction owner.
    /// - `msg.value` must be equal to the required security deposit.
    /// - The auction must not already be active.
    /// - `totalTokens` must be greater than zero.
    /// - `duration` must be greater than zero.
    function startAuction(uint128 totalTokens, uint40 duration) external;

    /// @notice Places a bid on the auction.
    /// @dev Requires an ETH payment equal to `quantity * pricePerToken`.
    /// @param quantity The number of tokens the bidder wants to purchase.
    /// @param pricePerToken The price per token in ETH.
    /// @custom:requirements
    /// - `msg.sender` must not be the auction owner.
    /// - `msg.value` must be exactly `quantity * pricePerToken`.
    /// - The auction must be active (`Status.STARTED`).
    /// - `quantity` must be greater than zero.
    function placeBid(uint128 quantity, uint128 pricePerToken) external payable;

    /// @notice Ends the auction, finalizing bids and distributing tokens or refunds.
    /// @dev Can be called by anyone after the auction period ends.
    /// @custom:requirements
    /// - The auction must have ended.
    function endAuction() external;

    /// @notice Computes the total ETH cost for a bid.
    /// @dev Uses uint256 for intermediate calculations to prevent overflow before casting to
    /// uint128.
    /// @param quantity The number of tokens the bidder is purchasing.
    /// @param pricePerToken The price per token in ETH.
    /// @return price The total bid cost in ETH.
    function getBidPrice(
        uint128 quantity,
        uint128 pricePerToken
    )
        external
        pure
        returns (uint128 price);
}
