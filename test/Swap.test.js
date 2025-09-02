const {expect} = require("chai");
const {ethers} = require("hardhat");

describe ("Swap", function () {
    let Swap;
    let Token;
    let PriceOracle;
    let swap;
    let tokenA;
    let tokenB;
    let priceOracle;
    let owner;
    let user;

    beforeEach( async function () {
        [owner,user] = await ethers.getSigners();

        Token = await ethers.getContractFactory("Token");
        tokenA = await Token.deploy("Token A","TA");
        tokenA = await Token.deploy("Token A","TA");
        await tokenA.deployed();

        tokenB = await Token.deploy("Token B","TB");
        await tokenB.deployed();
    })

})