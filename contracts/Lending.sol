// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./PriceOracle.sol";
import "./Timelock.sol";

contract Lending is Ownable, ReentrancyGuard {
    IERC20 public collateralToken;
    IERC20 public borrowToken;
    PriceOracle public priceOracle;
    Timelock public timelock;
    
    uint256 public constant COLLATERAL_FACTOR = 7500;
    uint256 public constant LIQUIDATION_THRESHOLD = 8000;
    uint256 public constant LIQUIDATION_BONUS = 1050;
    uint256 public constant INTEREST_RATE = 500;
    
    // Fee collection variables
    uint256 public protocolFeeRate = 100; // 1% in basis points
    address public feeCollector;
    uint256 public collectedFees;
    
    // Pause functionality
    bool public paused;
    address public pauseAdmin;
    
    struct User {
        uint256 collateralDeposited;
        uint256 amountBorrowed;
        uint256 interestAccrued;
        uint256 lastInterestUpdate;
    }
    
    mapping(address => User) public users;
    
    // Events for user experience
    event InterestUpdated(address indexed user, uint256 interestAccrued, uint256 timestamp);
    event HealthFactorChanged(address indexed user, uint256 oldHealthFactor, uint256 newHealthFactor);
    event MarketDataUpdated(uint256 totalDeposits, uint256 totalBorrows, uint256 utilizationRate);
    event PriceUpdate(address indexed token, uint256 oldPrice, uint256 newPrice);
    
    // Events for admin functions
    event Paused(address account);
    event Unpaused(address account);
    event PauseAdminChanged(address oldAdmin, address newAdmin);
    event FeeCollected(uint256 amount, address indexed token);
    event FeeCollectorChanged(address oldCollector, address newCollector);
    event ProtocolFeeRateChanged(uint256 oldRate, uint256 newRate);
    
    // Original events
    event Deposited(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event Borrowed(address indexed user, uint256 amount);
    event Repaid(address indexed user, uint256 amount);
    event Liquidated(address indexed borrower, address indexed liquidator, uint256 debtToCover, uint256 liquidatedCollateral);
    
    constructor(
        IERC20 _collateralToken,
        IERC20 _borrowToken,
        PriceOracle _priceOracle,
        Timelock _timelock
    ) {
        collateralToken = _collateralToken;
        borrowToken = _borrowToken;
        priceOracle = _priceOracle;
        timelock = _timelock;
        pauseAdmin = msg.sender;
        feeCollector = msg.sender;
    }
    
    // Modifiers
    modifier whenNotPaused() {
        require(!paused, "Contract is paused");
        _;
    }
    
    modifier onlyPauseAdmin() {
        require(msg.sender == pauseAdmin || msg.sender == owner(), "Not pause admin");
        _;
    }
    
    modifier onlyTimelock() {
        require(msg.sender == address(timelock), "Caller is not the timelock");
        _;
    }
    
    // Admin functions
    function setPauseAdmin(address newAdmin) external onlyOwner {
        require(newAdmin != address(0), "Invalid address");
        emit PauseAdminChanged(pauseAdmin, newAdmin);
        pauseAdmin = newAdmin;
    }
    
    function pause() external onlyPauseAdmin {
        require(!paused, "Already paused");
        paused = true;
        emit Paused(msg.sender);
    }
    
    function unpause() external onlyPauseAdmin {
        require(paused, "Not paused");
        paused = false;
        emit Unpaused(msg.sender);
    }
    
    function setFeeCollector(address collector) external onlyOwner {
        require(collector != address(0), "Invalid address");
        emit FeeCollectorChanged(feeCollector, collector);
        feeCollector = collector;
    }
    
    function setProtocolFeeRate(uint256 newRate) external onlyTimelock {
        require(newRate <= 500, "Fee cannot exceed 5%");
        emit ProtocolFeeRateChanged(protocolFeeRate, newRate);
        protocolFeeRate = newRate;
    }
    
    function collectFees() external {
        require(msg.sender == feeCollector, "Not fee collector");
        require(collectedFees > 0, "No fees to collect");
        
        uint256 amount = collectedFees;
        collectedFees = 0;
        
        borrowToken.transfer(feeCollector, amount);
        emit FeeCollected(amount, address(borrowToken));
    }
    
    function setTimelock(Timelock _timelock) external onlyTimelock {
        require(address(_timelock) != address(0), "Invalid timelock address");
        timelock = _timelock;
    }
    
    // Original functions with pause modifier
    function updateInterest(address user) internal {
        User storage userAccount = users[user];
        if (userAccount.amountBorrowed > 0) {
            uint256 timeDelta = block.timestamp - userAccount.lastInterestUpdate;
            uint256 interest = (userAccount.amountBorrowed * INTEREST_RATE * timeDelta) / (365 days * 10000);
            userAccount.interestAccrued += interest;
            userAccount.lastInterestUpdate = block.timestamp;
            
            emit InterestUpdated(user, userAccount.interestAccrued, block.timestamp);
        }
    }
    
    function deposit(uint256 amount) external nonReentrant whenNotPaused {
        require(amount > 0, "Amount must be > 0");
        updateInterest(msg.sender);
        
        uint256 oldHealthFactor = getUserHealthFactor(msg.sender);
        
        collateralToken.transferFrom(msg.sender, address(this), amount);
        users[msg.sender].collateralDeposited += amount;
        
        uint256 newHealthFactor = getUserHealthFactor(msg.sender);
        if (oldHealthFactor != newHealthFactor) {
            emit HealthFactorChanged(msg.sender, oldHealthFactor, newHealthFactor);
        }
        
        emit Deposited(msg.sender, amount);
    }
    
    function withdraw(uint256 amount) external nonReentrant whenNotPaused {
        require(amount > 0, "Amount must be > 0");
        updateInterest(msg.sender);
        
        User storage user = users[msg.sender];
        require(user.collateralDeposited >= amount, "Insufficient collateral");
        
        uint256 oldHealthFactor = getUserHealthFactor(msg.sender);
        
        uint256 totalBorrowed = user.amountBorrowed + user.interestAccrued;
        uint256 maxBorrow = ((user.collateralDeposited - amount) * COLLATERAL_FACTOR) / 10000;
        require(totalBorrowed <= maxBorrow, "Withdrawal would make collateral unhealthy");
        
        user.collateralDeposited -= amount;
        collateralToken.transfer(msg.sender, amount);
        
        uint256 newHealthFactor = getUserHealthFactor(msg.sender);
        if (oldHealthFactor != newHealthFactor) {
            emit HealthFactorChanged(msg.sender, oldHealthFactor, newHealthFactor);
        }
        
        emit Withdrawn(msg.sender, amount);
    }
    
    function borrow(uint256 amount) external nonReentrant whenNotPaused {
        require(amount > 0, "Amount must be > 0");
        updateInterest(msg.sender);
        
        User storage user = users[msg.sender];
        uint256 totalBorrowed = user.amountBorrowed + user.interestAccrued;
        uint256 maxBorrow = (user.collateralDeposited * COLLATERAL_FACTOR) / 10000;
        require(totalBorrowed + amount <= maxBorrow, "Exceeds borrowing limit");
        
        uint256 oldHealthFactor = getUserHealthFactor(msg.sender);
        
        user.amountBorrowed += amount;
        user.lastInterestUpdate = block.timestamp;
        borrowToken.transfer(msg.sender, amount);
        
        uint256 newHealthFactor = getUserHealthFactor(msg.sender);
        if (oldHealthFactor != newHealthFactor) {
            emit HealthFactorChanged(msg.sender, oldHealthFactor, newHealthFactor);
        }
        
        emit Borrowed(msg.sender, amount);
    }
    
    function repay(uint256 amount) external nonReentrant whenNotPaused {
        require(amount > 0, "Amount must be > 0");
        updateInterest(msg.sender);
        
        User storage user = users[msg.sender];
        uint256 totalDebt = user.amountBorrowed + user.interestAccrued;
        require(amount <= totalDebt, "Repaying more than debt");
        
        uint256 oldHealthFactor = getUserHealthFactor(msg.sender);
        
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
        
        uint256 newHealthFactor = getUserHealthFactor(msg.sender);
        if (oldHealthFactor != newHealthFactor) {
            emit HealthFactorChanged(msg.sender, oldHealthFactor, newHealthFactor);
        }
        
        emit Repaid(msg.sender, totalDebt - (user.amountBorrowed + user.interestAccrued));
    }
    
    function liquidate(address borrower, uint256 debtToCover) external nonReentrant whenNotPaused {
        require(borrower != msg.sender, "Cannot liquidate own position");
        updateInterest(borrower);
        
        User storage user = users[borrower];
        uint256 totalDebt = user.amountBorrowed + user.interestAccrued;
        require(totalDebt > 0, "Borrower has no debt");
        
        uint256 oldHealthFactor = getUserHealthFactor(borrower);
        
        uint256 collateralValue = (user.collateralDeposited * priceOracle.getPrice(address(collateralToken))) / 1e18;
        uint256 borrowValue = (totalDebt * priceOracle.getPrice(address(borrowToken))) / 1e18;
        require((borrowValue * 10000) / collateralValue >= LIQUIDATION_THRESHOLD, "Borrower is not liquidatable");
        
        uint256 liquidatedCollateral = (debtToCover * LIQUIDATION_BONUS) / 10000;
        require(user.collateralDeposited >= liquidatedCollateral, "Insufficient collateral");
        
        // Calculate protocol fee
        uint256 protocolFee = (liquidatedCollateral * protocolFeeRate) / 10000;
        uint256 liquidatorAmount = liquidatedCollateral - protocolFee;
        
        borrowToken.transferFrom(msg.sender, address(this), debtToCover);
        
        if (user.interestAccrued >= debtToCover) {
            user.interestAccrued -= debtToCover;
        } else {
            uint256 remaining = debtToCover - user.interestAccrued;
            user.interestAccrued = 0;
            user.amountBorrowed -= remaining;
        }
        
        user.collateralDeposited -= liquidatedCollateral;
        collateralToken.transfer(msg.sender, liquidatorAmount);
        
        // Add protocol fee to collected fees
        collectedFees += protocolFee;
        
        uint256 newHealthFactor = getUserHealthFactor(borrower);
        emit HealthFactorChanged(borrower, oldHealthFactor, newHealthFactor);
        
        emit Liquidated(borrower, msg.sender, debtToCover, liquidatorAmount);
        emit FeeCollected(protocolFee, address(collateralToken));
    }
    
    // Original view functions
    function getUserHealthFactor(address user) public view returns (uint256) {
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
    
    // New view functions for user experience
    function getUserAccountDetails(address user) external view returns (
        uint256 collateralDeposited,
        uint256 amountBorrowed,
        uint256 interestAccrued,
        uint256 lastInterestUpdate,
        uint256 collateralValueUSD,
        uint256 borrowValueUSD,
        uint256 healthFactor
    ) {
        User memory userAccount = users[user];
        collateralDeposited = userAccount.collateralDeposited;
        amountBorrowed = userAccount.amountBorrowed;
        interestAccrued = userAccount.interestAccrued;
        lastInterestUpdate = userAccount.lastInterestUpdate;
        
        collateralValueUSD = (userAccount.collateralDeposited * priceOracle.getPrice(address(collateralToken))) / 1e18;
        
        uint256 totalDebt = userAccount.amountBorrowed + userAccount.interestAccrued;
        borrowValueUSD = (totalDebt * priceOracle.getPrice(address(borrowToken))) / 1e18;
        
        if (totalDebt == 0) {
            healthFactor = 10000;
        } else {
            uint256 maxBorrow = (userAccount.collateralDeposited * COLLATERAL_FACTOR) / 10000;
            healthFactor = (maxBorrow * 10000) / totalDebt;
        }
    }
    
    function getMarketInfo() external view returns (
        uint256 totalDeposits,
        uint256 totalBorrows,
        uint256 utilizationRate,
        uint256 collateralTokenPrice,
        uint256 borrowTokenPrice
    ) {
        totalDeposits = collateralToken.balanceOf(address(this));
        totalBorrows = borrowToken.balanceOf(address(this));
        
        if (totalDeposits > 0) {
            utilizationRate = (totalBorrows * 10000) / totalDeposits;
        } else {
            utilizationRate = 0;
        }
        
        collateralTokenPrice = priceOracle.getPrice(address(collateralToken));
        borrowTokenPrice = priceOracle.getPrice(address(borrowToken));
    }
    
    function getInterestDetails(address user) external view returns (
        uint256 currentInterestRate,
        uint256 dailyInterest,
        uint256 yearlyInterest,
        uint256 timeSinceLastUpdate
    ) {
        User memory userAccount = users[user];
        currentInterestRate = INTEREST_RATE;
        
        if (userAccount.amountBorrowed > 0) {
            timeSinceLastUpdate = block.timestamp - userAccount.lastInterestUpdate;
            dailyInterest = (userAccount.amountBorrowed * INTEREST_RATE) / (365 * 10000);
            yearlyInterest = dailyInterest * 365;
        } else {
            dailyInterest = 0;
            yearlyInterest = 0;
            timeSinceLastUpdate = 0;
        }
    }
    
    function getPositionHealth(address user) external view returns (
        bool isHealthy,
        uint256 healthFactor,
        uint256 liquidationThreshold,
        uint256 distanceToLiquidation
    ) {
        User memory userAccount = users[user];
        uint256 totalDebt = userAccount.amountBorrowed + userAccount.interestAccrued;
        
        if (totalDebt == 0) {
            isHealthy = true;
            healthFactor = 10000;
            liquidationThreshold = LIQUIDATION_THRESHOLD;
            distanceToLiquidation = 0;
            return (isHealthy, healthFactor, liquidationThreshold, distanceToLiquidation);
        }
        
        uint256 collateralValue = (userAccount.collateralDeposited * priceOracle.getPrice(address(collateralToken))) / 1e18;
        uint256 borrowValue = (totalDebt * priceOracle.getPrice(address(borrowToken))) / 1e18;
        
        healthFactor = (collateralValue * 10000) / borrowValue;
        liquidationThreshold = LIQUIDATION_THRESHOLD;
        
        isHealthy = healthFactor >= liquidationThreshold;
        
        if (isHealthy) {
            distanceToLiquidation = healthFactor - liquidationThreshold;
        } else {
            distanceToLiquidation = 0;
        }
    }
    
    function getLiquidationRisk(address user) external view returns (
        bool canBeLiquidated,
        uint256 minCollateralToMaintain,
        uint256 maxSafeWithdraw
    ) {
        User memory userAccount = users[user];
        uint256 totalDebt = userAccount.amountBorrowed + userAccount.interestAccrued;
        
        if (totalDebt == 0) {
            canBeLiquidated = false;
            minCollateralToMaintain = 0;
            maxSafeWithdraw = userAccount.collateralDeposited;
            return (canBeLiquidated, minCollateralToMaintain, maxSafeWithdraw);
        }
        
        uint256 collateralValue = (userAccount.collateralDeposited * priceOracle.getPrice(address(collateralToken))) / 1e18;
        uint256 borrowValue = (totalDebt * priceOracle.getPrice(address(borrowToken))) / 1e18;
        
        uint256 healthFactor = (collateralValue * 10000) / borrowValue;
        canBeLiquidated = healthFactor < LIQUIDATION_THRESHOLD;
        
        // Calculate minimum collateral needed to maintain healthy position
        uint256 minCollateralValue = (borrowValue * LIQUIDATION_THRESHOLD) / 10000;
        minCollateralToMaintain = (minCollateralValue * 1e18) / priceOracle.getPrice(address(collateralToken));
        
        // Calculate maximum safe withdrawal amount
        if (userAccount.collateralDeposited > minCollateralToMaintain) {
            maxSafeWithdraw = userAccount.collateralDeposited - minCollateralToMaintain;
        } else {
            maxSafeWithdraw = 0;
        }
    }
}