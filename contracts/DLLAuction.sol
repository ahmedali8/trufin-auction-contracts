// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19; // Specify Solidity version

// Import OpenZeppelin contracts for security and ERC20 token handling
import "@openzeppelin/contracts/token/ERC20/IERC20.sol"; // Interface for ERC20 token interaction
import "@openzeppelin/contracts/access/Ownable.sol"; // Allows restricted functions to be called
    // only by the owner
import "hardhat/console.sol";
/**
 * @title Doubly Linked List Auction
 * @dev Implements an auction system where users can bid for ERC20 tokens.
 * The contract maintains a **sorted linked list** of bids based on:
 * 1. **Price per token** (descending order)
 * 2. **Quantity** (ascending order for tie-breaks)
 * 3. **Timestamp** (FIFO if all else is equal)
 */

contract DLLAuction is Ownable {
    // Custom error messages for gas-efficient error handling
    error AuctionAlreadyInProgress();
    error InvalidTokenAmount();
    error TokenTransferFailed();
    error AuctionEnded();
    error InvalidBid();
    error IncorrectETHSent();
    error BidAlreadyPlaced();
    error AuctionNotFinished();

    /**
     * @dev Structure to represent each bid.
     */
    struct Bid {
        address bidder; // Address of the bidder
        uint256 amount; // Number of tokens the bidder wants to purchase
        uint256 price; // Price offered per token
        uint256 timestamp; // Time when the bid was placed (used for FIFO tie-breaking)
        address prev; // Previous bidder in the sorted order
        address next; // Next bidder in the sorted order
        bool filled; // Tracks if the bid was fulfilled
    }

    // Mapping to store all bids placed by users
    mapping(address => Bid) public bids;

    // Address of the bidder offering the highest price per token
    address public topBidder;

    // Address of the last bidder (used for inserting bids at the correct position)
    address public lastBidder;

    // Total count of bids placed
    uint256 public totalBidCount;

    // The ERC20 token being auctioned
    IERC20 public auctionToken;

    // The timestamp when the auction will end
    uint256 public auctionEndTime;

    // The total number of ERC20 tokens available in the auction
    uint256 public totalTokensForSale;

    // Flag to indicate whether the auction has been completed
    bool public auctionFinished;

    // Events to log important actions in the contract
    event AuctionStarted(uint256 tokenAmount, uint256 duration);
    event BidPlaced(address indexed bidder, uint256 quantity, uint256 price);
    event AuctionCompleted();
    event RefundIssued(address indexed bidder, uint256 amount);

    /**
     * @dev Constructor to initialize the auction contract.
     * @param tokenAddress The address of the ERC20 token to be auctioned.
     */
    constructor(address tokenAddress) Ownable(msg.sender) {
        auctionToken = IERC20(tokenAddress); // Assign the ERC20 token contract
    }

    /**
     * @dev Inserts a new bid into the sorted list while maintaining the correct order.
     * Sorting Order:
     * - Higher price first
     * - If price is the same, prioritize lower quantity
     * - If both price and quantity are the same, prioritize earlier timestamp (FIFO)
     * @param bidder The address of the user placing the bid.
     */
    function _insertBid(address bidder) internal {
        console.log("bidder: %s", bidder);
        if (topBidder == address(0)) {
            // If this is the first bid, initialize the linked list
            topBidder = bidder;
            lastBidder = bidder;
            return;
        }

        address current = topBidder; // Start checking from the highest bid
        while (
            current != address(0)
                && (
                    bids[current].price > bids[bidder].price // Prioritize higher price per token
                        || (
                            bids[current].price == bids[bidder].price
                                && bids[current].amount < bids[bidder].amount
                        ) // If same price, prioritize lower quantity (for competitive pricing)
                        || (
                            bids[current].price == bids[bidder].price
                                && bids[current].amount == bids[bidder].amount
                                && bids[current].timestamp < bids[bidder].timestamp
                        )
                ) // If price and quantity are the same, use FIFO (earlier bid wins)
        ) {
            current = bids[current].next; // Move to the next bid in the list
        }

        if (current == address(0)) {
            // If we reached the end of the list, insert at the last position
            bids[lastBidder].next = bidder;
            bids[bidder].prev = lastBidder;
            lastBidder = bidder;
        } else {
            // Insert the bid before the `current` bid
            bids[bidder].next = current;
            bids[bidder].prev = bids[current].prev;

            if (bids[current].prev != address(0)) {
                bids[bids[current].prev].next = bidder;
            } else {
                topBidder = bidder; // If inserting at the top, update the highest bidder
            }
            bids[current].prev = bidder; // Adjust previous pointer for bid placement
        }
    }

    /**
     * @dev Starts the auction with a specified token amount and duration.
     * Can only be called by the contract owner.
     * @param tokenAmount The number of tokens available in the auction.
     * @param duration The duration of the auction in seconds.
     */
    function startAuction(uint256 tokenAmount, uint256 duration) external onlyOwner {
        if (auctionEndTime != 0 && block.timestamp <= auctionEndTime) {
            revert AuctionAlreadyInProgress();
        }
        if (tokenAmount == 0) revert InvalidTokenAmount();

        if (!auctionToken.transferFrom(msg.sender, address(this), tokenAmount)) {
            revert TokenTransferFailed();
        }

        auctionEndTime = block.timestamp + duration; // Set auction end time
        totalTokensForSale = tokenAmount; // Set total available tokens
        auctionFinished = false; // Reset auction state

        emit AuctionStarted(tokenAmount, duration); // Emit auction start event
    }

    /**
     * @dev Allows users to place a bid.
     * The user must send ETH equivalent to (quantity * pricePerToken).
     * @param quantity Number of tokens the bidder wants to buy.
     * @param pricePerToken The price per token the user is willing to pay.
     */
    function placeBid(uint256 quantity, uint256 pricePerToken) external payable {
        if (block.timestamp >= auctionEndTime) revert AuctionEnded();
        if (quantity == 0 || pricePerToken == 0) revert InvalidBid();

        uint256 totalCost = quantity * pricePerToken / 1e18; // Calculate the required ETH amount
        if (msg.value != totalCost) revert IncorrectETHSent();

        Bid storage newBid = bids[msg.sender];
        if (newBid.amount != 0) revert BidAlreadyPlaced();

        // Store bid details
        newBid.bidder = msg.sender;
        newBid.amount = quantity;
        newBid.price = pricePerToken;
        newBid.timestamp = block.timestamp;

        _insertBid(msg.sender); // Insert bid into the sorted list

        totalBidCount++; // Increment bid count
        emit BidPlaced(msg.sender, quantity, pricePerToken); // Emit event for bid placement
    }

    /**
     * @dev Finalizes the auction and distributes tokens to winning bidders.
     * Bids are filled until tokens run out.
     */
    function finalizeAuction() external onlyOwner {
        if (block.timestamp < auctionEndTime) revert AuctionEnded();
        if (auctionFinished) revert AuctionNotFinished();

        auctionFinished = true; // Mark auction as finished
        uint256 remainingTokens = totalTokensForSale; // Track available tokens
        address currentBidder = topBidder; // Start with the highest bidder

        while (currentBidder != address(0)) {
            Bid storage bid = bids[currentBidder];

            if (remainingTokens > 0) {
                uint256 allocatedAmount =
                    bid.amount <= remainingTokens ? bid.amount : remainingTokens;
                remainingTokens -= allocatedAmount;

                // Transfer allocated tokens to the bidder
                auctionToken.transfer(currentBidder, allocatedAmount);

                bid.filled = true; // Mark the bid as fulfilled
            } else {
                // Refund immediately instead of looping later
                uint256 refundAmount = (bid.amount * bid.price) / 1e18;
                (bool success,) = currentBidder.call{ value: refundAmount }("");
                require(success, "Refund failed");
                emit RefundIssued(currentBidder, refundAmount);
            }

            currentBidder = bid.next; // Move to the next bid in the list
        }

        emit AuctionCompleted(); // Emit auction completion event
    }
}
