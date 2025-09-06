const {expect} = require("chai");
const {ethers} = require("hardhat");

describe("PriceOracle",function() {
    let PriceOracle;
    let priceOracle;
    let owner;
    let user;
    let token;


    beforeEach(async function () {
        [owner,user] = await ethers.getSigners();

        PriceOracle = await ethers.getContractFactory("PriceOracle");
        priceOracle = await PriceOracle.deploy();
    })

})