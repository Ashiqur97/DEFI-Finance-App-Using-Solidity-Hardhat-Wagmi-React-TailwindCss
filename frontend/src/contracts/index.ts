export const LENDING_CONTRACT_ADDRESS = "0x2279B7A0a67DB372996a5FaB50D91eAA73d2eBe6"; 
export const PRICE_ORACLE_ADDRESS = "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9"; 
export const SWAP_CONTRACT_ADDRESS = "0xa513E6E4b8f2a923D98304ec87F64353C4D5C853"; 
export const TIMELOCK_ADDRESS = "0x0165878A594ca255338adfa4d48449f69242Eb8F"; 
 
export const LENDING_ABI = [ 
  "function deposit(uint256 amount) nonpayable", 
  "function withdraw(uint256 amount) nonpayable", 
  "function borrow(uint256 amount) nonpayable", 
  "function repay(uint256 amount) nonpayable", 
  "function liquidate(address borrower, uint256 debtToCover) nonpayable", 
  "function getUserAccountDetails(address user) view returns (uint256 collateralDeposited, uint256 amountBorrowed, uint256 interestAccrued, uint256 lastInterestUpdate, uint256 collateralValueUSD, uint256 borrowValueUSD, uint256 healthFactor)", 
  "function getMarketInfo() view returns (uint256 totalDeposits, uint256 totalBorrows, uint256 utilizationRate, uint256 collateralTokenPrice, uint256 borrowTokenPrice)", 
  "function getLiquidationRisk(address user) view returns (bool canBeLiquidated, uint256 minCollateralToMaintain, uint256 maxSafeWithdraw)", 
  "function collateralToken() view returns (address)", 
  "function borrowToken() view returns (address)", 
  "function paused() view returns (bool)",
  "function users(address) view returns (uint256 collateralDeposited, uint256 amountBorrowed, uint256 interestAccrued, uint256 lastInterestUpdate)",
  "function priceOracle() view returns (address)",
  "function timelock() view returns (address)"
]; 
 
export const PRICE_ORACLE_ABI = [ 
  "function getPrice(address token) view returns (uint256)", 
  "function setPrice(address token, uint256 price) nonpayable",
  "function prices(address) view returns (uint256)" 
]; 
 
export const SWAP_ABI = [ 
  "function swap(address tokenIn, address tokenOut, uint256 amountIn) nonpayable", 
  "function feeRate() view returns (uint256)", 
  "function tokenA() view returns (address)", 
  "function tokenB() view returns (address)",
  "function priceOracle() view returns (address)",
  "function supportedTokens(address) view returns (bool)",
  "function setFeeRate(uint256 newFeeRate) nonpayable",
  "function addSupportedToken(address token) nonpayable",
  "function removeSupportedToken(address token) nonpayable" 
]; 
 
export const TOKEN_ABI = [ 
  "function balanceOf(address account) view returns (uint256)", 
  "function approve(address spender, uint256 amount) returns (bool)", 
  "function allowance(address owner, address spender) view returns (uint256)", 
  "function decimals() view returns (uint8)",
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function totalSupply() view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function transferFrom(address from, address to, uint256 amount) returns (bool)",
  "function mint(address to, uint256 amount) nonpayable" 
];

export const TIMELOCK_ABI = [
  "function owner() view returns (address)",
  "function delay() view returns (uint256)",
  "function MIN_DELAY() view returns (uint256)",
  "function MAX_DELAY() view returns (uint256)",
  "function queuedTransactions(bytes32) view returns (bool)",
  "function setDelay(uint256 _delay) nonpayable",
  "function queueTransaction(address target, uint256 value, string signature, bytes data, uint256 eta) returns (bytes32)",
  "function executeTransaction(address target, uint256 value, string signature, bytes data, uint256 eta) payable returns (bytes)",
  "function cancelTransaction(address target, uint256 value, string signature, bytes data, uint256 eta) nonpayable"
];