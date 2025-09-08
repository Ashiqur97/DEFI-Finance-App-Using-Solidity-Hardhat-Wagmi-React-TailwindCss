// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

contract Timelock {
    address public owner;
    uint256 public constant MIN_DELAY = 2880;   // 2 days in minutes (2 * 24 * 60)
    uint256 public constant MAX_DELAY = 43200;  // 30 days in minutes (30 * 24 * 60)
    uint256 public delay;                    // Current delay setting in minutes
    
    mapping(bytes32 => bool) public queuedTransactions;
    
    event TransactionQueued(bytes32 indexed txId, address target, uint256 value, string signature, bytes data, uint256 eta);
    event TransactionExecuted(bytes32 indexed txId, address target, uint256 value, string signature, bytes data);
    event TransactionCancelled(bytes32 indexed txId);
    event NewDelay(uint256 newDelay);
    
    constructor(uint256 _delay) {
        require(_delay >= MIN_DELAY && _delay <= MAX_DELAY, "Delay must be within range");
        owner = msg.sender;
        delay = _delay;
    }
    
    function setDelay(uint256 _delay) external {
        require(msg.sender == owner, "Caller is not the owner");
        require(_delay >= MIN_DELAY && _delay <= MAX_DELAY, "Delay must be within range");
        delay = _delay;
        emit NewDelay(delay);
    }
    
    function queueTransaction(
        address target,
        uint256 value,
        string memory signature,
        bytes memory data,
        uint256 eta
    ) external returns (bytes32) {
        require(msg.sender == owner, "Caller is not the owner");
        require(eta >= block.timestamp + (delay * 60 seconds), "Eta must exceed delay");
        
        bytes32 txId = keccak256(abi.encode(target, value, signature, data, eta));
        require(!queuedTransactions[txId], "Transaction already queued");
        
        queuedTransactions[txId] = true;
        emit TransactionQueued(txId, target, value, signature, data, eta);
        
        return txId;
    }
    
    function executeTransaction(
        address target,
        uint256 value,
        string memory signature,
        bytes memory data,
        uint256 eta
    ) external payable returns (bytes memory) {
        require(msg.sender == owner, "Caller is not the owner");
        
        bytes32 txId = keccak256(abi.encode(target, value, signature, data, eta));
        require(queuedTransactions[txId], "Transaction hasn't been queued");
        require(block.timestamp >= eta, "Transaction hasn't timed out yet");
        require(block.timestamp <= eta + (delay * 60 seconds), "Transaction is stale");
        
        queuedTransactions[txId] = false;
        
        bytes memory callData;
        if (bytes(signature).length == 0) {
            callData = data;
        } else {
            callData = abi.encodePacked(bytes4(keccak256(bytes(signature))), data);
        }
        
        (bool success, bytes memory returnData) = target.call{value: value}(callData);
        require(success, "Transaction execution reverted");
        
        emit TransactionExecuted(txId, target, value, signature, data);
        
        return returnData;
    }
    
    function cancelTransaction(
        address target,
        uint256 value,
        string memory signature,
        bytes memory data,
        uint256 eta
    ) external {
        require(msg.sender == owner, "Caller is not the owner");
        
        bytes32 txId = keccak256(abi.encode(target, value, signature, data, eta));
        require(queuedTransactions[txId], "Transaction hasn't been queued");
        
        queuedTransactions[txId] = false;
        
        emit TransactionCancelled(txId);
    }
}