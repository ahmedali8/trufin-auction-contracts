import { ethers } from "hardhat";

import { verifyContract } from "../utils/verify";

async function main() {
  const { chainId } = await ethers.provider.getNetwork();

  const contractName = "Auction";
  const contractPath = `contracts/${contractName}.sol:${contractName}`;
  const contractAddress = "";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const args: any[] = [
    // owner address
    // verifier address
  ];

  // You don't want to verify on localhost
  if (chainId != 31337n && chainId != 1337n) {
    await verifyContract({
      contractPath,
      contractAddress,
      args,
    });
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.log(error);
    process.exit(1);
  });
