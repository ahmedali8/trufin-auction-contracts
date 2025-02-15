// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.26;

/// @title IAuction
/// @notice Interface defining the core functionality of an auction contract.
/// @dev This interface should be implemented by the `Auction` contract to enable interaction with
/// external contracts.
interface IAuction {
    /// @notice Event emitted when an auction is started.
    event AuctionStarted(uint128 totalTokens, uint40 startTime, uint40 duration);

    /// @notice Event emitted when a bid is placed.
    event BidPlaced(address indexed bidder, uint128 quantity, uint128 pricePerToken);

    /// @notice Event emitted when the auction is successfully ended.
    event AuctionEnded();

    event RefundIssued(address indexed bidder, uint256 amount);

    /*
    /// @notice Starts an auction with the specified parameters.
    /// @dev Callable only by the owner and requires an ETH security deposit.
    /// @param params The struct containing auction initialization parameters.
    /// @custom:requirements
    /// - `msg.sender` must be the auction owner.
    /// - `msg.value` must be equal to the required security deposit.
    /// - `params.startTime` must be in the future.
    /// - `params.endTime` must be greater than `params.startTime`.
    /// - `params.totalTokens` must be greater than zero.
    */

    function startAuction(uint128 totalTokens, uint40 duration) external payable;

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

    /// @notice Ends the auction and allows bidders to claim tokens or refunds.
    /// @dev Can be called by anyone after the verification period ends.
    /// @custom:requirements
    /// - The auction must have already ended.
    /// - The verification period must have expired.
    function endAuction() external;

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
