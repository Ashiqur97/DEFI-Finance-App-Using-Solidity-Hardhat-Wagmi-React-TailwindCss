// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./PriceOracle.sol";

contract Swap is Ownable {
    IERC20 public tokenA;
    IERC20 public tokenB;
    PriceOracle public priceOracle;
    
    uint256 public feeRate = 30;
    
    mapping(address => bool) public supportedTokens;
    
    event Swapped(
        address indexed user,
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut
    );
    
    event FeeUpdated(uint256 newFeeRate);
    
    constructor(
        IERC20 _tokenA,
        IERC20 _tokenB,
        PriceOracle _priceOracle
    ) {
        tokenA = _tokenA;
        tokenB = _tokenB;
        priceOracle = _priceOracle;
        supportedTokens[address(_tokenA)] = true;
        supportedTokens[address(_tokenB)] = true;
    }
    
    function swap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) external {
        require(amountIn > 0, "Amount must be > 0");
        require(supportedTokens[tokenIn] && supportedTokens[tokenOut], "Token not supported");
        require(tokenIn != tokenOut, "Cannot swap same token");
        
        uint256 priceIn = priceOracle.getPrice(tokenIn);
        uint256 priceOut = priceOracle.getPrice(tokenOut);
        
        uint256 amountOutBeforeFee = (amountIn * priceIn) / priceOut;
        uint256 feeAmount = (amountOutBeforeFee * feeRate) / 10000;
        uint256 amountOut = amountOutBeforeFee - feeAmount;
        
        IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn);
        IERC20(tokenOut).transfer(msg.sender, amountOut);
        
        emit Swapped(msg.sender, tokenIn, tokenOut, amountIn, amountOut);
    }
    
    function setFeeRate(uint256 newFeeRate) external onlyOwner {
        require(newFeeRate <= 500, "Fee cannot exceed 5%");
        feeRate = newFeeRate;
        emit FeeUpdated(newFeeRate);
    }
    
    function addSupportedToken(address token) external onlyOwner {
        supportedTokens[token] = true;
    }
    
    function removeSupportedToken(address token) external onlyOwner {
        supportedTokens[token] = false;
    }
}