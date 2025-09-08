const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("PriceOracle", function () {
  let PriceOracle, priceOracle, owner, addr1, tokenA, tokenB;

  beforeEach(async function () {
    PriceOracle = await ethers.getContractFactory("PriceOracle");
    [owner, addr1] = await ethers.getSigners();
    priceOracle = await PriceOracle.deploy();
    await priceOracle.deployed();
    
    // Mock token addresses
    tokenA = "0x1234567890123456789012345678901234567890";
    tokenB = "0x0987654321098765432109876543210987654321";
  });

  describe("Price Management", function () {
    it("Should allow owner to set price", async function () {
      await priceOracle.setPrice(tokenA, ethers.utils.parseEther("1"));
      expect(await priceOracle.getPrice(tokenA)).to.equal(ethers.utils.parseEther("1"));
    });

    it("Should fail if non-owner tries to set price", async function () {
      await expect(
        priceOracle.connect(addr1).setPrice(tokenA, ethers.utils.parseEther("1"))
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should fail if price is zero", async function () {
      await expect(
        priceOracle.setPrice(tokenA, 0)
      ).to.be.revertedWith("Price must be > 0");
    });

    it("Should emit PriceUpdated event", async function () {
      await expect(priceOracle.setPrice(tokenA, ethers.utils.parseEther("1")))
        .to.emit(priceOracle, "PriceUpdated")
        .withArgs(tokenA, ethers.utils.parseEther("1"));
    });
  });

  describe("Get Price", function () {
    it("Should return zero for token without price", async function () {
      expect(await priceOracle.getPrice(tokenA)).to.equal(0);
    });

    it("Should return correct price after setting", async function () {
      await priceOracle.setPrice(tokenA, ethers.utils.parseEther("1"));
      expect(await priceOracle.getPrice(tokenA)).to.equal(ethers.utils.parseEther("1"));
    });
  });
});