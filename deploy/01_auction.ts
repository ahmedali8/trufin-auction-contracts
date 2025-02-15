import type { Address, DeployFunction, DeployResult } from "hardhat-deploy/types";
import type { HardhatRuntimeEnvironment } from "hardhat/types";

import { preDeploy } from "../utils/contracts";
import { verifyContract } from "../utils/verify";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { getNamedAccounts, getChainId, deployments } = hre;
  const { deploy, get } = deployments;
  const { owner } = await getNamedAccounts();
  const chainId = await getChainId();

  // Get the address of the token
  const token = await get("MockToken");

  type ConstructorParams = [Address, Address];
  const args: ConstructorParams = [owner, token.address];

  await preDeploy(owner, "Auction");
  const deployResult: DeployResult = await deploy("Auction", {
    // Learn more about args here: https://www.npmjs.com/package/hardhat-deploy#deploymentsdeploy
    from: owner,
    args: args,
    log: true,
    // waitConfirmations: 5,
  });

  // You don't want to verify on localhost
  if (chainId !== "31337" && chainId !== "1337") {
    const contractPath = `contracts/Auction.sol:Auction`;
    await verifyContract({
      contractPath: contractPath,
      contractAddress: deployResult.address,
      args: deployResult.args || [],
    });
  }
};

export default func;
func.id = "deploy_auction";
func.tags = ["Auction"];
func.dependencies = ["deploy_mock_token"];
