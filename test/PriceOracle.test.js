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
        await priceOracle.deployed();

        const Token = await ethers.getContractFactory("Token");
        token = await Token.deploy("Test Token","TT");
        await token.deployed();
    });


  describe("Price Management", function () {
    it("Should allow owner to set price", async function () {
      await priceOracle.setPrice(token.address, ethers.utils.parseUnits("1", 18));
      
      expect(await priceOracle.getPrice(token.address)).to.equal(ethers.utils.parseUnits("1", 18));
    });

})