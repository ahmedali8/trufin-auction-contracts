import type { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { config as dotenvConfig } from "dotenv";
import { resolve } from "path";

import type { Auction } from "../../types";

const dotenvConfigPath: string = process.env.DOTENV_CONFIG_PATH || "../../.env";
dotenvConfig({ path: resolve(__dirname, dotenvConfigPath) });

export const isDebugMode = process.env.DEBUG === "true";

export async function logState(
  signers: Record<string, string>,
  auctionContract: Auction,
  caller: SignerWithAddress
) {
  if (!isDebugMode) return;

  const state = await auctionContract.state();
  const bid = await auctionContract.bids(caller);
  console.log(
    `-----------------------------${signers[caller.address]}-----------------------------`
  );
  console.log("State:");
  console.log("topBidder:", state.topBidder);
  console.log("lastBidder:", state.lastBidder);
  console.log("totalBidCount:", state.totalBidCount.toString());
  console.log("totalTokensForSale:", state.totalTokensForSale.toString());
  console.log("token:", state.token);
  console.log("endTime:", state.endTime.toString());
  console.log("status:", state.status);
  console.log("Bid:");
  console.log("quantity:", bid.quantity.toString());
  console.log("pricePerToken:", bid.pricePerToken.toString());
  console.log("bidder:", bid.bidder);
  console.log("timestamp:", bid.timestamp.toString());
  console.log("filled:", bid.filled);
  console.log("prev:", bid.prev);
  console.log("next:", bid.next);
  console.log("---------------------------------------------------------------");
}
