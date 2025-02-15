import type { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers } from "hardhat";

import type { Auction, Auction__factory, MockToken, MockToken__factory } from "../../types";

/// Contract Fixtures ///

export async function auctionFixture(tokenAddress: string): Promise<Auction> {
  const signers = await ethers.getSigners();
  const owner: SignerWithAddress = signers[0];

  const AuctionFactory: Auction__factory = await ethers.getContractFactory("Auction");

  type DeployArgs = Parameters<typeof AuctionFactory.deploy>;
  const args: DeployArgs = [owner.address, tokenAddress];

  const auction: Auction = await AuctionFactory.connect(owner).deploy(...args);
  await auction.waitForDeployment();

  return auction;
}

/// Mock Contract Fixtures ///

export async function mockTokenFixture(): Promise<MockToken> {
  const signers = await ethers.getSigners();
  const owner: SignerWithAddress = signers[0];

  const MockTokenFactory: MockToken__factory = await ethers.getContractFactory("MockToken");
  const token: MockToken = await MockTokenFactory.connect(owner).deploy();
  await token.waitForDeployment();

  return token;
}

/// Test Fixtures ///

export async function loadFixtures(): Promise<{
  auction: Auction;
  token: MockToken;
  auctionAddress: string;
  tokenAddress: string;
}> {
  const token = await mockTokenFixture();
  const tokenAddress = await token.getAddress();

  const auction = await auctionFixture(tokenAddress);
  const auctionAddress = await auction.getAddress();

  return { auction, auctionAddress, token, tokenAddress };
}
