// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;
import "@openzeppelin/contracts/access/Ownable.sol";

contract PriceOracle is Ownable {
    mapping(address => uint256) public prices;
    
    event PriceUpdated(address indexed token, uint256 price);
    
    constructor() {
        // The owner is automatically set to msg.sender by Ownable
    }
    
    function setPrice(address token, uint256 price) external onlyOwner {
        require(price > 0, "Price must be > 0");
        prices[token] = price;
        emit PriceUpdated(token, price);
    }
    
    function getPrice(address token) external view returns (uint256) {
        return prices[token];
    }
}