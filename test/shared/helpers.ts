import { time } from "@nomicfoundation/hardhat-network-helpers";
import { type ContractTransactionResponse, parseUnits } from "ethers";

import { AUCTION_DURATION, TIME_BUFFER } from "./constants";

export async function getGasFee(tx: Promise<ContractTransactionResponse>) {
  const txResponse = await tx;
  const receipt = await txResponse.wait();
  if (!receipt) return Error("No receipt found for transaction");
  const gasUsed = receipt.gasUsed;
  const gasPrice = receipt.gasPrice;

  return gasUsed * gasPrice;
}

export async function getStartTime() {
  return (await time.latest()) + TIME_BUFFER;
}

export function getEndTime(startTime: number) {
  return startTime + AUCTION_DURATION;
}

export async function getStartAndEndTime() {
  const startTime = await getStartTime();
  const endTime = getEndTime(startTime);

  return { startTime, endTime };
}

// gets the price
export function getBidPrice(quantity: bigint, pricePerToken: bigint) {
  return (pricePerToken * quantity) / parseUnits("1", 18);
}

// Move time forward to the start of the auction
export async function advanceToAuctionStart(startTime: number) {
  await time.increaseTo(startTime + time.duration.seconds(TIME_BUFFER));
}

// Move time forward to the start of the auction
// Move time forward to the end of the auction
export async function advanceToAuctionEnd(endTime: number) {
  await time.increaseTo(endTime + time.duration.seconds(TIME_BUFFER));
}
