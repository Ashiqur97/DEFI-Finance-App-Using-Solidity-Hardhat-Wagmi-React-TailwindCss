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
  await collateralToken.deployed();
  console.log("Collateral Token deployed to:", collateralToken.address);
  
  // Borrow Token (e.g., USDC-like)
  const borrowToken = await Token.deploy("Borrow Token", "BTK");
  await borrowToken.deployed();
  console.log("Borrow Token deployed to:", borrowToken.address);

  // Deploy PriceOracle
  console.log("\nDeploying PriceOracle...");
  const PriceOracle = await ethers.getContractFactory("PriceOracle");
  const priceOracle = await PriceOracle.deploy();
  await priceOracle.deployed();
  console.log("PriceOracle deployed to:", priceOracle.address);

  // Set initial prices (1:1 for simplicity)
  const price = ethers.utils.parseUnits("1", 18); // $1 per token
  await priceOracle.setPrice(collateralToken.address, price);
  await priceOracle.setPrice(borrowToken.address, price);
  console.log("Initial token prices set to $1");

  // Deploy Timelock (with 2-day delay in minutes)
  console.log("\nDeploying Timelock...");
  const Timelock = await ethers.getContractFactory("Timelock");
  const delayMinutes = 2880; // 2 days in minutes
  const timelock = await Timelock.deploy(delayMinutes);
  await timelock.deployed();
  console.log("Timelock deployed to:", timelock.address);
  console.log("Timelock delay set to", delayMinutes, "minutes (2 days)");

  // Deploy Swap contract
  console.log("\nDeploying Swap contract...");
  const Swap = await ethers.getContractFactory("Swap");
  const swap = await Swap.deploy(
    collateralToken.address,
    borrowToken.address,
    priceOracle.address
  );
  await swap.deployed();
  console.log("Swap deployed to:", swap.address);

  // Deploy Lending contract
  console.log("\nDeploying Lending contract...");
  const Lending = await ethers.getContractFactory("Lending");
  const lending = await Lending.deploy(
    collateralToken.address,
    borrowToken.address,
    priceOracle.address,
    timelock.address
  );
  await lending.deployed();
  console.log("Lending deployed to:", lending.address);

  // Set pause admin and fee collector in Lending contract
  console.log("\nSetting admin roles in Lending contract...");
  await lending.setPauseAdmin(pauseAdmin.address);
  await lending.setFeeCollector(feeCollector.address);
  console.log("Pause admin set to:", pauseAdmin.address);
  console.log("Fee collector set to:", feeCollector.address);

  // Mint tokens to deployer for testing
  console.log("\nMinting tokens to deployer...");
  const mintAmount = ethers.utils.parseUnits("10000", 18);
  await collateralToken.mint(deployer.address, mintAmount);
  await borrowToken.mint(deployer.address, mintAmount);
  console.log("Minted 10,000 Collateral Tokens and 10,000 Borrow Tokens to deployer");

  // Mint tokens to Swap contract for liquidity
  console.log("\nMinting tokens to Swap contract for liquidity...");
  await collateralToken.mint(swap.address, mintAmount);
  await borrowToken.mint(swap.address, mintAmount);
  console.log("Minted 10,000 Collateral Tokens and 10,000 Borrow Tokens to Swap contract");

  // Display deployment summary
  console.log("\n=== DEPLOYMENT SUMMARY ===");
  console.log("Collateral Token (CTK):", collateralToken.address);
  console.log("Borrow Token (BTK):", borrowToken.address);
  console.log("PriceOracle:", priceOracle.address);
  console.log("Timelock:", timelock.address);
  console.log("Swap:", swap.address);
  console.log("Lending:", lending.address);
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