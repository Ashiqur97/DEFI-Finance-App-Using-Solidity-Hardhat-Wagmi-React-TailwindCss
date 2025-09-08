const { ethers } = require("hardhat");

async function main() {
  // Get signers
  const [deployer, pauseAdmin, feeCollector] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);
  console.log("Pause admin:", pauseAdmin.address);
  console.log("Fee collector:", feeCollector.address);

  // Deploy Tokens
  console.log("\nDeploying Tokens...");
  const Token = await ethers.getContractFactory("Token");
  
  // Collateral Token (e.g., DAI-like)
  const collateralToken = await Token.deploy("Collateral Token", "CTK");
  await collateralToken.waitForDeployment();
  console.log("Collateral Token deployed to:", collateralToken.target);
  
  // Borrow Token (e.g., USDC-like)
  const borrowToken = await Token.deploy("Borrow Token", "BTK");
  await borrowToken.waitForDeployment();
  console.log("Borrow Token deployed to:", borrowToken.target);

  // Deploy PriceOracle
  console.log("\nDeploying PriceOracle...");
  const PriceOracle = await ethers.getContractFactory("PriceOracle");
  const priceOracle = await PriceOracle.deploy();
  await priceOracle.waitForDeployment();
  console.log("PriceOracle deployed to:", priceOracle.target);

  // Set initial prices (1:1 for simplicity)
  const price = ethers.parseUnits("1", 18); // $1 per token
  await priceOracle.setPrice(collateralToken.target, price);
  await priceOracle.setPrice(borrowToken.target, price);
  console.log("Initial token prices set to $1");

  // Deploy Timelock (with 2-day delay in minutes)
  console.log("\nDeploying Timelock...");
  const Timelock = await ethers.getContractFactory("Timelock");
  const delayMinutes = 2880; // 2 days in minutes
  const timelock = await Timelock.deploy(delayMinutes);
  await timelock.waitForDeployment();
  console.log("Timelock deployed to:", timelock.target);
  console.log("Timelock delay set to", delayMinutes, "minutes (2 days)");

  // Deploy Swap contract
  console.log("\nDeploying Swap contract...");
  const Swap = await ethers.getContractFactory("Swap");
  const swap = await Swap.deploy(
    collateralToken.target,
    borrowToken.target,
    priceOracle.target
  );
  await swap.waitForDeployment();
  console.log("Swap deployed to:", swap.target);

  // Deploy Lending contract
  console.log("\nDeploying Lending contract...");
  const Lending = await ethers.getContractFactory("Lending");
  const lending = await Lending.deploy(
    collateralToken.target,
    borrowToken.target,
    priceOracle.target,
    timelock.target
  );
  await lending.waitForDeployment();
  console.log("Lending deployed to:", lending.target);

  // Set pause admin and fee collector in Lending contract
  console.log("\nSetting admin roles in Lending contract...");
  await lending.setPauseAdmin(pauseAdmin.address);
  await lending.setFeeCollector(feeCollector.address);
  console.log("Pause admin set to:", pauseAdmin.address);
  console.log("Fee collector set to:", feeCollector.address);

  // Mint tokens to deployer for testing
  console.log("\nMinting tokens to deployer...");
  const mintAmount = ethers.parseUnits("10000", 18);
  await collateralToken.mint(deployer.address, mintAmount);
  await borrowToken.mint(deployer.address, mintAmount);
  console.log("Minted 10,000 Collateral Tokens and 10,000 Borrow Tokens to deployer");

  // Mint tokens to Swap contract for liquidity
  console.log("\nMinting tokens to Swap contract for liquidity...");
  await collateralToken.mint(swap.target, mintAmount);
  await borrowToken.mint(swap.target, mintAmount);
  console.log("Minted 10,000 Collateral Tokens and 10,000 Borrow Tokens to Swap contract");

  // Display deployment summary
  console.log("\n=== DEPLOYMENT SUMMARY ===");
  console.log("Collateral Token (CTK):", collateralToken.target);
  console.log("Borrow Token (BTK):", borrowToken.target);
  console.log("PriceOracle:", priceOracle.target);
  console.log("Timelock:", timelock.target);
  console.log("Swap:", swap.target);
  console.log("Lending:", lending.target);
  console.log("Pause Admin:", pauseAdmin.address);
  console.log("Fee Collector:", feeCollector.address);
  console.log("Timelock Delay:", delayMinutes, "minutes (2 days)");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });