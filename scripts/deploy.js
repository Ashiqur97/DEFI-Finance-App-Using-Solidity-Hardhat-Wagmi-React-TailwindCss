const {ethers} = require("hardhat");

async function main() {
    const [deployer] = await ethers.getSigners();

    console.log("Deploying contracts with the account", deployer.address);

    const Token = await ethers.getContractFactory("Token");
    
    const collateralToken = await Token.deploy("Collateral Token","CT");

    await collateralToken.deployed();

    const borrowToken = await Token.deploy("Borrow Token","BT");
    await borrowToken.deployed();
    console.log("Borrow Token deployed to", borrowToken.address);

    const PriceOracle = await ethers.getContractFactory("PriceOracle");
    const priceOracle = await PriceOracle.deploy();
    await priceOracle.deployed();
    console.log("Price Oracle deployed to:",priceOracle.address);
    
    
    await priceOracle.setPrice(collateralToken.address, ethers.utils.parseUnits("1", 18));
    await priceOracle.setPrice(borrowToken.address, ethers.utils.parseUnits("1", 18));

    const Lending = await ethers.getContractFactory("Lending");
    const lending = await Lending.deploy(
        collateralToken.address,
        borrowToken.address,
        priceOracle.address
    );
    await lending.deployed();
    console.log("Lending deployed to:",lending.address);

    const Swap = await ethers.getContractFactory("Swap");
    const swap = await Swap.deploy(
        collateralToken.address,
        borrowToken.address,
        priceOracle.address
    );

    await swap.deployed();
    console.log("Swap deployed to:", swap.address);

    
}