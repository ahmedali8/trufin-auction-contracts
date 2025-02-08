import type { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers } from "hardhat";

import type { Auction, Auction__factory } from "../../types";

export async function auctionFixture(): Promise<{
  auction: Auction;
}> {
  const signers = await ethers.getSigners();
  const deployer: SignerWithAddress = signers[0];

  const AuctionFactory: Auction__factory = (await ethers.getContractFactory(
    "Auction"
  )) as Auction__factory;

  type DeployArgs = Parameters<typeof AuctionFactory.deploy>;
  const args: DeployArgs = [deployer.address];

  const auction: Auction = (await AuctionFactory.connect(deployer).deploy(...args)) as Auction;
  await auction.waitForDeployment();

  return { auction };
}
