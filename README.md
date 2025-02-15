# Auction Smart Contract [![Open in Gitpod][gitpod-badge]][gitpod] [![Github Actions][gha-badge]][gha] [![Foundry][foundry-badge]][foundry] [![Hardhat][hardhat-badge]][hardhat]

The **Auction Smart Contract** is a fully on-chain, decentralized auction system designed for
**ERC-20 token bidding**.

## Project Structure

```tree
./contracts
├── Auction.sol                            # Main auction contract
├── interfaces
│   └── IAuction.sol                       # Interface defining auction functions and events
├── libraries
│   ├── AddressLibrary.sol                 # Utilities for address validation and ETH transfers
│   ├── Errors.sol                         # Custom errors for gas efficiency
└── mocks
    └── MockToken.sol                      # Mock ERC-20 token for testing
```

### Key Features

- **Fully On-Chain Auction System** – Trustless, decentralized, and transparent bidding.
- **Flexible Bidding Model** – Allows bidders to specify token quantity and price per token.

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

[gitpod]: https://gitpod.io/#https://github.com/ahmedali8/trufin-auction-contracts
[gitpod-badge]: https://img.shields.io/badge/Gitpod-Open%20in%20Gitpod-FFB45B?logo=gitpod
[gha]: https://github.com/ahmedali8/trufin-auction-contracts/actions
[gha-badge]:
  https://github.com/ahmedali8/foundry-hardhat-template/actions/workflows/ci.yml/badge.svg
[hardhat]: https://hardhat.org/
[hardhat-badge]: https://img.shields.io/badge/Built%20with-Hardhat-FFDB1C.svg
[foundry]: https://getfoundry.sh/
[foundry-badge]: https://img.shields.io/badge/Built%20with-Foundry-FFDB1C.svg
