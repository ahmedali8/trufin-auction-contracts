# Auction Smart Contract [![Open in Gitpod][gitpod-badge]][gitpod] [![Github Actions][gha-badge]][gha] [![Foundry][foundry-badge]][foundry] [![Hardhat][hardhat-badge]][hardhat]

The **Auction Smart Contract** is a fully on-chain, decentralized auction system designed for
**ERC-20 token bidding**. It leverages **Merkle proofs for verifiable auction settlements**,
ensuring transparency and security while deterring fraudulent behavior through a **slashing
mechanism**.

This contract operates using a **well-defined auction state machine**, transitioning through four
key phases:

- **INACTIVE:** Auction setup phase before bidding begins.
- **ACTIVE:** Bidding is open, and participants can place bids.
- **MERKLE_SUBMITTED:** The auction has ended, and the results are submitted for verification.
- **ENDED:** The auction is finalized, and bidders can claim tokens or refunds.

---

## Project Structure

Below is the folder structure of this repository:

```tree
  ./contracts
  ├── Auction.sol                            # Main auction contract
  ├── interfaces
  │   └── IAuction.sol                       # Interface defining auction functions and events
  ├── libraries
  │   ├── AddressLibrary.sol                 # Utilities for address validation and ETH transfers
  │   ├── Constants.sol                      # Global constants
  │   ├── Errors.sol                         # Custom errors for gas efficiency
  │   ├── MerkleRootLibrary.sol              # Merkle root validation
  │   ├── MultiHashLibrary.sol               # IPFS multi-hash validation
  │   └── StateLibrary.sol                   # Handles auction state transitions
  └── mocks
      └── MockToken.sol                      # Mock ERC-20 token for testing
```

---

## Key Features

- **Fully On-Chain Auction System** – Trustless, decentralized, and transparent bidding.
- **Merkle Proof-Based Verification** – Ensures verifiable, tamper-proof bid settlements.
- **Security Deposit & Slashing Mechanism** – Discourages fraudulent activity.
- **Gas-Efficient Architecture** – Uses **custom errors** and **optimized storage** for lower costs.
- **Flexible Bidding Model** – Allows bidders to specify token quantity and price per token.

---

## Auction Lifecycle

### 1. Start the Auction

- The auction owner calls `startAuction()`, specifying:
  - **Token Address**
  - **Total Tokens**
  - **Start & End Time**
- The **security deposit (0.5 ETH)** is required to **prevent fraud**.
- The contract transitions to **ACTIVE**.

### 2️. Place Bids

- Participants submit bids by specifying:
  - **Quantity of tokens**
  - **Price per token**
- ETH must be **sent with the bid** to cover the **total bid amount**.
- The **contract records each bid on-chain**.

### 3️. End the Auction & Submit Merkle Root

- Once the auction ends, **the auctioneer submits the Merkle root** to verify winning bids.
- The **contract enters the `MERKLE_SUBMITTED` state**.
- The **Merkle root is stored on-chain**, ensuring **tamper-proof verification**.

### 4️. Verify & Claim Tokens

- Participants **submit Merkle proofs** to claim their tokens.
- **Winning bidders** receive ERC-20 tokens, while **non-winning bidders** get ETH refunds.
- **Bids are deleted from storage** after a successful claim.

### 5️. Auction Finalization & Slashing (if necessary)

- If fraud is detected, the **verifier can slash the auctioneer** by submitting a **new Merkle
  root**.
- The **auctioneer forfeits their security deposit**, which is sent to the verifier as a penalty.

---

## Getting Started

Follow these steps to set up the project in your browser environment or locally:

### Step 1: Initialization

Initiate your workspace by clicking on the [Gitpod badge][gitpod] or set up the repo locally by
cloning it and following the setup commands:

```bash
  git clone https://github.com/ahmedali8/trufin-auction-contracts
  make setup
```

### Step 2: Environment Variables

Set up your environment variables. Refer to [.env.example](./.env.example).

### Step 3: Running Tests

Execute tests using Hardhat or Foundry, depending on your preference.

For Hardhat tests, run:

```bash
  yarn run test
```

For Foundry tests, run:

```bash
  forge test
```

---

### Additional Resources

For more details on how the auction works and how to interact with it, see:

- **[GUIDE](./GUIDE.md)** – Step-by-step usage guide
- **[MULTIHASH](./MULTIHASH.md)** – How IPFS multi-hashing works

[gitpod]: https://gitpod.io/#https://github.com/ahmedali8/trufin-auction-contracts
[gitpod-badge]: https://img.shields.io/badge/Gitpod-Open%20in%20Gitpod-FFB45B?logo=gitpod
[gha]: https://github.com/ahmedali8/trufin-auction-contracts/actions
[gha-badge]:
  https://github.com/ahmedali8/foundry-hardhat-template/actions/workflows/ci.yml/badge.svg
[hardhat]: https://hardhat.org/
[hardhat-badge]: https://img.shields.io/badge/Built%20with-Hardhat-FFDB1C.svg
[foundry]: https://getfoundry.sh/
[foundry-badge]: https://img.shields.io/badge/Built%20with-Foundry-FFDB1C.svg
