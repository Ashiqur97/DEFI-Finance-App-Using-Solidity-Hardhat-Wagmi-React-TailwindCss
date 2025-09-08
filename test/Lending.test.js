const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Lending", function () {
  let LendingPool, PriceOracle, Token, tokenA, tokenB, lendingPool, priceOracle;
  let owner, borrower, liquidator;

  beforeEach(async function () {
    [owner, borrower, liquidator] = await ethers.getSigners();
    
    // Deploy PriceOracle
    PriceOracle = await ethers.getContractFactory("PriceOracle");
    priceOracle = await PriceOracle.deploy();
    await priceOracle.deployed();
    
    // Deploy Tokens
    Token = await ethers.getContractFactory("Token");
    tokenA = await Token.deploy("Token A", "TKNA", 1000000);
    await tokenA.deployed();
    
    tokenB = await Token.deploy("Token B", "TKNB", 1000000);
    await tokenB.deployed();
    
    // Set prices
    await priceOracle.setPrice(tokenA.address, ethers.utils.parseEther("1"));
    await priceOracle.setPrice(tokenB.address, ethers.utils.parseEther("2"));
    
    // Deploy LendingPool
    LendingPool = await ethers.getContractFactory("LendingPool");
    lendingPool = await LendingPool.deploy(priceOracle.address);
    await lendingPool.deployed();
    
    // Configure LendingPool
    await lendingPool.addSupportedToken(tokenA.address);
    await lendingPool.addSupportedToken(tokenB.address);
    await lendingPool.setCollateralFactor(tokenA.address, ethers.utils.parseEther("0.75"));
    await lendingPool.setCollateralFactor(tokenB.address, ethers.utils.parseEther("0.5"));
    
    // Transfer tokens to users
    await tokenA.transfer(borrower.address, ethers.utils.parseEther("1000"));
    await tokenB.transfer(borrower.address, ethers.utils.parseEther("500"));
    
    // Transfer tokens to LendingPool for liquidity
    await tokenA.transfer(lendingPool.address, ethers.utils.parseEther("10000"));
    await tokenB.transfer(lendingPool.address, ethers.utils.parseEther("5000"));
  });

  describe("Deposit", function () {
    it("Should deposit collateral tokens", async function () {
      const depositAmount = ethers.utils.parseEther("100");
      await tokenA.connect(borrower).approve(lendingPool.address, depositAmount);
      await lendingPool.connect(borrower).deposit(tokenA.address, depositAmount);
      
      expect(await lendingPool.getDepositBalance(borrower.address, tokenA.address)).to.equal(depositAmount);
    });

    it("Should fail if deposit amount is zero", async function () {
      await expect(
        lendingPool.connect(borrower).deposit(tokenA.address, 0)
      ).to.be.revertedWith("Amount must be > 0");
    });
  });

  describe("Borrow", function () {
    it("Should borrow tokens", async function () {
      // Deposit collateral first
      const depositAmount = ethers.utils.parseEther("100");
      await tokenA.connect(borrower).approve(lendingPool.address, depositAmount);
      await lendingPool.connect(borrower).deposit(tokenA.address, depositAmount);
      
      // Borrow tokens
      const borrowAmount = ethers.utils.parseEther("30");
      await lendingPool.connect(borrower).borrow(tokenB.address, borrowAmount);
      
      expect(await lendingPool.getBorrowBalance(borrower.address, tokenB.address)).to.equal(borrowAmount);
    });

    it("Should not borrow more than collateral allows", async function () {
      // Deposit collateral first
      const depositAmount = ethers.utils.parseEther("100");
      await tokenA.connect(borrower).approve(lendingPool.address, depositAmount);
      await lendingPool.connect(borrower).deposit(tokenA.address, depositAmount);
      
      // Try to borrow more than allowed
      const borrowAmount = ethers.utils.parseEther("100");
      await expect(
        lendingPool.connect(borrower).borrow(tokenB.address, borrowAmount)
      ).to.be.revertedWith("Insufficient collateral");
    });

    it("Should fail if no collateral deposited", async function () {
      // Try to borrow without depositing collateral
      const borrowAmount = ethers.utils.parseEther("30");
      await expect(
        lendingPool.connect(borrower).borrow(tokenB.address, borrowAmount)
      ).to.be.revertedWith("Insufficient collateral");
    });

    it("Should fail if borrow amount is zero", async function () {
      // Deposit collateral first
      const depositAmount = ethers.utils.parseEther("100");
      await tokenA.connect(borrower).approve(lendingPool.address, depositAmount);
      await lendingPool.connect(borrower).deposit(tokenA.address, depositAmount);
      
      // Try to borrow zero amount
      await expect(
        lendingPool.connect(borrower).borrow(tokenB.address, 0)
      ).to.be.revertedWith("Amount must be > 0");
    });
  });

  describe("Repay", function () {
    beforeEach(async function () {
      // Deposit collateral
      const depositAmount = ethers.utils.parseEther("100");
      await tokenA.connect(borrower).approve(lendingPool.address, depositAmount);
      await lendingPool.connect(borrower).deposit(tokenA.address, depositAmount);
      
      // Borrow tokens
      const borrowAmount = ethers.utils.parseEther("30");
      await lendingPool.connect(borrower).borrow(tokenB.address, borrowAmount);
      
      // Transfer tokens to borrower for repayment
      await tokenB.transfer(borrower.address, ethers.utils.parseEther("100"));
    });

    it("Should repay borrowed tokens", async function () {
      const repayAmount = ethers.utils.parseEther("30");
      await tokenB.connect(borrower).approve(lendingPool.address, repayAmount);
      await lendingPool.connect(borrower).repay(tokenB.address, repayAmount);
      
      expect(await lendingPool.getBorrowBalance(borrower.address, tokenB.address)).to.equal(0);
    });

    it("Should fail if repay amount is zero", async function () {
      await expect(
        lendingPool.connect(borrower).repay(tokenB.address, 0)
      ).to.be.revertedWith("Repay amount exceeds borrow");
    });

    it("Should fail if repaying more than debt", async function () {
      const repayAmount = ethers.utils.parseEther("50"); // More than borrowed
      await tokenB.connect(borrower).approve(lendingPool.address, repayAmount);
      
      await expect(
        lendingPool.connect(borrower).repay(tokenB.address, repayAmount)
      ).to.be.revertedWith("Repay amount exceeds borrow");
    });
  });

  describe("Withdraw", function () {
    beforeEach(async function () {
      // Deposit collateral
      const depositAmount = ethers.utils.parseEther("100");
      await tokenA.connect(borrower).approve(lendingPool.address, depositAmount);
      await lendingPool.connect(borrower).deposit(tokenA.address, depositAmount);
    });

    it("Should withdraw collateral tokens", async function () {
      const withdrawAmount = ethers.utils.parseEther("50");
      await lendingPool.connect(borrower).withdraw(tokenA.address, withdrawAmount);
      
      expect(await lendingPool.getDepositBalance(borrower.address, tokenA.address)).to.equal(
        ethers.utils.parseEther("50")
      );
    });

    it("Should fail if withdraw amount is zero", async function () {
      await expect(
        lendingPool.connect(borrower).withdraw(tokenA.address, 0)
      ).to.be.revertedWith("Insufficient deposit");
    });

    it("Should fail if withdrawing more than deposited", async function () {
      const withdrawAmount = ethers.utils.parseEther("150"); // More than deposited
      await expect(
        lendingPool.connect(borrower).withdraw(tokenA.address, withdrawAmount)
      ).to.be.revertedWith("Insufficient deposit");
    });
  });

  describe("Liquidation", function () {
    beforeEach(async function () {
      // Deposit collateral
      const depositAmount = ethers.utils.parseEther("100");
      await tokenA.connect(borrower).approve(lendingPool.address, depositAmount);
      await lendingPool.connect(borrower).deposit(tokenA.address, depositAmount);
      
      // Borrow tokens
      const borrowAmount = ethers.utils.parseEther("70");
      await lendingPool.connect(borrower).borrow(tokenB.address, borrowAmount);
      
      // Transfer tokens to liquidator for liquidation
      await tokenB.transfer(liquidator.address, ethers.utils.parseEther("100"));
    });

    it("Should liquidate undercollateralized position", async function () {
      // Simulate price drop to make position liquidatable
      await priceOracle.setPrice(tokenA.address, ethers.utils.parseEther("0.5"));
      
      // Liquidate
      const liquidationAmount = ethers.utils.parseEther("35"); // 50% of borrow
      await tokenB.connect(liquidator).approve(lendingPool.address, liquidationAmount);
      await lendingPool.connect(liquidator).liquidate(borrower.address, tokenB.address);
      
      // Check borrow balance is reduced
      expect(await lendingPool.getBorrowBalance(borrower.address, tokenB.address)).to.equal(
        ethers.utils.parseEther("35")
      );
    });

    it("Should fail if liquidating own position", async function () {
      // Simulate price drop to make position liquidatable
      await priceOracle.setPrice(tokenA.address, ethers.utils.parseEther("0.5"));
      
      // Try to liquidate own position
      const liquidationAmount = ethers.utils.parseEther("35");
      await tokenB.connect(borrower).approve(lendingPool.address, liquidationAmount);
      
      await expect(
        lendingPool.connect(borrower).liquidate(borrower.address, tokenB.address)
      ).to.be.revertedWith("Cannot liquidate own position");
    });

    it("Should fail if borrower has no debt", async function () {
      // Create a user with no debt
      const noDebtUser = ethers.Wallet.createRandom().connect(ethers.provider);
      
      // Try to liquidate user with no debt
      const liquidationAmount = ethers.utils.parseEther("35");
      await tokenB.connect(liquidator).approve(lendingPool.address, liquidationAmount);
      
      await expect(
        lendingPool.connect(liquidator).liquidate(noDebtUser.address, tokenB.address)
      ).to.be.revertedWith("Borrower has no debt");
    });
  });

  describe("Health Factor", function () {
    it("Should return correct health factor", async function () {
      // Deposit collateral
      const depositAmount = ethers.utils.parseEther("100");
      await tokenA.connect(borrower).approve(lendingPool.address, depositAmount);
      await lendingPool.connect(borrower).deposit(tokenA.address, depositAmount);
      
      // Borrow tokens
      const borrowAmount = ethers.utils.parseEther("30");
      await lendingPool.connect(borrower).borrow(tokenB.address, borrowAmount);
      
      // Health factor should be: (100 * 1 * 0.75) / (30 * 2) = 75 / 60 = 1.25
      const healthFactor = await lendingPool.getHealthFactor(borrower.address);
      expect(healthFactor).to.equal(ethers.utils.parseEther("1.25"));
    });

    it("Should return 100% if no borrow", async function () {
      // Deposit collateral
      const depositAmount = ethers.utils.parseEther("100");
      await tokenA.connect(borrower).approve(lendingPool.address, depositAmount);
      await lendingPool.connect(borrower).deposit(tokenA.address, depositAmount);
      
      // Health factor should be 1 (100%) if no borrow
      const healthFactor = await lendingPool.getHealthFactor(borrower.address);
      expect(healthFactor).to.equal(ethers.utils.parseEther("1"));
    });

    it("Should be liquidatable when health factor < 100%", async function () {
      // Deposit collateral
      const depositAmount = ethers.utils.parseEther("100");
      await tokenA.connect(borrower).approve(lendingPool.address, depositAmount);
      await lendingPool.connect(borrower).deposit(tokenA.address, depositAmount);
      
      // Borrow tokens to make health factor close to 1
      const borrowAmount = ethers.utils.parseEther("37"); // This should make health factor < 1
      await lendingPool.connect(borrower).borrow(tokenB.address, borrowAmount);
      
      // Check health factor is below 1
      const healthFactor = await lendingPool.getHealthFactor(borrower.address);
      expect(healthFactor).to.be.lt(ethers.utils.parseEther("1"));
    });
  });
});