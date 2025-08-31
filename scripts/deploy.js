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

    
}