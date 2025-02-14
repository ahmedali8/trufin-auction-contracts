import { StandardMerkleTree } from "@openzeppelin/merkle-tree";
import * as fs from "fs";
import path from "path";

/**
 * @notice Verifies if a bid is included in the Merkle Tree.
 * @param bidder - Address of the bidder.
 * @param quantity - Quantity of tokens requested.
 * @param serial - Serial number of the bidder a/c to index.
 * @param proof - Merkle proof from merkleData.json.
 * @returns True if valid, false otherwise.
 */
export function verifyMerkleProof(
  bidder: string,
  serial: bigint,
  quantity: bigint,
  proof: string[]
): boolean {
  // Load Merkle root from JSON
  const merkleData = JSON.parse(fs.readFileSync(path.join(__dirname, "merkle-data.json"), "utf-8"));
  const root = merkleData.root;

  // Construct the leaf as an array (NOT hashed)
  const leaf = [bidder, serial, quantity];

  // Verify the proof using OpenZeppelin's StandardMerkleTree
  const isValid = StandardMerkleTree.verify(root, ["address", "uint128", "uint128"], leaf, proof);

  console.log(`🔍 Proof validation for ${bidder}: ${isValid ? "✅ Valid" : "❌ Invalid"}`);
  return isValid;
}

// Example usage
const userAddress = "0x906c57Cf58a3eF2b97433cD787982fd5b78d2cF7";
const userSerial = 2n;
const userQuantity = 500000000000000000000n;
const userProof = JSON.parse(fs.readFileSync(path.join(__dirname, "merkle-data.json"), "utf-8"))
  .proofs[userAddress];

verifyMerkleProof(userAddress, userSerial, userQuantity, userProof);
