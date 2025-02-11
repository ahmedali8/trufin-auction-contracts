import bs58 from "bs58";

export type HexString = string;

export interface IMultiHash {
  digest: HexString; // Hex-encoded digest with '0x' prefix
  hashFunction: number; // Code of the hash function used
  size: number; // Length of the digest
}

/**
 * Decodes a base58 encoded multiHash string into its components.
 *
 * @param multiHash The base58 encoded multiHash string to decode
 * @returns An object representing the decoded multiHash
 */
export function getMultiHashFromBytes32(multiHash: string): IMultiHash {
  const decoded = bs58.decode(multiHash);

  // Correcting the approach to convert Uint8Array to hex string
  const digestHex: HexString = `0x${Buffer.from(decoded.subarray(2)).toString("hex")}`;

  return {
    digest: digestHex,
    hashFunction: decoded[0],
    size: decoded[1],
  };
}

/**
 * Encodes components of a multiHash into a base58 encoded multiHash string.
 *
 * @param multiHash Object containing the multiHash components
 * @returns The base58 encoded multiHash string or null if size is 0
 */
export function getBytes32FromMultiHash(multiHash: IMultiHash): string | null {
  const { digest, hashFunction, size } = multiHash;

  if (size === 0) return null;

  // Convert hex digest (excluding '0x') to bytes using Buffer for consistency
  const digestBytes = Buffer.from(digest.slice(2), "hex");
  const bytes = new Uint8Array(2 + digestBytes.length);
  bytes.set(digestBytes, 2);
  bytes[0] = hashFunction;
  bytes[1] = size;

  return bs58.encode(bytes);
}
