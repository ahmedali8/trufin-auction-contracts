import * as fs from "fs";
import path from "path";

import { generateMerkleTree } from "./generate-merkle-tree";

interface Bid {
  bidder: string;
  // Stored as string to avoid BigInt JSON issues
  serial: string;
  quantity: string;
}

// Load bids from a JSON file
const bidData: Bid[] = JSON.parse(
  fs.readFileSync(path.join(__dirname, "bids.json"), "utf-8")
) as Bid[];

// Convert `quantity` from string to `BigInt`
const parsedBids = bidData.map((bid: { bidder: string; serial: string; quantity: string }) => ({
  bidder: bid.bidder,
  serial: BigInt(bid.serial),
  quantity: BigInt(bid.quantity),
}));

async function writeMerkleRoot() {
  // Generate the Merkle Tree
  const merkleData = generateMerkleTree(parsedBids);

  // Save the Merkle root & proofs to a JSON file
  fs.writeFileSync(path.join(__dirname, "./merkle-data.json"), JSON.stringify(merkleData, null, 2));

  console.log("✅ Merkle Root & Proofs saved to merkleData.json");
}

// Execute script
writeMerkleRoot().catch(console.error);
