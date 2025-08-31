const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Lending", function () {
  let Lending;
  let Token;
  let PriceOracle;
  let lending;
  let collateralToken;
  let borrowToken;
  let priceOracle;
  let owner;
  let borrower;
  let liquidator;

  beforeEach(async function () {
    [owner, borrower, liquidator] = await ethers.getSigners();
    
    Token = await ethers.getContractFactory("Token");
    collateralToken = await Token.deploy("Collateral Token", "CT");
    await collateralToken.deployed();
    
    borrowToken = await Token.deploy("Borrow Token", "BT");
    await borrowToken.deployed();
    
    PriceOracle = await ethers.getContractFactory("PriceOracle");
    priceOracle = await PriceOracle.deploy();
    await priceOracle.deployed();
    
    // Set prices (1 Token = 1 USD)
    await priceOracle.setPrice(collateralToken.address, ethers.utils.parseUnits("1", 18));
    await priceOracle.setPrice(borrowToken.address, ethers.utils.parseUnits("1", 18));
    
    Lending = await ethers.getContractFactory("Lending");
    lending = await Lending.deploy(
      collateralToken.address,
      borrowToken.address,
      priceOracle.address
    );
    await lending.deployed();
    
    // Mint tokens to borrower and liquidator
    await collateralToken.mint(borrower.address, ethers.utils.parseUnits("1000", 18));
    await borrowToken.mint(borrower.address, ethers.utils.parseUnits("1000", 18));
    await borrowToken.mint(liquidator.address, ethers.utils.parseUnits("1000", 18));
    
    // Approve lending contract
    await collateralToken.connect(borrower).approve(lending.address, ethers.utils.parseUnits("1000", 18));
    await borrowToken.connect(borrower).approve(lending.address, ethers.utils.parseUnits("1000", 18));
    await borrowToken.connect(liquidator).approve(lending.address, ethers.utils.parseUnits("1000", 18));
  });

  describe("Deposit", function () {
    it("Should deposit collateral tokens", async function () {
      await lending.connect(borrower).deposit(ethers.utils.parseUnits("100", 18));
      
      expect(await collateralToken.balanceOf(borrower.address)).to.equal(ethers.utils.parseUnits("900", 18));
      expect((await lending.users(borrower.address)).collateralDeposited).to.equal(ethers.utils.parseUnits("100", 18));
    });

    it("Should fail if deposit amount is zero", async function () {
      await expect(
        lending.connect(borrower).deposit(0)
      ).to.be.revertedWith("Amount must be > 0");
    });
  });

  describe("Borrow", function () {
    beforeEach(async function () {
      await lending.connect(borrower).deposit(ethers.utils.parseUnits("100", 18));
    });

    it("Should borrow tokens", async function () {
      await lending.connect(borrower).borrow(ethers.utils.parseUnits("50", 18));
      
      expect(await borrowToken.balanceOf(borrower.address)).to.equal(ethers.utils.parseUnits("1050", 18));
      expect((await lending.users(borrower.address)).amountBorrowed).to.equal(ethers.utils.parseUnits("50", 18));
    });

    it("Should not borrow more than collateral allows", async function () {
      await expect(
        lending.connect(borrower).borrow(ethers.utils.parseUnits("76", 18))
      ).to.be.revertedWith("Exceeds borrowing limit");
    });

    it("Should fail if borrow amount is zero", async function () {
      await expect(
        lending.connect(borrower).borrow(0)
      ).to.be.revertedWith("Amount must be > 0");
    });
  });

  describe("Repay", function () {
    beforeEach(async function () {
      await lending.connect(borrower).deposit(ethers.utils.parseUnits("100", 18));
      await lending.connect(borrower).borrow(ethers.utils.parseUnits("50", 18));
    });

    it("Should repay borrowed tokens", async function () {
      await lending.connect(borrower).repay(ethers.utils.parseUnits("50", 18));
      
      expect((await lending.users(borrower.address)).amountBorrowed).to.equal(0);
    });

    it("Should fail if repay amount is zero", async function () {
      await expect(
        lending.connect(borrower).repay(0)
      ).to.be.revertedWith("Amount must be > 0");
    });

    it("Should fail if repaying more than debt", async function () {
      await expect(
        lending.connect(borrower).repay(ethers.utils.parseUnits("100", 18))
      ).to.be.revertedWith("Repaying more than debt");
    });
  });

  describe("Withdraw", function () {
    beforeEach(async function () {
      await lending.connect(borrower).deposit(ethers.utils.parseUnits("100", 18));
    });

    it("Should withdraw collateral tokens", async function () {
      await lending.connect(borrower).withdraw(ethers.utils.parseUnits("50", 18));
      
      expect(await collateralToken.balanceOf(borrower.address)).to.equal(ethers.utils.parseUnits("950", 18));
      expect((await lending.users(borrower.address)).collateralDeposited).to.equal(ethers.utils.parseUnits("50", 18));
    });

    it("Should fail if withdraw amount is zero", async function () {
      await expect(
        lending.connect(borrower).withdraw(0)
      ).to.be.revertedWith("Amount must be > 0");
    });

    it("Should fail if withdrawing more than deposited", async function () {
      await expect(
        lending.connect(borrower).withdraw(ethers.utils.parseUnits("150", 18))
      ).to.be.revertedWith("Insufficient collateral");
    });
  });

  describe("Liquidation", function () {
    beforeEach(async function () {
      await lending.connect(borrower).deposit(ethers.utils.parseUnits("100", 18));
      await lending.connect(borrower).borrow(ethers.utils.parseUnits("75", 18));
      
      // Simulate price drop to make position liquidatable
      await priceOracle.setPrice(collateralToken.address, ethers.utils.parseUnits("0.8", 18));
    });

    it("Should liquidate undercollateralized position", async function () {
      await lending.connect(liquidator).liquidate(borrower.address, ethers.utils.parseUnits("50", 18));
      
      expect((await lending.users(borrower.address)).amountBorrowed).to.equal(ethers.utils.parseUnits("25", 18));
      expect((await lending.users(borrower.address)).collateralDeposited).to.equal(ethers.utils.parseUnits("47.5", 18)); // 100 - (50 * 1.05)
    });

    it("Should fail if liquidating own position", async function () {
      await expect(
        lending.connect(borrower).liquidate(borrower.address, ethers.utils.parseUnits("50", 18))
      ).to.be.revertedWith("Cannot liquidate own position");
    });

    it("Should fail if borrower has no debt", async function () {
      // First repay all debt
      await borrowToken.connect(borrower).approve(lending.address, ethers.utils.parseUnits("75", 18));
      await lending.connect(borrower).repay(ethers.utils.parseUnits("75", 18));
      
      await expect(
        lending.connect(liquidator).liquidate(borrower.address, ethers.utils.parseUnits("50", 18))
      ).to.be.revertedWith("Borrower has no debt");
    });
  });

  describe("Health Factor", function () {
    it("Should return correct health factor", async function () {
      await lending.connect(borrower).deposit(ethers.utils.parseUnits("100", 18));
      await lending.connect(borrower).borrow(ethers.utils.parseUnits("50", 18));
      
      const healthFactor = await lending.getUserHealthFactor(borrower.address);
      // Collateral factor is 75%, so health factor should be 150%
      expect(healthFactor).to.equal(15000); // 150% in basis points
    });

    it("Should return 100% if no borrow", async function () {
      await lending.connect(borrower).deposit(ethers.utils.parseUnits("100", 18));
      
      const healthFactor = await lending.getUserHealthFactor(borrower.address);
      expect(healthFactor).to.equal(10000); // 100% in basis points
    });
  });
});