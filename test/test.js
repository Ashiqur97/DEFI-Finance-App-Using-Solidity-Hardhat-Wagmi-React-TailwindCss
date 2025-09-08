const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("DeFi App", function () {
  let collateralToken, borrowToken, priceOracle, timelock, swap, lending;
  let deployer, pauseAdmin, feeCollector, user1, user2;
  const INITIAL_SUPPLY = ethers.parseEther("10000");
  const DEPOSIT_AMOUNT = ethers.parseEther("1000");
  const BORROW_AMOUNT = ethers.parseEther("500");
  const PRICE = ethers.parseEther("1"); // $1 per token

  before(async function () {
    [deployer, pauseAdmin, feeCollector, user1, user2] = await ethers.getSigners();
  });

  describe("Deployment", function () {
    it("Should deploy all contracts correctly", async function () {
      // Deploy Tokens
      const Token = await ethers.getContractFactory("Token");
      collateralToken = await Token.deploy("Collateral Token", "CTK");
      borrowToken = await Token.deploy("Borrow Token", "BTK");

      // Deploy PriceOracle
      const PriceOracle = await ethers.getContractFactory("PriceOracle");
      priceOracle = await PriceOracle.deploy();

      // Deploy Timelock
      const Timelock = await ethers.getContractFactory("Timelock");
      timelock = await Timelock.deploy(2880); // 2 days in minutes

      // Deploy Swap
      const Swap = await ethers.getContractFactory("Swap");
      swap = await Swap.deploy(
        collateralToken.target,
        borrowToken.target,
        priceOracle.target
      );

      // Deploy Lending
      const Lending = await ethers.getContractFactory("Lending");
      lending = await Lending.deploy(
        collateralToken.target,
        borrowToken.target,
        priceOracle.target,
        timelock.target
      );

      // Set pause admin and fee collector
      await lending.setPauseAdmin(pauseAdmin.address);
      await lending.setFeeCollector(feeCollector.address);

      // Mint tokens to users
      await collateralToken.mint(user1.address, INITIAL_SUPPLY);
      await borrowToken.mint(user1.address, INITIAL_SUPPLY);
      await collateralToken.mint(user2.address, INITIAL_SUPPLY);
      await borrowToken.mint(user2.address, INITIAL_SUPPLY);

      // Mint tokens to Swap contract for liquidity
      await collateralToken.mint(swap.target, INITIAL_SUPPLY);
      await borrowToken.mint(swap.target, INITIAL_SUPPLY);

      // Set prices
      await priceOracle.setPrice(collateralToken.target, PRICE);
      await priceOracle.setPrice(borrowToken.target, PRICE);
    });

    it("Should set correct initial values", async function () {
      expect(await lending.collateralToken()).to.equal(collateralToken.target);
      expect(await lending.borrowToken()).to.equal(borrowToken.target);
      expect(await lending.priceOracle()).to.equal(priceOracle.target);
      expect(await lending.timelock()).to.equal(timelock.target);
      expect(await lending.pauseAdmin()).to.equal(pauseAdmin.address);
      expect(await lending.feeCollector()).to.equal(feeCollector.address);
      expect(await lending.paused()).to.equal(false);
    });
  });

  describe("Pause Functionality", function () {
    it("Should allow pause admin to pause and unpause", async function () {
      await lending.connect(pauseAdmin).pause();
      expect(await lending.paused()).to.equal(true);

      await lending.connect(pauseAdmin).unpause();
      expect(await lending.paused()).to.equal(false);
    });

    it("Should not allow non-pause admin to pause", async function () {
      await expect(
        lending.connect(user1).pause()
      ).to.be.revertedWith("Not pause admin");
    });
  });

  describe("Lending Functions", function () {
    beforeEach(async function () {
      // Approve tokens for lending contract
      await collateralToken.connect(user1).approve(lending.target, DEPOSIT_AMOUNT);
      await borrowToken.connect(user1).approve(lending.target, BORROW_AMOUNT);
    });

    it("Should allow depositing collateral", async function () {
      await lending.connect(user1).deposit(DEPOSIT_AMOUNT);

      const userDetails = await lending.getUserAccountDetails(user1.address);
      expect(userDetails.collateralDeposited).to.equal(DEPOSIT_AMOUNT);
    });

    it("Should allow borrowing", async function () {
      await lending.connect(user1).deposit(DEPOSIT_AMOUNT);
      await lending.connect(user1).borrow(BORROW_AMOUNT);

      const userDetails = await lending.getUserAccountDetails(user1.address);
      expect(userDetails.amountBorrowed).to.equal(BORROW_AMOUNT);
    });

    it("Should allow repaying", async function () {
      await lending.connect(user1).deposit(DEPOSIT_AMOUNT);
      await lending.connect(user1).borrow(BORROW_AMOUNT);

      await borrowToken.connect(user1).approve(lending.target, BORROW_AMOUNT);
      await lending.connect(user1).repay(BORROW_AMOUNT);

      const userDetails = await lending.getUserAccountDetails(user1.address);
      expect(userDetails.amountBorrowed).to.equal(0);
    });

    it("Should allow withdrawing", async function () {
      await lending.connect(user1).deposit(DEPOSIT_AMOUNT);
      await lending.connect(user1).withdraw(DEPOSIT_AMOUNT);

      const userDetails = await lending.getUserAccountDetails(user1.address);
      expect(userDetails.collateralDeposited).to.equal(0);
    });

    it("Should allow liquidation", async function () {
      // User1 deposits and borrows
      await lending.connect(user1).deposit(DEPOSIT_AMOUNT);
      await lending.connect(user1).borrow(BORROW_AMOUNT);

      // Change price to make position unhealthy
      await priceOracle.setPrice(collateralToken.target, ethers.parseEther("0.5"));

      // User2 liquidates user1
      await borrowToken.connect(user2).approve(lending.target, BORROW_AMOUNT);
      await lending.connect(user2).liquidate(user1.address, BORROW_AMOUNT);

      const userDetails = await lending.getUserAccountDetails(user1.address);
      expect(userDetails.amountBorrowed).to.equal(0);
    });
  });

  describe("Position Health", function () {
    it("Should return correct position health", async function () {
      await collateralToken.connect(user1).approve(lending.target, DEPOSIT_AMOUNT);
      await lending.connect(user1).deposit(DEPOSIT_AMOUNT);

      const positionHealth = await lending.getPositionHealth(user1.address);
      expect(positionHealth.isHealthy).to.equal(true);
      expect(positionHealth.healthFactor).to.be.gt(0);
    });

    it("Should return correct liquidation risk", async function () {
      await collateralToken.connect(user1).approve(lending.target, DEPOSIT_AMOUNT);
      await lending.connect(user1).deposit(DEPOSIT_AMOUNT);
      await lending.connect(user1).borrow(BORROW_AMOUNT);

      const liquidationRisk = await lending.getLiquidationRisk(user1.address);
      expect(liquidationRisk.canBeLiquidated).to.equal(false);
      expect(liquidationRisk.maxSafeWithdraw).to.be.gt(0);
    });
  });

  describe("Market Info", function () {
    it("Should return correct market info", async function () {
      await collateralToken.connect(user1).approve(lending.target, DEPOSIT_AMOUNT);
      await lending.connect(user1).deposit(DEPOSIT_AMOUNT);

      const marketInfo = await lending.getMarketInfo();
      expect(marketInfo.totalDeposits).to.equal(DEPOSIT_AMOUNT);
      expect(marketInfo.utilizationRate).to.equal(0);
    });
  });

  describe("Interest Details", function () {
    it("Should return correct interest details", async function () {
      await collateralToken.connect(user1).approve(lending.target, DEPOSIT_AMOUNT);
      await lending.connect(user1).deposit(DEPOSIT_AMOUNT);
      await lending.connect(user1).borrow(BORROW_AMOUNT);

      const interestDetails = await lending.getInterestDetails(user1.address);
      expect(interestDetails.currentInterestRate).to.equal(500);
      expect(interestDetails.dailyInterest).to.be.gt(0);
    });
  });

  describe("Fee Collection", function () {
    it("Should collect fees correctly", async function () {
      // User1 deposits and borrows
      await lending.connect(user1).deposit(DEPOSIT_AMOUNT);
      await lending.connect(user1).borrow(BORROW_AMOUNT);

      // Change price to make position unhealthy
      await priceOracle.setPrice(collateralToken.target, ethers.parseEther("0.5"));

      // User2 liquidates user1
      await borrowToken.connect(user2).approve(lending.target, BORROW_AMOUNT);
      await lending.connect(user2).liquidate(user1.address, BORROW_AMOUNT);

      // Check collected fees
      const collectedFeesBefore = await lending.collectedFees();
      expect(collectedFeesBefore).to.be.gt(0);

      // Fee collector collects fees
      await lending.connect(feeCollector).collectFees();

      const collectedFeesAfter = await lending.collectedFees();
      expect(collectedFeesAfter).to.equal(0);
    });
  });

  describe("Swap Functions", function () {
    it("Should allow swapping tokens", async function () {
      const swapAmount = ethers.parseEther("100");
      
      await collateralToken.connect(user1).approve(swap.target, swapAmount);
      await swap.connect(user1).swap(
        collateralToken.target,
        borrowToken.target,
        swapAmount
      );

      // Check balances
      const user1CollateralBalance = await collateralToken.balanceOf(user1.address);
      const user1BorrowBalance = await borrowToken.balanceOf(user1.address);
      
      expect(user1CollateralBalance).to.lt(INITIAL_SUPPLY);
      expect(user1BorrowBalance).to.gt(INITIAL_SUPPLY);
    });

    it("Should update fee rate", async function () {
      const newFeeRate = 50; // 0.5%
      await swap.setFeeRate(newFeeRate);
      expect(await swap.feeRate()).to.equal(newFeeRate);
    });
  });

  describe("Timelock Functions", function () {
    it("Should queue and execute transaction", async function () {
      const newFeeRate = 150; // 1.5%
      const eta = (await time.latest()) + (await timelock.delay()) * 60;
      
      // Encode function call
      const abiCoder = ethers.AbiCoder.defaultAbiCoder();
      const data = abiCoder.encode(["uint256"], [newFeeRate]);
      
      // Queue transaction
      const txId = await timelock.queueTransaction(
        lending.target,
        0,
        "setProtocolFeeRate(uint256)",
        data,
        eta
      );

      // Wait for timelock delay
      await time.increase((await timelock.delay()) * 60);
      
      // Execute transaction
      await timelock.executeTransaction(
        lending.target,
        0,
        "setProtocolFeeRate(uint256)",
        data,
        eta
      );

      expect(await lending.protocolFeeRate()).to.equal(newFeeRate);
    });

    it("Should cancel transaction", async function () {
      const newFeeRate = 200; // 2%
      const eta = (await time.latest()) + (await timelock.delay()) * 60;
      
      // Encode function call
      const abiCoder = ethers.AbiCoder.defaultAbiCoder();
      const data = abiCoder.encode(["uint256"], [newFeeRate]);
      
      // Queue transaction
      const txId = await timelock.queueTransaction(
        lending.target,
        0,
        "setProtocolFeeRate(uint256)",
        data,
        eta
      );

      // Cancel transaction
      await timelock.cancelTransaction(
        lending.target,
        0,
        "setProtocolFeeRate(uint256)",
        data,
        eta
      );

      // Check that transaction is cancelled
      const isQueued = await timelock.queuedTransactions(txId);
      expect(isQueued).to.equal(false);
    });
  });

  describe("Events", function () {
    it("Should emit Deposit event", async function () {
      await collateralToken.connect(user1).approve(lending.target, DEPOSIT_AMOUNT);
      
      await expect(lending.connect(user1).deposit(DEPOSIT_AMOUNT))
        .to.emit(lending, "Deposited")
        .withArgs(user1.address, DEPOSIT_AMOUNT);
    });

    it("Should emit Borrow event", async function () {
      await collateralToken.connect(user1).approve(lending.target, DEPOSIT_AMOUNT);
      await lending.connect(user1).deposit(DEPOSIT_AMOUNT);
      
      await expect(lending.connect(user1).borrow(BORROW_AMOUNT))
        .to.emit(lending, "Borrowed")
        .withArgs(user1.address, BORROW_AMOUNT);
    });

    it("Should emit Swap event", async function () {
      const swapAmount = ethers.parseEther("100");
      await collateralToken.connect(user1).approve(swap.target, swapAmount);
      
      await expect(swap.connect(user1).swap(
        collateralToken.target,
        borrowToken.target,
        swapAmount
      ))
        .to.emit(swap, "Swapped")
        .withArgs(
          user1.address,
          collateralToken.target,
          borrowToken.target,
          swapAmount
        );
    });
  });
});const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("DeFi App", function () {
  let collateralToken, borrowToken, priceOracle, timelock, swap, lending;
  let deployer, pauseAdmin, feeCollector, user1, user2;
  const INITIAL_SUPPLY = ethers.parseEther("10000");
  const DEPOSIT_AMOUNT = ethers.parseEther("1000");
  const BORROW_AMOUNT = ethers.parseEther("500");
  const PRICE = ethers.parseEther("1"); // $1 per token

  before(async function () {
    [deployer, pauseAdmin, feeCollector, user1, user2] = await ethers.getSigners();
  });

  describe("Deployment", function () {
    it("Should deploy all contracts correctly", async function () {
      // Deploy Tokens
      const Token = await ethers.getContractFactory("Token");
      collateralToken = await Token.deploy("Collateral Token", "CTK");
      borrowToken = await Token.deploy("Borrow Token", "BTK");

      // Deploy PriceOracle
      const PriceOracle = await ethers.getContractFactory("PriceOracle");
      priceOracle = await PriceOracle.deploy();

      // Deploy Timelock
      const Timelock = await ethers.getContractFactory("Timelock");
      timelock = await Timelock.deploy(2880); // 2 days in minutes

      // Deploy Swap
      const Swap = await ethers.getContractFactory("Swap");
      swap = await Swap.deploy(
        collateralToken.target,
        borrowToken.target,
        priceOracle.target
      );

      // Deploy Lending
      const Lending = await ethers.getContractFactory("Lending");
      lending = await Lending.deploy(
        collateralToken.target,
        borrowToken.target,
        priceOracle.target,
        timelock.target
      );

      // Set pause admin and fee collector
      await lending.setPauseAdmin(pauseAdmin.address);
      await lending.setFeeCollector(feeCollector.address);

      // Mint tokens to users
      await collateralToken.mint(user1.address, INITIAL_SUPPLY);
      await borrowToken.mint(user1.address, INITIAL_SUPPLY);
      await collateralToken.mint(user2.address, INITIAL_SUPPLY);
      await borrowToken.mint(user2.address, INITIAL_SUPPLY);

      // Mint tokens to Swap contract for liquidity
      await collateralToken.mint(swap.target, INITIAL_SUPPLY);
      await borrowToken.mint(swap.target, INITIAL_SUPPLY);

      // Set prices
      await priceOracle.setPrice(collateralToken.target, PRICE);
      await priceOracle.setPrice(borrowToken.target, PRICE);
    });

    it("Should set correct initial values", async function () {
      expect(await lending.collateralToken()).to.equal(collateralToken.target);
      expect(await lending.borrowToken()).to.equal(borrowToken.target);
      expect(await lending.priceOracle()).to.equal(priceOracle.target);
      expect(await lending.timelock()).to.equal(timelock.target);
      expect(await lending.pauseAdmin()).to.equal(pauseAdmin.address);
      expect(await lending.feeCollector()).to.equal(feeCollector.address);
      expect(await lending.paused()).to.equal(false);
    });
  });

  describe("Pause Functionality", function () {
    it("Should allow pause admin to pause and unpause", async function () {
      await lending.connect(pauseAdmin).pause();
      expect(await lending.paused()).to.equal(true);

      await lending.connect(pauseAdmin).unpause();
      expect(await lending.paused()).to.equal(false);
    });

    it("Should not allow non-pause admin to pause", async function () {
      await expect(
        lending.connect(user1).pause()
      ).to.be.revertedWith("Not pause admin");
    });
  });

  describe("Lending Functions", function () {
    beforeEach(async function () {
      // Approve tokens for lending contract
      await collateralToken.connect(user1).approve(lending.target, DEPOSIT_AMOUNT);
      await borrowToken.connect(user1).approve(lending.target, BORROW_AMOUNT);
    });

    it("Should allow depositing collateral", async function () {
      await lending.connect(user1).deposit(DEPOSIT_AMOUNT);

      const userDetails = await lending.getUserAccountDetails(user1.address);
      expect(userDetails.collateralDeposited).to.equal(DEPOSIT_AMOUNT);
    });

    it("Should allow borrowing", async function () {
      await lending.connect(user1).deposit(DEPOSIT_AMOUNT);
      await lending.connect(user1).borrow(BORROW_AMOUNT);

      const userDetails = await lending.getUserAccountDetails(user1.address);
      expect(userDetails.amountBorrowed).to.equal(BORROW_AMOUNT);
    });

    it("Should allow repaying", async function () {
      await lending.connect(user1).deposit(DEPOSIT_AMOUNT);
      await lending.connect(user1).borrow(BORROW_AMOUNT);

      await borrowToken.connect(user1).approve(lending.target, BORROW_AMOUNT);
      await lending.connect(user1).repay(BORROW_AMOUNT);

      const userDetails = await lending.getUserAccountDetails(user1.address);
      expect(userDetails.amountBorrowed).to.equal(0);
    });

    it("Should allow withdrawing", async function () {
      await lending.connect(user1).deposit(DEPOSIT_AMOUNT);
      await lending.connect(user1).withdraw(DEPOSIT_AMOUNT);

      const userDetails = await lending.getUserAccountDetails(user1.address);
      expect(userDetails.collateralDeposited).to.equal(0);
    });

    it("Should allow liquidation", async function () {
      // User1 deposits and borrows
      await lending.connect(user1).deposit(DEPOSIT_AMOUNT);
      await lending.connect(user1).borrow(BORROW_AMOUNT);

      // Change price to make position unhealthy
      await priceOracle.setPrice(collateralToken.target, ethers.parseEther("0.5"));

      // User2 liquidates user1
      await borrowToken.connect(user2).approve(lending.target, BORROW_AMOUNT);
      await lending.connect(user2).liquidate(user1.address, BORROW_AMOUNT);

      const userDetails = await lending.getUserAccountDetails(user1.address);
      expect(userDetails.amountBorrowed).to.equal(0);
    });
  });

  describe("Position Health", function () {
    it("Should return correct position health", async function () {
      await collateralToken.connect(user1).approve(lending.target, DEPOSIT_AMOUNT);
      await lending.connect(user1).deposit(DEPOSIT_AMOUNT);

      const positionHealth = await lending.getPositionHealth(user1.address);
      expect(positionHealth.isHealthy).to.equal(true);
      expect(positionHealth.healthFactor).to.be.gt(0);
    });

    it("Should return correct liquidation risk", async function () {
      await collateralToken.connect(user1).approve(lending.target, DEPOSIT_AMOUNT);
      await lending.connect(user1).deposit(DEPOSIT_AMOUNT);
      await lending.connect(user1).borrow(BORROW_AMOUNT);

      const liquidationRisk = await lending.getLiquidationRisk(user1.address);
      expect(liquidationRisk.canBeLiquidated).to.equal(false);
      expect(liquidationRisk.maxSafeWithdraw).to.be.gt(0);
    });
  });

  describe("Market Info", function () {
    it("Should return correct market info", async function () {
      await collateralToken.connect(user1).approve(lending.target, DEPOSIT_AMOUNT);
      await lending.connect(user1).deposit(DEPOSIT_AMOUNT);

      const marketInfo = await lending.getMarketInfo();
      expect(marketInfo.totalDeposits).to.equal(DEPOSIT_AMOUNT);
      expect(marketInfo.utilizationRate).to.equal(0);
    });
  });

  describe("Interest Details", function () {
    it("Should return correct interest details", async function () {
      await collateralToken.connect(user1).approve(lending.target, DEPOSIT_AMOUNT);
      await lending.connect(user1).deposit(DEPOSIT_AMOUNT);
      await lending.connect(user1).borrow(BORROW_AMOUNT);

      const interestDetails = await lending.getInterestDetails(user1.address);
      expect(interestDetails.currentInterestRate).to.equal(500);
      expect(interestDetails.dailyInterest).to.be.gt(0);
    });
  });

  describe("Fee Collection", function () {
    it("Should collect fees correctly", async function () {
      // User1 deposits and borrows
      await lending.connect(user1).deposit(DEPOSIT_AMOUNT);
      await lending.connect(user1).borrow(BORROW_AMOUNT);

      // Change price to make position unhealthy
      await priceOracle.setPrice(collateralToken.target, ethers.parseEther("0.5"));

      // User2 liquidates user1
      await borrowToken.connect(user2).approve(lending.target, BORROW_AMOUNT);
      await lending.connect(user2).liquidate(user1.address, BORROW_AMOUNT);

      // Check collected fees
      const collectedFeesBefore = await lending.collectedFees();
      expect(collectedFeesBefore).to.be.gt(0);

      // Fee collector collects fees
      await lending.connect(feeCollector).collectFees();

      const collectedFeesAfter = await lending.collectedFees();
      expect(collectedFeesAfter).to.equal(0);
    });
  });

  describe("Swap Functions", function () {
    it("Should allow swapping tokens", async function () {
      const swapAmount = ethers.parseEther("100");
      
      await collateralToken.connect(user1).approve(swap.target, swapAmount);
      await swap.connect(user1).swap(
        collateralToken.target,
        borrowToken.target,
        swapAmount
      );

      // Check balances
      const user1CollateralBalance = await collateralToken.balanceOf(user1.address);
      const user1BorrowBalance = await borrowToken.balanceOf(user1.address);
      
      expect(user1CollateralBalance).to.lt(INITIAL_SUPPLY);
      expect(user1BorrowBalance).to.gt(INITIAL_SUPPLY);
    });

    it("Should update fee rate", async function () {
      const newFeeRate = 50; // 0.5%
      await swap.setFeeRate(newFeeRate);
      expect(await swap.feeRate()).to.equal(newFeeRate);
    });
  });

  describe("Timelock Functions", function () {
    it("Should queue and execute transaction", async function () {
      const newFeeRate = 150; // 1.5%
      const eta = (await time.latest()) + (await timelock.delay()) * 60;
      
      // Encode function call
      const abiCoder = ethers.AbiCoder.defaultAbiCoder();
      const data = abiCoder.encode(["uint256"], [newFeeRate]);
      
      // Queue transaction
      const txId = await timelock.queueTransaction(
        lending.target,
        0,
        "setProtocolFeeRate(uint256)",
        data,
        eta
      );

      // Wait for timelock delay
      await time.increase((await timelock.delay()) * 60);
      
      // Execute transaction
      await timelock.executeTransaction(
        lending.target,
        0,
        "setProtocolFeeRate(uint256)",
        data,
        eta
      );

      expect(await lending.protocolFeeRate()).to.equal(newFeeRate);
    });

    it("Should cancel transaction", async function () {
      const newFeeRate = 200; // 2%
      const eta = (await time.latest()) + (await timelock.delay()) * 60;
      
      // Encode function call
      const abiCoder = ethers.AbiCoder.defaultAbiCoder();
      const data = abiCoder.encode(["uint256"], [newFeeRate]);
      
      // Queue transaction
      const txId = await timelock.queueTransaction(
        lending.target,
        0,
        "setProtocolFeeRate(uint256)",
        data,
        eta
      );

      // Cancel transaction
      await timelock.cancelTransaction(
        lending.target,
        0,
        "setProtocolFeeRate(uint256)",
        data,
        eta
      );

      // Check that transaction is cancelled
      const isQueued = await timelock.queuedTransactions(txId);
      expect(isQueued).to.equal(false);
    });
  });

  describe("Events", function () {
    it("Should emit Deposit event", async function () {
      await collateralToken.connect(user1).approve(lending.target, DEPOSIT_AMOUNT);
      
      await expect(lending.connect(user1).deposit(DEPOSIT_AMOUNT))
        .to.emit(lending, "Deposited")
        .withArgs(user1.address, DEPOSIT_AMOUNT);
    });

    it("Should emit Borrow event", async function () {
      await collateralToken.connect(user1).approve(lending.target, DEPOSIT_AMOUNT);
      await lending.connect(user1).deposit(DEPOSIT_AMOUNT);
      
      await expect(lending.connect(user1).borrow(BORROW_AMOUNT))
        .to.emit(lending, "Borrowed")
        .withArgs(user1.address, BORROW_AMOUNT);
    });

    it("Should emit Swap event", async function () {
      const swapAmount = ethers.parseEther("100");
      await collateralToken.connect(user1).approve(swap.target, swapAmount);
      
      await expect(swap.connect(user1).swap(
        collateralToken.target,
        borrowToken.target,
        swapAmount
      ))
        .to.emit(swap, "Swapped")
        .withArgs(
          user1.address,
          collateralToken.target,
          borrowToken.target,
          swapAmount
        );
    });
  });
});