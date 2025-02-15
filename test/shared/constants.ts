import { time } from "@nomicfoundation/hardhat-network-helpers";
import { parseEther, parseUnits } from "ethers";

export enum AuctionStatus {
  NOT_STARTED,
  STARTED,
  ENDED,
}

export const TIME_BUFFER = 5; // Buffer for timing adjustments

export const AUCTION_DURATION = time.duration.minutes(10); // Auction lasts 10 minutes (just for example)

export const TOKEN_AMOUNT = parseEther("100");

export const TOTAL_TOKENS = parseEther("10");

export const TOKEN_QUANTITY = parseEther("100");

export const PRICE_PER_TOKEN = parseUnits("1", 17); // 0.1 ETH per token
