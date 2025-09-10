#!/bin/bash

# Script to view contract ABIs
# Usage: ./view_abi.sh <contract_name>

if [ $# -eq 0 ]; then
  echo "Usage: ./view_abi.sh <contract_name>"
  echo "Available contracts: Lending, PriceOracle, Swap, Timelock, Token"
  exit 1
fi

CONTRACT=$1
FILE_PATH="artifacts/contracts/${CONTRACT}.sol/${CONTRACT}.json"

if [ ! -f "$FILE_PATH" ]; then
  echo "Error: Contract file not found: $FILE_PATH"
  exit 1
fi

echo "=== $CONTRACT Contract ABI ==="
cat "$FILE_PATH" | grep -A 1000 '"abi"' | grep -v '"bytecode"' | head -n -1