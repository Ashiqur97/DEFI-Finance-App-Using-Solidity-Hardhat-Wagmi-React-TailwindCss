import { useState } from 'react';
import { useAccount } from 'wagmi';
import { useContractWrite, usePrepareContractWrite } from 'wagmi';
import { useWaitForTransaction } from '@wagmi/core';
import { parseEther } from 'viem';
import { LENDING_CONTRACT_ADDRESS, LENDING_ABI, PRICE_ORACLE_ADDRESS, PRICE_ORACLE_ABI, SWAP_CONTRACT_ADDRESS, SWAP_ABI } from '../contracts';
import { useLendingContractRead, usePriceOracleContractRead, useSwapContractRead } from '../hooks/useContract';
import { formatUSD } from '../utils/helpers';

export default function AdminPanel() {
  const { address } = useAccount();
  const [collateralPrice, setCollateralPrice] = useState('');
  const [borrowPrice, setBorrowPrice] = useState('');
  const [swapFee, setSwapFee] = useState('');
  const [protocolFee, setProtocolFee] = useState('');
  const [actionType, setActionType] = useState('prices'); // 'prices', 'fees', 'pause'

  const { data: owner } = useLendingContractRead({
    functionName: 'owner',
  });

  const { data: paused } = useLendingContractRead({
    functionName: 'paused',
  });

  const { config: setCollateralPriceConfig } = usePrepareContractWrite({
    address: PRICE_ORACLE_ADDRESS,
    abi: PRICE_ORACLE_ABI,
    functionName: 'setPrice',
    args: [
      LENDING_CONTRACT_ADDRESS, // collateral token address
      parseEther(collateralPrice || '0')
    ],
    enabled: !!collateralPrice && Number(collateralPrice) > 0,
  });

  const { config: setBorrowPriceConfig } = usePrepareContractWrite({
    address: PRICE_ORACLE_ADDRESS,
    abi: PRICE_ORACLE_ABI,
    functionName: 'setPrice',
    args: [
      SWAP_CONTRACT_ADDRESS, // borrow token address
      parseEther(borrowPrice || '0')
    ],
    enabled: !!borrowPrice && Number(borrowPrice) > 0,
  });

  const { config: setSwapFeeConfig } = usePrepareContractWrite({
    address: SWAP_CONTRACT_ADDRESS,
    abi: SWAP_ABI,
    functionName: 'setFeeRate',
    args: [Number(swapFee) * 100], // Convert percentage to basis points
    enabled: !!swapFee && Number(swapFee) > 0,
  });

  const { config: setProtocolFeeConfig } = usePrepareContractWrite({
    address: LENDING_CONTRACT_ADDRESS,
    abi: LENDING_ABI,
    functionName: 'setProtocolFeeRate',
    args: [Number(protocolFee) * 100], // Convert percentage to basis points
    enabled: !!protocolFee && Number(protocolFee) > 0,
  });

  const { config: pauseConfig } = usePrepareContractWrite({
    address: LENDING_CONTRACT_ADDRESS,
    abi: LENDING_ABI,
    functionName: 'pause',
    enabled: !paused,
  });

  const { config: unpauseConfig } = usePrepareContractWrite({
    address: LENDING_CONTRACT_ADDRESS,
    abi: LENDING_ABI,
    functionName: 'unpause',
    enabled: paused,
  });

  const { data: setCollateralPriceData, write: setCollateralPriceWrite } = useContractWrite(setCollateralPriceConfig);
  const { data: setBorrowPriceData, write: setBorrowPriceWrite } = useContractWrite(setBorrowPriceConfig);
  const { data: setSwapFeeData, write: setSwapFeeWrite } = useContractWrite(setSwapFeeConfig);
  const { data: setProtocolFeeData, write: setProtocolFeeWrite } = useContractWrite(setProtocolFeeConfig);
  const { data: pauseData, write: pauseWrite } = useContractWrite(pauseConfig);
  const { data: unpauseData, write: unpauseWrite } = useContractWrite(unpauseConfig);

  const { isLoading: isSettingCollateralPrice, isSuccess: isCollateralPriceSet } = useWaitForTransaction({
    hash: setCollateralPriceData?.hash,
  });

  const { isLoading: isSettingBorrowPrice, isSuccess: isBorrowPriceSet } = useWaitForTransaction({
    hash: setBorrowPriceData?.hash,
  });

  const { isLoading: isSettingSwapFee, isSuccess: isSwapFeeSet } = useWaitForTransaction({
    hash: setSwapFeeData?.hash,
  });

  const { isLoading: isSettingProtocolFee, isSuccess: isProtocolFeeSet } = useWaitForTransaction({
    hash: setProtocolFeeData?.hash,
  });

  const { isLoading: isPausing, isSuccess: isPaused } = useWaitForTransaction({
    hash: pauseData?.hash,
  });

  const { isLoading: isUnpausing, isSuccess: isUnpaused } = useWaitForTransaction({
    hash: unpauseData?.hash,
  });

  if (address !== owner) {
    return (
      <div className="text-center py-10">
        <div className="bg-gradient-to-br from-red-900/30 to-red-800/30 p-8 rounded-2xl border border-red-700 max-w-md mx-auto">
          <h2 className="text-2xl font-bold text-red-400 mb-4">Access Denied</h2>
          <p className="text-gray-300">Only the contract owner can access this panel</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="text-center mb-6">
        <h2 className="text-3xl font-bold bg-gradient-to-r from-indigo-500 to-purple-600 bg-clip-text text-transparent">
          Admin Panel
        </h2>
        <p className="text-gray-400 mt-2">Manage protocol settings</p>
      </div>
      
      <div className="flex mb-6 bg-gray-700 rounded-lg p-1">
        <button
          className={`flex-1 py-2 px-4 rounded-lg transition-all duration-300 ${actionType === 'prices' ? 'bg-indigo-600 shadow-lg' : 'hover:bg-gray-600'}`}
          onClick={() => setActionType('prices')}
        >
          Set Prices
        </button>
        <button
          className={`flex-1 py-2 px-4 rounded-lg transition-all duration-300 ${actionType === 'fees' ? 'bg-indigo-600 shadow-lg' : 'hover:bg-gray-600'}`}
          onClick={() => setActionType('fees')}
        >
          Set Fees
        </button>
        <button
          className={`flex-1 py-2 px-4 rounded-lg transition-all duration-300 ${actionType === 'pause' ? 'bg-indigo-600 shadow-lg' : 'hover:bg-gray-600'}`}
          onClick={() => setActionType('pause')}
        >
          Pause/Unpause
        </button>
      </div>
      
      {actionType === 'prices' && (
        <div className="bg-gradient-to-br from-gray-800 to-gray-900 p-6 rounded-2xl shadow-xl border border-gray-700 mb-6">
          <h3 className="text-xl font-semibold mb-4 text-indigo-400 flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M12 7a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0V8.414l-4.293 4.293a1 1 0 01-1.414 0L8 10.414l-4.293 4.293a1 1 0 01-1.414-1.414l5-5a1 1 0 011.414 0L11 10.586 14.586 7H12z" clipRule="evenodd" />
            </svg>
            Set Token Prices
          </h3>
          
          <div className="mb-6">
            <label className="block mb-2 text-gray-300">COLL Price (USD)</label>
            <input
              type="number"
              value={collateralPrice}
              onChange={(e) => setCollateralPrice(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="0.0"
            />
          </div>
          
          <button
            onClick={() => setCollateralPriceWrite?.()}
            disabled={isSettingCollateralPrice || !collateralPrice || Number(collateralPrice) <= 0}
            className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 py-3 rounded-xl font-semibold transition-all duration-300 transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed shadow-lg mb-4"
          >
            {isSettingCollateralPrice ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                Setting Price...
              </div>
            ) : (
              'Set COLL Price'
            )}
          </button>
          
          {isCollateralPriceSet && (
            <div className="text-green-400 mb-4 bg-green-900/30 p-3 rounded-lg">
              COLL price updated successfully!
            </div>
          )}
          
          <div className="mb-6">
            <label className="block mb-2 text-gray-300">BORR Price (USD)</label>
            <input
              type="number"
              value={borrowPrice}
              onChange={(e) => setBorrowPrice(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="0.0"
            />
          </div>
          
          <button
            onClick={() => setBorrowPriceWrite?.()}
            disabled={isSettingBorrowPrice || !borrowPrice || Number(borrowPrice) <= 0}
            className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 py-3 rounded-xl font-semibold transition-all duration-300 transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
          >
            {isSettingBorrowPrice ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                Setting Price...
              </div>
            ) : (
              'Set BORR Price'
            )}
          </button>
          
          {isBorrowPriceSet && (
            <div className="text-green-400 mt-2 bg-green-900/30 p-3 rounded-lg">
              BORR price updated successfully!
            </div>
          )}
        </div>
      )}
      
      {actionType === 'fees' && (
        <div className="bg-gradient-to-br from-gray-800 to-gray-900 p-6 rounded-2xl shadow-xl border border-gray-700 mb-6">
          <h3 className="text-xl font-semibold mb-4 text-indigo-400 flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
              <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd" />
            </svg>
            Set Protocol Fees
          </h3>
          
          <div className="mb-6">
            <label className="block mb-2 text-gray-300">Swap Fee (%)</label>
            <input
              type="number"
              value={swapFee}
              onChange={(e) => setSwapFee(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="0.0"
            />
          </div>
          
          <button
            onClick={() => setSwapFeeWrite?.()}
            disabled={isSettingSwapFee || !swapFee || Number(swapFee) <= 0}
            className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 py-3 rounded-xl font-semibold transition-all duration-300 transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed shadow-lg mb-4"
          >
            {isSettingSwapFee ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                Setting Fee...
              </div>
            ) : (
              'Set Swap Fee'
            )}
          </button>
          
          {isSwapFeeSet && (
            <div className="text-green-400 mb-4 bg-green-900/30 p-3 rounded-lg">
              Swap fee updated successfully!
            </div>
          )}
          
          <div className="mb-6">
            <label className="block mb-2 text-gray-300">Protocol Fee (%)</label>
            <input
              type="number"
              value={protocolFee}
              onChange={(e) => setProtocolFee(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="0.0"
            />
          </div>
          
          <button
            onClick={() => setProtocolFeeWrite?.()}
            disabled={isSettingProtocolFee || !protocolFee || Number(protocolFee) <= 0}
            className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 py-3 rounded-xl font-semibold transition-all duration-300 transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
          >
            {isSettingProtocolFee ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                Setting Fee...
              </div>
            ) : (
              'Set Protocol Fee'
            )}
          </button>
          
          {isProtocolFeeSet && (
            <div className="text-green-400 mt-2 bg-green-900/30 p-3 rounded-lg">
              Protocol fee updated successfully!
            </div>
          )}
        </div>
      )}
      
      {actionType === 'pause' && (
        <div className="bg-gradient-to-br from-gray-800 to-gray-900 p-6 rounded-2xl shadow-xl border border-gray-700 mb-6">
          <h3 className="text-xl font-semibold mb-4 text-indigo-400 flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            Pause/Unpause Protocol
          </h3>
          
          <div className="mb-6">
            <p className="mb-2">Current Status: <span className={paused ? 'text-red-400' : 'text-green-400'}>
              {paused ? 'Paused' : 'Active'}
            </span></p>
            <p className="text-gray-400 text-sm">
              {paused 
                ? 'The protocol is currently paused. Users cannot perform deposits, withdrawals, borrows, or repays.' 
                : 'The protocol is currently active. Users can perform all operations.'}
            </p>
          </div>
          
          {paused ? (
            <button
              onClick={() => unpauseWrite?.()}
              disabled={isUnpausing}
              className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 py-3 rounded-xl font-semibold transition-all duration-300 transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
            >
              {isUnpausing ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  Unpausing...
                </div>
              ) : (
                'Unpause Protocol'
              )}
            </button>
          ) : (
            <button
              onClick={() => pauseWrite?.()}
              disabled={isPausing}
              className="w-full bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 py-3 rounded-xl font-semibold transition-all duration-300 transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
            >
              {isPausing ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  Pausing...
                </div>
              ) : (
                'Pause Protocol'
              )}
            </button>
          )}
          
          {isPaused && (
            <div className="text-green-400 mt-2 bg-green-900/30 p-3 rounded-lg">
              Protocol paused successfully!
            </div>
          )}
          
          {isUnpaused && (
            <div className="text-green-400 mt-2 bg-green-900/30 p-3 rounded-lg">
              Protocol unpaused successfully!
            </div>
          )}
        </div>
      )}
      
      <div className="bg-gradient-to-br from-gray-800 to-gray-900 p-6 rounded-2xl shadow-xl border border-gray-700">
        <h3 className="text-xl font-semibold mb-4 text-indigo-400 flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          Contract Information
        </h3>
        <div className="space-y-3">
          <div className="flex justify-between items-center py-2 border-b border-gray-700">
            <span className="text-gray-400">Lending Contract:</span>
            <span className="text-sm font-mono bg-gray-700 px-2 py-1 rounded">{LENDING_CONTRACT_ADDRESS}</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-gray-700">
            <span className="text-gray-400">Price Oracle:</span>
            <span className="text-sm font-mono bg-gray-700 px-2 py-1 rounded">{PRICE_ORACLE_ADDRESS}</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-gray-700">
            <span className="text-gray-400">Swap Contract:</span>
            <span className="text-sm font-mono bg-gray-700 px-2 py-1 rounded">{SWAP_CONTRACT_ADDRESS}</span>
          </div>
          <div className="flex justify-between items-center py-2">
            <span className="text-gray-400">Owner:</span>
            <span className="text-sm font-mono bg-gray-700 px-2 py-1 rounded">{owner}</span>
          </div>
        </div>
      </div>
    </div>
  );
}