// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title PriorityQueueAuction
 * @dev Implements an auction system using a **priority queue (max heap)** for efficient bid
 * sorting.
 * The queue maintains bids based on:
 * 1. **Highest price per token** (priority sorting)
 * 2. **Higher quantity** (tie-breaker)
 * 3. **Earliest timestamp** (FIFO for further tie-breaking)
 */
contract PQAuction is Ownable {
    struct Bid {
        address bidder; // Address of the bidder
        uint256 amount; // Quantity of tokens the bidder wants to purchase
        uint256 price; // Price per token the bidder is offering
        uint256 timestamp; // Timestamp when the bid was placed (used for tie-breaking)
        bool filled; // Whether the bid was successfully allocated tokens
    }

    IERC20 public auctionToken; // The ERC20 token being auctioned
    uint256 public auctionEndTime; // Timestamp when the auction ends
    uint256 public totalTokensForSale; // Total number of tokens available in the auction
    bool public auctionFinished; // Flag indicating if the auction has been finalized

    Bid[] public bids; // Priority queue implemented as a max heap
    mapping(address => uint256) public refunds; // Tracks refund amounts for unsuccessful bidders

    event AuctionStarted(uint256 tokenAmount, uint256 duration);
    event BidPlaced(address indexed bidder, uint256 quantity, uint256 price);
    event AuctionCompleted();
    event RefundIssued(address indexed bidder, uint256 amount);

    /**
     * @dev Constructor initializes the auction with an ERC20 token address.
     * @param tokenAddress The address of the ERC20 token being auctioned.
     */
    constructor(address tokenAddress) Ownable(msg.sender) {
        auctionToken = IERC20(tokenAddress);
    }

    /**
     * @dev Inserts a bid into the **priority queue** based on price, quantity, and timestamp.
     * The queue is structured as a **max heap** to efficiently retrieve the highest bid.
     */
    function _insertBid(Bid memory newBid) internal {
        bids.push(newBid); // Add bid at the end of the array
        uint256 i = bids.length - 1;

        // Heapify up to maintain the max heap property
        while (
            i > 0
                && (
                    bids[i].price > bids[(i - 1) / 2].price // Higher price has priority
                        || (
                            bids[i].price == bids[(i - 1) / 2].price
                                && bids[i].amount > bids[(i - 1) / 2].amount
                        ) // Higher quantity wins in case of tie
                        || (
                            bids[i].price == bids[(i - 1) / 2].price
                                && bids[i].amount == bids[(i - 1) / 2].amount
                                && bids[i].timestamp < bids[(i - 1) / 2].timestamp
                        )
                ) // FIFO tie-breaking
        ) {
            // Swap with parent node to maintain heap property
            Bid memory tempBid = bids[i];
            bids[i] = bids[(i - 1) / 2];
            bids[(i - 1) / 2] = tempBid;
            i = (i - 1) / 2;
        }
    }

    /**
     * @dev Starts the auction with a specified token amount and duration.
     * @param tokenAmount Number of tokens available for bidding.
     * @param duration Duration of the auction in seconds.
     */
    function startAuction(uint256 tokenAmount, uint256 duration) external onlyOwner {
        require(
            auctionEndTime == 0 || block.timestamp > auctionEndTime, "Auction already in progress"
        );
        require(tokenAmount > 0, "Token amount must be greater than zero");

        require(
            auctionToken.transferFrom(msg.sender, address(this), tokenAmount),
            "Token transfer failed"
        );

        auctionEndTime = block.timestamp + duration;
        totalTokensForSale = tokenAmount;
        auctionFinished = false;

        emit AuctionStarted(tokenAmount, duration);
    }

    /**
     * @dev Places a bid and inserts it into the **priority queue**.
     * @param quantity Number of tokens the bidder wants to buy.
     * @param pricePerToken The price per token the bidder is offering.
     */
    function placeBid(uint256 quantity, uint256 pricePerToken) external payable {
        require(block.timestamp < auctionEndTime, "Auction has ended");
        require(quantity > 0 && pricePerToken > 0, "Invalid bid");

        uint256 totalCost = quantity * pricePerToken / 1e18;
        require(msg.value == totalCost, "Incorrect ETH sent");

        Bid memory newBid = Bid(msg.sender, quantity, pricePerToken, block.timestamp, false);
        _insertBid(newBid);

        emit BidPlaced(msg.sender, quantity, pricePerToken);
    }

    /**
     * @dev Finalizes the auction, distributing tokens to winners and **automatically refunding
     * non-winners**.
     */
    function finalizeAuction() external onlyOwner {
        require(block.timestamp >= auctionEndTime, "Auction is still ongoing");
        require(!auctionFinished, "Auction already ended");

        auctionFinished = true;
        uint256 remainingTokens = totalTokensForSale;

        while (bids.length > 0) {
            Bid memory topBid = bids[0]; // Get highest priority bid

            if (remainingTokens > 0) {
                uint256 allocatedAmount =
                    topBid.amount <= remainingTokens ? topBid.amount : remainingTokens;
                remainingTokens -= allocatedAmount;

                // Transfer tokens to the winning bidder
                auctionToken.transfer(topBid.bidder, allocatedAmount);
                bids[0].filled = true; // Mark bid as filled
            } else {
                // If no tokens left, refund unsuccessful bidder
                uint256 refundAmount = topBid.amount * topBid.price / 1e18;
                refunds[topBid.bidder] = refundAmount; // Store refund in mapping

                // Directly send refund to non-winner
                (bool success,) = topBid.bidder.call{ value: refundAmount }("");
                require(success, "Refund failed");

                emit RefundIssued(topBid.bidder, refundAmount);
            }

            _removeTopBid();
        }

        emit AuctionCompleted();
    }

    /**
     * @dev Removes the highest priority bid from the **priority queue** after it has been
     * processed.
     * This operation **heapifies down** to maintain the **max heap property**.
     */
    function _removeTopBid() internal {
        require(bids.length > 0, "No bids available");

        // Replace root with last element
        bids[0] = bids[bids.length - 1];
        bids.pop(); // Remove last element

        uint256 i = 0;

        // Heapify down to maintain max heap property
        while (2 * i + 1 < bids.length) {
            uint256 maxChild = 2 * i + 1;

            if (
                maxChild + 1 < bids.length
                    && (
                        bids[maxChild + 1].price > bids[maxChild].price
                            || (
                                bids[maxChild + 1].price == bids[maxChild].price
                                    && bids[maxChild + 1].amount > bids[maxChild].amount
                            )
                            || (
                                bids[maxChild + 1].price == bids[maxChild].price
                                    && bids[maxChild + 1].amount == bids[maxChild].amount
                                    && bids[maxChild + 1].timestamp < bids[maxChild].timestamp
                            )
                    )
            ) {
                maxChild++;
            }

            if (bids[i].price >= bids[maxChild].price) break;

            // Swap the current node with the highest priority child
            Bid memory tempBid = bids[i];
            bids[i] = bids[maxChild];
            bids[maxChild] = tempBid;
            i = maxChild;
        }
    }
}
