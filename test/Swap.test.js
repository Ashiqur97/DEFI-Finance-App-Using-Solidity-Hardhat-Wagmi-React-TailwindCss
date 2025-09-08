const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Swap", function () {
  let DexRouter, PriceOracle, Token, tokenA, tokenB, tokenC, dexRouter, priceOracle;
  let owner, trader, liquidityProvider;
  let initialTokenABalance, initialTokenBBalance;

  beforeEach(async function () {
    [owner, trader, liquidityProvider] = await ethers.getSigners();
    
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
    
    tokenC = await Token.deploy("Token C", "TKNC", 1000000);
    await tokenC.deployed();
    
    // Set prices
    await priceOracle.setPrice(tokenA.address, ethers.utils.parseEther("1"));  // $1 per tokenA
    await priceOracle.setPrice(tokenB.address, ethers.utils.parseEther("2"));  // $2 per tokenB
    await priceOracle.setPrice(tokenC.address, ethers.utils.parseEther("0.5")); // $0.5 per tokenC
    
    // Deploy DexRouter
    DexRouter = await ethers.getContractFactory("DexRouter");
    dexRouter = await DexRouter.deploy(priceOracle.address);
    await dexRouter.deployed();
    
    // Configure DexRouter
    await dexRouter.addSupportedToken(tokenA.address);
    await dexRouter.addSupportedToken(tokenB.address);
    await dexRouter.addSupportedToken(tokenC.address);
    
    // Transfer tokens to trader
    initialTokenABalance = ethers.utils.parseEther("1000");
    initialTokenBBalance = ethers.utils.parseEther("500");
    await tokenA.transfer(trader.address, initialTokenABalance);
    await tokenB.transfer(trader.address, initialTokenBBalance);
    
    // Transfer tokens to liquidity provider
    await tokenA.transfer(liquidityProvider.address, ethers.utils.parseEther("10000"));
    await tokenB.transfer(liquidityProvider.address, ethers.utils.parseEther("5000"));
    await tokenC.transfer(liquidityProvider.address, ethers.utils.parseEther("20000"));
    
    // Liquidity provider adds liquidity to router
    await tokenA.connect(liquidityProvider).approve(dexRouter.address, ethers.utils.parseEther("5000"));
    await tokenB.connect(liquidityProvider).approve(dexRouter.address, ethers.utils.parseEther("2500"));
    await tokenC.connect(liquidityProvider).approve(dexRouter.address, ethers.utils.parseEther("10000"));
  });

  describe("Basic Swap Functionality", function () {
    it("Should allow swapping tokenA for tokenB", async function () {
      const amountIn = ethers.utils.parseEther("100");
      const minAmountOut = ethers.utils.parseEther("45");
      
      // Get initial balances
      const traderTokenABefore = await tokenA.balanceOf(trader.address);
      const traderTokenBBefore = await tokenB.balanceOf(trader.address);
      const routerTokenABefore = await tokenA.balanceOf(dexRouter.address);
      const routerTokenBBefore = await tokenB.balanceOf(dexRouter.address);
      
      // Approve and swap
      await tokenA.connect(trader).approve(dexRouter.address, amountIn);
      await dexRouter.connect(trader).swap(
        tokenA.address,
        tokenB.address,
        amountIn,
        minAmountOut
      );
      
      // Get final balances
      const traderTokenAAfter = await tokenA.balanceOf(trader.address);
      const traderTokenBAfter = await tokenB.balanceOf(trader.address);
      const routerTokenAAfter = await tokenA.balanceOf(dexRouter.address);
      const routerTokenBAfter = await tokenB.balanceOf(dexRouter.address);
      
      // Verify balances
      expect(traderTokenAAfter).to.equal(traderTokenABefore.sub(amountIn));
      expect(routerTokenAAfter).to.equal(routerTokenABefore.add(amountIn));
      
      // Calculate expected output (100 * 1 / 2 = 50, minus 0.3% fee = 49.85)
      const expectedOutput = ethers.utils.parseEther("49.85");
      expect(traderTokenBAfter.sub(traderTokenBBefore)).to.be.closeTo(
        expectedOutput,
        ethers.utils.parseEther("0.01")
      );
      expect(routerTokenBBefore.sub(routerTokenBAfter)).to.be.closeTo(
        expectedOutput,
        ethers.utils.parseEther("0.01")
      );
    });

    it("Should allow swapping tokenB for tokenA", async function () {
      const amountIn = ethers.utils.parseEther("50");
      const minAmountOut = ethers.utils.parseEther("90");
      
      // Get initial balances
      const traderTokenBBefore = await tokenB.balanceOf(trader.address);
      const traderTokenABefore = await tokenA.balanceOf(trader.address);
      
      // Approve and swap
      await tokenB.connect(trader).approve(dexRouter.address, amountIn);
      await dexRouter.connect(trader).swap(
        tokenB.address,
        tokenA.address,
        amountIn,
        minAmountOut
      );
      
      // Get final balances
      const traderTokenBAfter = await tokenB.balanceOf(trader.address);
      const traderTokenAAfter = await tokenA.balanceOf(trader.address);
      
      // Verify balances
      expect(traderTokenBAfter).to.equal(traderTokenBBefore.sub(amountIn));
      
      // Calculate expected output (50 * 2 / 1 = 100, minus 0.3% fee = 99.7)
      const expectedOutput = ethers.utils.parseEther("99.7");
      expect(traderTokenAAfter.sub(traderTokenABefore)).to.be.closeTo(
        expectedOutput,
        ethers.utils.parseEther("0.01")
      );
    });

    it("Should allow swapping tokenA for tokenC", async function () {
      const amountIn = ethers.utils.parseEther("100");
      const minAmountOut = ethers.utils.parseEther("190");
      
      // Get initial balances
      const traderTokenABefore = await tokenA.balanceOf(trader.address);
      const traderTokenCBefore = await tokenC.balanceOf(trader.address);
      
      // Approve and swap
      await tokenA.connect(trader).approve(dexRouter.address, amountIn);
      await dexRouter.connect(trader).swap(
        tokenA.address,
        tokenC.address,
        amountIn,
        minAmountOut
      );
      
      // Get final balances
      const traderTokenAAfter = await tokenA.balanceOf(trader.address);
      const traderTokenCAfter = await tokenC.balanceOf(trader.address);
      
      // Verify balances
      expect(traderTokenAAfter).to.equal(traderTokenABefore.sub(amountIn));
      
      // Calculate expected output (100 * 1 / 0.5 = 200, minus 0.3% fee = 199.4)
      const expectedOutput = ethers.utils.parseEther("199.4");
      expect(traderTokenCAfter.sub(traderTokenCBefore)).to.be.closeTo(
        expectedOutput,
        ethers.utils.parseEther("0.01")
      );
    });
  });

  describe("getQuote Function", function () {
    it("Should provide accurate quote for tokenA to tokenB", async function () {
      const amountIn = ethers.utils.parseEther("100");
      const quote = await dexRouter.getQuote(
        tokenA.address,
        tokenB.address,
        amountIn
      );
      
      // Expected: 100 * 1 / 2 = 50, minus 0.3% fee = 49.85
      const expectedQuote = ethers.utils.parseEther("49.85");
      expect(quote).to.be.closeTo(expectedQuote, ethers.utils.parseEther("0.01"));
    });

    it("Should provide accurate quote for tokenB to tokenA", async function () {
      const amountIn = ethers.utils.parseEther("50");
      const quote = await dexRouter.getQuote(
        tokenB.address,
        tokenA.address,
        amountIn
      );
      
      // Expected: 50 * 2 / 1 = 100, minus 0.3% fee = 99.7
      const expectedQuote = ethers.utils.parseEther("99.7");
      expect(quote).to.be.closeTo(expectedQuote, ethers.utils.parseEther("0.01"));
    });

    it("Should provide accurate quote for tokenA to tokenC", async function () {
      const amountIn = ethers.utils.parseEther("100");
      const quote = await dexRouter.getQuote(
        tokenA.address,
        tokenC.address,
        amountIn
      );
      
      // Expected: 100 * 1 / 0.5 = 200, minus 0.3% fee = 199.4
      const expectedQuote = ethers.utils.parseEther("199.4");
      expect(quote).to.be.closeTo(expectedQuote, ethers.utils.parseEther("0.01"));
    });

    it("Should return 0 for unsupported tokens", async function () {
      const unsupportedToken = "0x1111111111111111111111111111111111111111";
      const quote = await dexRouter.getQuote(
        tokenA.address,
        unsupportedToken,
        ethers.utils.parseEther("100")
      );
      
      expect(quote).to.equal(0);
    });

    it("Should handle zero amount input", async function () {
      const quote = await dexRouter.getQuote(
        tokenA.address,
        tokenB.address,
        0
      );
      
      expect(quote).to.equal(0);
    });
  });

  describe("Fee Calculation", function () {
    it("Should charge correct fee percentage", async function () {
      const amountIn = ethers.utils.parseEther("100");
      const feePercentage = await dexRouter.feePercentage();
      
      // Calculate expected output before fee
      const priceA = await priceOracle.getPrice(tokenA.address);
      const priceB = await priceOracle.getPrice(tokenB.address);
      const outputBeforeFee = (amountIn.mul(priceA)).div(priceB);
      
      // Calculate expected fee
      const expectedFee = (outputBeforeFee.mul(feePercentage)).div(10000);
      
      // Get actual quote
      const quote = await dexRouter.getQuote(
        tokenA.address,
        tokenB.address,
        amountIn
      );
      
      // Verify fee is deducted correctly
      const expectedOutput = outputBeforeFee.sub(expectedFee);
      expect(quote).to.equal(expectedOutput);
    });

    it("Should collect fee in router balance", async function () {
      const amountIn = ethers.utils.parseEther("100");
      
      // Get router balance before swap
      const routerTokenBBefore = await tokenB.balanceOf(dexRouter.address);
      
      // Perform swap
      await tokenA.connect(trader).approve(dexRouter.address, amountIn);
      await dexRouter.connect(trader).swap(
        tokenA.address,
        tokenB.address,
        amountIn,
        ethers.utils.parseEther("45")
      );
      
      // Get router balance after swap
      const routerTokenBAfter = await tokenB.balanceOf(dexRouter.address);
      
      // Calculate expected fee
      const priceA = await priceOracle.getPrice(tokenA.address);
      const priceB = await priceOracle.getPrice(tokenB.address);
      const outputBeforeFee = (amountIn.mul(priceA)).div(priceB);
      const feePercentage = await dexRouter.feePercentage();
      const expectedFee = (outputBeforeFee.mul(feePercentage)).div(10000);
      
      // Verify fee was collected
      expect(routerTokenBBefore.sub(routerTokenBAfter)).to.equal(expectedFee);
    });
  });

  describe("Error Handling", function () {
    it("Should revert when swapping unsupported token", async function () {
      const unsupportedToken = "0x1111111111111111111111111111111111111111";
      
      await tokenA.connect(trader).approve(dexRouter.address, ethers.utils.parseEther("100"));
      
      await expect(
        dexRouter.connect(trader).swap(
          tokenA.address,
          unsupportedToken,
          ethers.utils.parseEther("100"),
          ethers.utils.parseEther("45")
        )
      ).to.be.revertedWith("Unsupported token");
    });

    it("Should revert when swapping with zero amount", async function () {
      await tokenA.connect(trader).approve(dexRouter.address, ethers.utils.parseEther("100"));
      
      await expect(
        dexRouter.connect(trader).swap(
          tokenA.address,
          tokenB.address,
          0,
          ethers.utils.parseEther("45")
        )
      ).to.be.revertedWith("Amount must be > 0");
    });

    it("Should revert when slippage is exceeded", async function () {
      const amountIn = ethers.utils.parseEther("100");
      const minAmountOut = ethers.utils.parseEther("60"); // Higher than expected output
      
      await tokenA.connect(trader).approve(dexRouter.address, amountIn);
      
      await expect(
        dexRouter.connect(trader).swap(
          tokenA.address,
          tokenB.address,
          amountIn,
          minAmountOut
        )
      ).to.be.revertedWith("Slippage exceeded");
    });

    it("Should revert when insufficient liquidity", async function () {
      // Use very large amount that exceeds router's balance
      const amountIn = ethers.utils.parseEther("10000");
      
      await tokenA.connect(trader).approve(dexRouter.address, amountIn);
      
      await expect(
        dexRouter.connect(trader).swap(
          tokenA.address,
          tokenB.address,
          amountIn,
          ethers.utils.parseEther("4000")
        )
      ).to.be.reverted; // Will revert due to insufficient tokenB balance in router
    });

    it("Should revert when insufficient allowance", async function () {
      const amountIn = ethers.utils.parseEther("100");
      
      // Don't approve tokens
      await expect(
        dexRouter.connect(trader).swap(
          tokenA.address,
          tokenB.address,
          amountIn,
          ethers.utils.parseEther("45")
        )
      ).to.be.reverted; // Will revert due to insufficient allowance
    });
  });

  describe("Event Emissions", function () {
    it("Should emit Swapped event with correct parameters", async function () {
      const amountIn = ethers.utils.parseEther("100");
      const minAmountOut = ethers.utils.parseEther("45");
      
      // Calculate expected output
      const quote = await dexRouter.getQuote(
        tokenA.address,
        tokenB.address,
        amountIn
      );
      
      await tokenA.connect(trader).approve(dexRouter.address, amountIn);
      
      await expect(
        dexRouter.connect(trader).swap(
          tokenA.address,
          tokenB.address,
          amountIn,
          minAmountOut
        )
      )
        .to.emit(dexRouter, "Swapped")
        .withArgs(
          trader.address,
          tokenA.address,
          tokenB.address,
          amountIn,
          quote
        );
    });
  });

  describe("Multiple Swaps", function () {
    it("Should allow multiple swaps by same user", async function () {
      // First swap: tokenA to tokenB
      const amountIn1 = ethers.utils.parseEther("50");
      await tokenA.connect(trader).approve(dexRouter.address, amountIn1);
      await dexRouter.connect(trader).swap(
        tokenA.address,
        tokenB.address,
        amountIn1,
        ethers.utils.parseEther("20")
      );
      
      // Second swap: tokenB to tokenA
      const amountIn2 = ethers.utils.parseEther("25");
      await tokenB.connect(trader).approve(dexRouter.address, amountIn2);
      await dexRouter.connect(trader).swap(
        tokenB.address,
        tokenA.address,
        amountIn2,
        ethers.utils.parseEther("40")
      );
      
      // Verify final balances
      const traderTokenABalance = await tokenA.balanceOf(trader.address);
      const traderTokenBBalance = await tokenB.balanceOf(trader.address);
      
      // Expected: Started with 1000 tokenA and 500 tokenB
      // After first swap: 950 tokenA, ~524.925 tokenB
      // After second swap: ~999.925 tokenA, ~499.925 tokenB
      expect(traderTokenABalance).to.be.closeTo(
        initialTokenABalance,
        ethers.utils.parseEther("0.1")
      );
      expect(traderTokenBBalance).to.be.closeTo(
        initialTokenBBalance,
        ethers.utils.parseEther("0.1")
      );
    });

    it("Should allow swaps by multiple users", async function () {
      // Setup second trader
      const trader2 = ethers.Wallet.createRandom().connect(ethers.provider);
      await tokenA.transfer(trader2.address, ethers.utils.parseEther("500"));
      
      // Trader1 swaps tokenA to tokenB
      const amountIn1 = ethers.utils.parseEther("100");
      await tokenA.connect(trader).approve(dexRouter.address, amountIn1);
      await dexRouter.connect(trader).swap(
        tokenA.address,
        tokenB.address,
        amountIn1,
        ethers.utils.parseEther("45")
      );
      
      // Trader2 swaps tokenA to tokenB
      const amountIn2 = ethers.utils.parseEther("50");
      await tokenA.connect(trader2).approve(dexRouter.address, amountIn2);
      await dexRouter.connect(trader2).swap(
        tokenA.address,
        tokenB.address,
        amountIn2,
        ethers.utils.parseEther("20")
      );
      
      // Verify both swaps were successful
      const trader1TokenBBalance = await tokenB.balanceOf(trader.address);
      const trader2TokenBBalance = await tokenB.balanceOf(trader2.address);
      
      expect(trader1TokenBBalance).to.be.closeTo(
        initialTokenBBalance.add(ethers.utils.parseEther("49.85")),
        ethers.utils.parseEther("0.01")
      );
      expect(trader2TokenBBalance).to.be.closeTo(
        ethers.utils.parseEther("24.925"),
        ethers.utils.parseEther("0.01")
      );
    });
  });

  describe("Edge Cases", function () {
    it("Should handle very small amounts", async function () {
      const amountIn = ethers.utils.parseEther("0.001");
      const minAmountOut = ethers.utils.parseEther("0.0004");
      
      await tokenA.connect(trader).approve(dexRouter.address, amountIn);
      
      await expect(
        dexRouter.connect(trader).swap(
          tokenA.address,
          tokenB.address,
          amountIn,
          minAmountOut
        )
      ).to.not.be.reverted;
    });

    it("Should handle very large amounts", async function () {
      // Transfer more tokens to trader
      await tokenA.transfer(trader.address, ethers.utils.parseEther("9000"));
      
      const amountIn = ethers.utils.parseEther("1000");
      const minAmountOut = ethers.utils.parseEther("450");
      
      await tokenA.connect(trader).approve(dexRouter.address, amountIn);
      
      await expect(
        dexRouter.connect(trader).swap(
          tokenA.address,
          tokenB.address,
          amountIn,
          minAmountOut
        )
      ).to.not.be.reverted;
    });

    it("Should handle same token swap (should revert)", async function () {
      const amountIn = ethers.utils.parseEther("100");
      
      await tokenA.connect(trader).approve(dexRouter.address, amountIn);
      
      await expect(
        dexRouter.connect(trader).swap(
          tokenA.address,
          tokenA.address,
          amountIn,
          ethers.utils.parseEther("90")
        )
      ).to.be.reverted; // Should revert due to same token
    });
  });

  describe("Fee Percentage Management", function () {
    it("Should allow owner to update fee percentage", async function () {
      const newFeePercentage = 50; // 0.5%
      
      await dexRouter.setFeePercentage(newFeePercentage);
      expect(await dexRouter.feePercentage()).to.equal(newFeePercentage);
    });

    it("Should not allow non-owner to update fee percentage", async function () {
      const newFeePercentage = 50;
      
      await expect(
        dexRouter.connect(trader).setFeePercentage(newFeePercentage)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should apply new fee percentage to swaps", async function () {
      // Update fee to 0.5%
      await dexRouter.setFeePercentage(50);
      
      const amountIn = ethers.utils.parseEther("100");
      const quote = await dexRouter.getQuote(
        tokenA.address,
        tokenB.address,
        amountIn
      );
      
      // Expected: 100 * 1 / 2 = 50, minus 0.5% fee = 49.75
      const expectedQuote = ethers.utils.parseEther("49.75");
      expect(quote).to.equal(expectedQuote);
    });
  });
});