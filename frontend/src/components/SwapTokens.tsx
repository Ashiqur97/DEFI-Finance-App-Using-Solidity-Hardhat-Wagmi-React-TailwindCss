import { useState } from 'react';
import { useAccount } from 'wagmi';
import { useContractWrite, usePrepareContractWrite } from 'wagmi';
import { useWaitForTransaction } from '@wagmi/core';
import { parseEther, formatEther } from 'viem';
import { SWAP_CONTRACT_ADDRESS, SWAP_ABI, TOKEN_ABI, PRICE_ORACLE_ADDRESS, PRICE_ORACLE_ABI } from '../contracts';
import { useTokenBalance } from '../hooks/useTokenBalance';
import { useSwapContractRead, usePriceOracleContractRead } from '../hooks/useContract';
import { parseInputAmount, formatUSD } from '../utils/helpers';

export default function SwapTokens() {
  const { address } = useAccount();
  const [fromToken, setFromToken] = useState('COLL');
  const [toToken, setToToken] = useState('BORR');
  const [fromAmount, setFromAmount] = useState('');
  const [toAmount, setToAmount] = useState('');

  const { data: tokenA } = useSwapContractRead({
    functionName: 'tokenA',
  });

  const { data: tokenB } = useSwapContractRead({
    functionName: 'tokenB',
  });

  const { data: feeRate } = useSwapContractRead({
    functionName: 'feeRate',
  });

  const { data: fromTokenBalance } = useTokenBalance(
    fromToken === 'COLL' ? (tokenA as `0x${string}`) || '0x0000000000000000000000000000000000000000' : (tokenB as `0x${string}`) || '0x0000000000000000000000000000000000000000'
  );

  const { data: fromTokenPrice } = usePriceOracleContractRead({
    functionName: 'getPrice',
    args: [fromToken === 'COLL' ? tokenA : tokenB],
    enabled: !!tokenA && !!tokenB,
  });

  const { data: toTokenPrice } = usePriceOracleContractRead({
    functionName: 'getPrice',
    args: [toToken === 'COLL' ? tokenA : tokenB],
    enabled: !!tokenA && !!tokenB,
  });

  // Calculate to amount when from amount changes
  useState(() => {
    if (fromAmount && fromTokenPrice && toTokenPrice) {
      const fromAmountWei = parseEther(fromAmount);
      const fromPrice = Number(formatEther(fromTokenPrice as bigint));
      const toPrice = Number(formatEther(toTokenPrice as bigint));
      const fee = Number(feeRate) / 10000;
      
      const toAmountWei = (Number(fromAmountWei) * fromPrice * (1 - fee)) / toPrice;
      setToAmount(toAmountWei.toFixed(6));
    }
  });

  const { config: swapConfig } = usePrepareContractWrite({
    address: SWAP_CONTRACT_ADDRESS,
    abi: SWAP_ABI,
    functionName: 'swap',
    args: [
      fromToken === 'COLL' ? tokenA : tokenB,
      toToken === 'COLL' ? tokenA : tokenB,
      parseInputAmount(fromAmount)
    ],
    enabled: !!fromAmount && Number(fromAmount) > 0 && !!tokenA && !!tokenB,
  });

  const { data: swapData, writeAsync: swapWrite, error: swapError } = useContractWrite(swapConfig);

  const { isLoading: isSwapLoading, isSuccess: isSwapSuccess } = useWaitForTransaction({
    hash: swapData as unknown as `0x${string}`,
  });

  const handleSwap = () => {
    if (swapWrite) {
      swapWrite();
    }
  };

  const switchTokens = () => {
    setFromToken(toToken);
    setToToken(fromToken);
    setFromAmount(toAmount);
    setToAmount(fromAmount);
  };

  return (
    <div className="space-y-8">
      <div className="text-center mb-6">
        <h2 className="text-3xl font-bold bg-gradient-to-r from-indigo-500 to-purple-600 bg-clip-text text-transparent">
          Swap Tokens
        </h2>
        <p className="text-gray-400 mt-2">Exchange your tokens instantly</p>
      </div>
      
      <div className="bg-gradient-to-br from-gray-800 to-gray-900 p-6 rounded-2xl shadow-xl border border-gray-700">
        <div className="mb-6">
          <label className="block mb-2 text-gray-300">From</label>
          <div className="flex">
            <select
              value={fromToken}
              onChange={(e) => setFromToken(e.target.value)}
              className="bg-gray-700 border border-gray-600 rounded-l-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="COLL">COLL</option>
              <option value="BORR">BORR</option>
            </select>
            <input
              type="number"
              value={fromAmount}
              onChange={(e) => setFromAmount(e.target.value)}
              className="flex-1 bg-gray-700 border border-gray-600 rounded-r-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="0.0"
            />
          </div>
          <div className="text-right text-sm text-gray-400 mt-1">
            Balance: {fromTokenBalance ? formatEther(fromTokenBalance as bigint) : '0'} {fromToken}
          </div>
        </div>
        
        <div className="flex justify-center my-4">
          <button
            onClick={switchTokens}
            className="bg-gray-700 hover:bg-gray-600 rounded-full p-3 transition-all duration-300 transform hover:scale-110"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
        
        <div className="mb-6">
          <label className="block mb-2 text-gray-300">To</label>
          <div className="flex">
            <select
              value={toToken}
              onChange={(e) => setToToken(e.target.value)}
              className="bg-gray-700 border border-gray-600 rounded-l-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="COLL">COLL</option>
              <option value="BORR">BORR</option>
            </select>
            <input
              type="number"
              value={toAmount}
              readOnly
              className="flex-1 bg-gray-700 border border-gray-600 rounded-r-xl py-3 px-4"
              placeholder="0.0"
            />
          </div>
        </div>
        
        <div className="text-sm text-gray-400 mb-4 bg-gray-700/50 p-3 rounded-lg">
          <div className="flex justify-between mb-1">
            <span>Exchange Rate:</span>
            <span>1 {fromToken} = {fromTokenPrice && toTokenPrice ? 
              (Number(formatEther(fromTokenPrice as bigint)) / Number(formatEther(toTokenPrice as bigint))).toFixed(6) : '0'} {toToken}</span>
          </div>
          <div className="flex justify-between">
            <span>Fee:</span>
            <span>{feeRate ? (Number(feeRate) / 100).toFixed(2) : '0'}%</span>
          </div>
        </div>
        
        <button
          onClick={handleSwap}
          disabled={isSwapLoading || !fromAmount || Number(fromAmount) <= 0}
          className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 py-3 rounded-xl font-semibold transition-all duration-300 transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
        >
          {isSwapLoading ? (
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
              Swapping...
            </div>
          ) : (
            `Swap ${fromToken} to ${toToken}`
          )}
        </button>
        
        {swapError && (
          <div className="text-red-400 mt-2 bg-red-900/30 p-3 rounded-lg">
            Error: {swapError.message}
          </div>
        )}
        
        {isSwapSuccess && (
          <div className="text-green-400 mt-2 bg-green-900/30 p-3 rounded-lg">
            Swap successful!
          </div>
        )}
      </div>
      
      <div className="bg-gradient-to-br from-gray-800 to-gray-900 p-6 rounded-2xl shadow-xl border border-gray-700">
        <h3 className="text-xl font-semibold mb-4 text-indigo-400 flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M12 7a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0V8.414l-4.293 4.293a1 1 0 01-1.414 0L8 10.414l-4.293 4.293a1 1 0 01-1.414-1.414l5-5a1 1 0 011.414 0L11 10.586 14.586 7H12z" clipRule="evenodd" />
          </svg>
          Token Prices
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gradient-to-br from-gray-700 to-gray-800 p-4 rounded-xl border border-gray-600">
            <h4 className="text-gray-400 mb-2">COLL</h4>
            <p className="text-xl font-bold">${fromTokenPrice ? formatEther(fromTokenPrice as bigint) : '0'}</p>
          </div>
          <div className="bg-gradient-to-br from-gray-700 to-gray-800 p-4 rounded-xl border border-gray-600">
            <h4 className="text-gray-400 mb-2">BORR</h4>
            <p className="text-xl font-bold">${toTokenPrice ? formatEther(toTokenPrice as bigint) : '0'}</p>
          </div>
        </div>
      </div>
    </div>
  );
}