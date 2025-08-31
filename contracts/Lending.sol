// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./PriceOracle.sol";

contract Lending is Ownable, ReentrancyGuard {
    IERC20 public collateralToken;
    IERC20 public borrowToken;
    PriceOracle public priceOracle;
    
    uint256 public constant COLLATERAL_FACTOR = 7500;
    uint256 public constant LIQUIDATION_THRESHOLD = 8000;
    uint256 public constant LIQUIDATION_BONUS = 1050;
    uint256 public constant INTEREST_RATE = 500;
    
    struct User {
        uint256 collateralDeposited;
        uint256 amountBorrowed;
        uint256 interestAccrued;
        uint256 lastInterestUpdate;
    }
    
    mapping(address => User) public users;
    
    event Deposited(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event Borrowed(address indexed user, uint256 amount);
    event Repaid(address indexed user, uint256 amount);
    event Liquidated(address indexed borrower, address indexed liquidator, uint256 debtToCover, uint256 liquidatedCollateral);
    
    constructor(
        IERC20 _collateralToken,
        IERC20 _borrowToken,
        PriceOracle _priceOracle
    ) {
        collateralToken = _collateralToken;
        borrowToken = _borrowToken;
        priceOracle = _priceOracle;
    }
    
    function updateInterest(address user) internal {
        User storage userAccount = users[user];
        if (userAccount.amountBorrowed > 0) {
            uint256 timeDelta = block.timestamp - userAccount.lastInterestUpdate;
            uint256 interest = (userAccount.amountBorrowed * INTEREST_RATE * timeDelta) / (365 days * 10000);
            userAccount.interestAccrued += interest;
            userAccount.lastInterestUpdate = block.timestamp;
        }
    }
    
    function deposit(uint256 amount) external nonReentrant {
        require(amount > 0, "Amount must be > 0");
        updateInterest(msg.sender);
        
        collateralToken.transferFrom(msg.sender, address(this), amount);
        users[msg.sender].collateralDeposited += amount;
        
        emit Deposited(msg.sender, amount);
    }
    
    function withdraw(uint256 amount) external nonReentrant {
        require(amount > 0, "Amount must be > 0");
        updateInterest(msg.sender);
        
        User storage user = users[msg.sender];
        require(user.collateralDeposited >= amount, "Insufficient collateral");
        
        uint256 totalBorrowed = user.amountBorrowed + user.interestAccrued;
        uint256 maxBorrow = ((user.collateralDeposited - amount) * COLLATERAL_FACTOR) / 10000;
        require(totalBorrowed <= maxBorrow, "Withdrawal would make collateral unhealthy");
        
        user.collateralDeposited -= amount;
        collateralToken.transfer(msg.sender, amount);
        
        emit Withdrawn(msg.sender, amount);
    }
    
    function borrow(uint256 amount) external nonReentrant {
        require(amount > 0, "Amount must be > 0");
        updateInterest(msg.sender);
        
        User storage user = users[msg.sender];
        uint256 totalBorrowed = user.amountBorrowed + user.interestAccrued;
        uint256 maxBorrow = (user.collateralDeposited * COLLATERAL_FACTOR) / 10000;
        require(totalBorrowed + amount <= maxBorrow, "Exceeds borrowing limit");
        
        user.amountBorrowed += amount;
        user.lastInterestUpdate = block.timestamp;
        borrowToken.transfer(msg.sender, amount);
        
        emit Borrowed(msg.sender, amount);
    }
    
    function repay(uint256 amount) external nonReentrant {
        require(amount > 0, "Amount must be > 0");
        updateInterest(msg.sender);
        
        User storage user = users[msg.sender];
        uint256 totalDebt = user.amountBorrowed + user.interestAccrued;
        require(amount <= totalDebt, "Repaying more than debt");
        
        uint256 interestToRepay = user.interestAccrued;
        if (amount >= interestToRepay) {
            user.interestAccrued = 0;
            amount -= interestToRepay;
            
            if (amount > 0) {
                user.amountBorrowed -= amount;
            }
        } else {
            user.interestAccrued -= amount;
            amount = 0;
        }
        
        borrowToken.transferFrom(msg.sender, address(this), totalDebt - (user.amountBorrowed + user.interestAccrued));
        emit Repaid(msg.sender, totalDebt - (user.amountBorrowed + user.interestAccrued));
    }
    
    function liquidate(address borrower, uint256 debtToCover) external nonReentrant {
        require(borrower != msg.sender, "Cannot liquidate own position");
        updateInterest(borrower);
        
        User storage user = users[borrower];
        uint256 totalDebt = user.amountBorrowed + user.interestAccrued;
        require(totalDebt > 0, "Borrower has no debt");
        
        uint256 collateralValue = (user.collateralDeposited * priceOracle.getPrice(address(collateralToken))) / 1e18;
        uint256 borrowValue = (totalDebt * priceOracle.getPrice(address(borrowToken))) / 1e18;
        require((borrowValue * 10000) / collateralValue >= LIQUIDATION_THRESHOLD, "Borrower is not liquidatable");
        
        uint256 liquidatedCollateral = (debtToCover * LIQUIDATION_BONUS) / 10000;
        require(user.collateralDeposited >= liquidatedCollateral, "Insufficient collateral");
        
        borrowToken.transferFrom(msg.sender, address(this), debtToCover);
        
        if (user.interestAccrued >= debtToCover) {
            user.interestAccrued -= debtToCover;
        } else {
            uint256 remaining = debtToCover - user.interestAccrued;
            user.interestAccrued = 0;
            user.amountBorrowed -= remaining;
        }
        
        user.collateralDeposited -= liquidatedCollateral;
        collateralToken.transfer(msg.sender, liquidatedCollateral);
        
        emit Liquidated(borrower, msg.sender, debtToCover, liquidatedCollateral);
    }
    
    function getUserHealthFactor(address user) external view returns (uint256) {
        User memory userAccount = users[user];
        if (userAccount.amountBorrowed == 0) return 10000;
        
        uint256 totalDebt = userAccount.amountBorrowed + userAccount.interestAccrued;
        uint256 maxBorrow = (userAccount.collateralDeposited * COLLATERAL_FACTOR) / 10000;
        
        return (maxBorrow * 10000) / totalDebt;
    }
    
    function getCollateralValue(address user) external view returns (uint256) {
        return (users[user].collateralDeposited * priceOracle.getPrice(address(collateralToken))) / 1e18;
    }
    
    function getBorrowValue(address user) external view returns (uint256) {
        User memory userAccount = users[user];
        uint256 totalDebt = userAccount.amountBorrowed + userAccount.interestAccrued;
        return (totalDebt * priceOracle.getPrice(address(borrowToken))) / 1e18;
    }
}