import { time } from "@nomicfoundation/hardhat-network-helpers";
import { parseEther, parseUnits, zeroPadBytes } from "ethers";

import type { IAuction } from "../../types/contracts/Auction";
import { ZERO_BYTES32 } from "../../utils/constants";
import type { MockIpfs } from "./types";

export enum AuctionStatus {
  INACTIVE,
  ACTIVE,
  MERKLE_SUBMITTED,
  ENDED,
}

export const SECURITY_DEPOSIT = parseUnits("5", 17); // 0.5 ETH
export const VERIFICATION_WINDOW = time.duration.hours(2);
export const TIME_BUFFER = 5; // Buffer for timing adjustments
export const AUCTION_DURATION = time.duration.minutes(10); // Auction lasts 10 minutes (just for example)
export const TOKEN_AMOUNT = parseEther("100");
export const TOTAL_TOKENS = parseEther("10");
export const TOKEN_QUANTITY = parseEther("100");
export const PRICE_PER_TOKEN = parseUnits("1", 17); // 0.1 ETH per token
export const INVALID_MERKLE_ROOT = ZERO_BYTES32;
export const DUMMY_MERKLE_ROOT = zeroPadBytes("0x01", 32);
export const INVALID_PROOF = ["0xa7a72291e3c368d9052a4baa918856f83eca42f8862b56ad9b17bf3cb8038885"];
export const INVALID_MULTI_HASH_IPFS: MockIpfs = {
  multiHash: "",
  hashFunction: 0,
  size: 0,
  digest: ZERO_BYTES32,
};
export const MOCK_MULTI_HASH_IPFS: MockIpfs = {
  multiHash: "QmdYa7RaJuw8GCJqVtNFKgW67r6G9yythTLqTMcaacEs4J",
  hashFunction: 18, // 0x12
  size: 32, // 0x20
  digest: "0xe1ed131d46ea375a367b0986d3713500a538006536fdd290afe41ce83380265f",
};

/// Mock Params ///
export const MOCK_SUBMIT_MERKLE_DATA_PARAMS: IAuction.MerkleDataParamsStruct = {
  merkleRoot: DUMMY_MERKLE_ROOT,
  digest: MOCK_MULTI_HASH_IPFS.digest,
  hashFunction: MOCK_MULTI_HASH_IPFS.hashFunction,
  size: MOCK_MULTI_HASH_IPFS.size,
};
