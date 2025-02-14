import { StandardMerkleTree } from "@openzeppelin/merkle-tree";

/**
 * @notice Generates a Merkle tree from bid data.
 * @param bids - Array of bids [{ bidder: string, serial: bigint, quantity: bigint }]
 * @returns An object containing the Merkle root and proofs.
 */
export function generateMerkleTree(bids: { bidder: string; serial: bigint; quantity: bigint }[]) {
  const leaves = bids.map((bid) => [bid.bidder, bid.serial.toString(), bid.quantity.toString()]);

  // Create the Merkle Tree
  //                                           bidder     serial     quantity
  const tree = StandardMerkleTree.of(leaves, ["address", "uint128", "uint128"]);

  // Generate proofs for each bid
  const proofs: Record<string, string[]> = {};
  leaves.forEach((leaf, index) => {
    proofs[leaf[0]] = tree.getProof(index);
  });

  return {
    root: tree.root,
    proofs, // bidder => proof
  };
}
