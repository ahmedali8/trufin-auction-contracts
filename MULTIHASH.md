# Efficient IPFS Hash Storage in Solidity

In decentralized applications, especially those leveraging the InterPlanetary File System (IPFS),
storing content identifiers efficiently in smart contracts is crucial. Traditional methods, like
storing these identifiers as Base58 encoded strings, are intuitive but gas-inefficient. This
document explores a more efficient approach using the `MultiHash` structure.

## The Challenge with Strings

Storing an IPFS hash as a Base58 encoded string (e.g.,
`QmWmyoMoctfbAaiEs2G46gpeUmhqFRDW6KWo64y5r581Vz`) is straightforward but requires 46 bytes. This
exceeds Ethereum's 32-byte limit for fixed-size arrays, necessitating dynamically-sized types
(`string` or `bytes`), which are more expensive in terms of storage.

## Leveraging Multihash

IPFS hashes are Multihashes, containing metadata about the hash function and size, followed by the
hash value. For example, `0x12` indicates `sha2`, and `0x20` represents a 256-bit hash. By omitting
the first two bytes (metadata), we're left with a 32-byte hash that fits within Ethereum's `bytes32`
type, optimizing storage.

## Multihash Struct Definition

To accommodate any Multihash and future-proof the contract, we define a `Multihash` struct:

```solidity
  struct Multihash {
      bytes32 hash;          // The hash value
      uint8 hashFunction;    // Hash function identifier
      uint8 size;            // Size of the hash output
  }
```

This struct stores the hash in a `bytes32` type and combines the hash function and size into a
single slot, maximizing storage efficiency.

## Benefits

- **Gas Efficiency**: Utilizing `bytes32` and compact struct storage reduces the gas cost associated
  with storing IPFS hashes.
- **Future-proofing**: This method is adaptable to changes in IPFS hash formats, supporting a wide
  range of hash functions.
- **Interoperability**: Compliance with the Multihash specification ensures compatibility across
  different systems and protocols.
