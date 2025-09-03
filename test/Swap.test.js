const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Swap", function () {
  let Swap;
  let Token;
  let PriceOracle;
  let swap;
  let tokenA;
  let tokenB;
  let priceOracle;
  let owner;
  let user;

  beforeEach(async function () {
    [owner, user] = await ethers.getSigners();
    
    Token = await ethers.getContractFactory("Token");
    tokenA = await Token.deploy("Token A", "TA");
    await tokenA.deployed();
    
    tokenB = await Token.deploy("Token B", "TB");
    await tokenB.deployed();
    
    PriceOracle = await ethers.getContractFactory("PriceOracle");
    priceOracle = await PriceOracle.deploy();
    await priceOracle.deployed();
    
    // Set prices (1 Token = 1 USD)
    await priceOracle.setPrice(tokenA.address, ethers.utils.parseUnits("1", 18));
    await priceOracle.setPrice(tokenB.address, ethers.utils.parseUnits("1", 18));
    
    Swap = await ethers.getContractFactory("Swap");
    swap = await Swap.deploy(
      tokenA.address,
      tokenB.address,
      priceOracle.address
    );
    await swap.deployed();
    
    // Mint tokens to user
    await tokenA.mint(user.address, ethers.utils.parseUnits("1000", 18));
    await tokenB.mint(user.address, ethers.utils.parseUnits("1000", 18));
    
    // Approve swap contract
    await tokenA.connect(user).approve(swap.address, ethers.utils.parseUnits("1000", 18));
    await tokenB.connect(user).approve(swap.address, ethers.utils.parseUnits("1000", 18));
  });

  describe("Swap", function () {
    it("Should swap tokenA for tokenB", async function () {
      const swapAmount = ethers.utils.parseUnits("100", 18);
      
      await swap.connect(user).swap(tokenA.address, tokenB.address, swapAmount);
      
      expect(await tokenA.balanceOf(user.address)).to.equal(ethers.utils.parseUnits("900", 18));
      expect(await tokenB.balanceOf(user.address)).to.equal(ethers.utils.parseUnits("1099.7", 18)); // 1000 + (100 - 0.3% fee)
    });

    it("Should swap tokenB for tokenA", async function () {
      const swapAmount = ethers.utils.parseUnits("100", 18);
      
      await swap.connect(user).swap(tokenB.address, tokenA.address, swapAmount);
      
      expect(await tokenB.balanceOf(user.address)).to.equal(ethers.utils.parseUnits("900", 18));
      expect(await tokenA.balanceOf(user.address)).to.equal(ethers.utils.parseUnits("1099.7", 18)); // 1000 + (100 - 0.3% fee)
    });

    it("Should fail if swap amount is zero", async function () {
      await expect(
        swap.connect(user).swap(tokenA.address, tokenB.address, 0)
      ).to.be.revertedWith("Amount must be > 0");
    });

    it("Should fail if swapping unsupported tokens", async function () {
      const unsupportedToken = await Token.deploy("Unsupported", "UNS");
      await unsupportedToken.deployed();
      
      await expect(
        swap.connect(user).swap(unsupportedToken.address, tokenB.address, ethers.utils.parseUnits("100", 18))
      ).to.be.revertedWith("Token not supported");
    });

    it("Should fail if swapping same token", async function () {
      await expect(
        swap.connect(user).swap(tokenA.address, tokenA.address, ethers.utils.parseUnits("100", 18))
      ).to.be.revertedWith("Cannot swap same token");
    });
  });

  describe("Fee Management", function () {
    it("Should allow owner to set fee rate", async function () {
      await swap.setFeeRate(50); // 0.5%
      
      expect(await swap.feeRate()).to.equal(50);
    });

    it("Should fail if non-owner tries to set fee rate", async function () {
      await expect(
        swap.connect(user).setFeeRate(50)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should fail if fee rate exceeds maximum", async function () {
      await expect(
        swap.setFeeRate(600) // 6% > 5% max
      ).to.be.revertedWith("Fee cannot exceed 5%");
    });
  });

  describe("Token Management", function () {
    it("Should allow owner to add supported token", async function () {
      const newToken = await Token.deploy("New Token", "NT");
      await newToken.deployed();
      
      await swap.addSupportedToken(newToken.address);
      
      expect(await swap.supportedTokens(newToken.address)).to.equal(true);
    });

    it("Should allow owner to remove supported token", async function () {
      await swap.removeSupportedToken(tokenA.address);
      
      expect(await swap.supportedTokens(tokenA.address)).to.equal(false);
    });

    it("Should fail if non-owner tries to add supported token", async function () {
      const newToken = await Token.deploy("New Token", "NT");
      await newToken.deployed();
      
      await expect(
        swap.connect(user).addSupportedToken(newToken.address)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });
});