import { useState } from 'react';
import { useAccount, useContractWrite, usePrepareContractWrite, useWaitForTransaction } from 'wagmi';
import { parseEther, formatEther } from 'viem';
import { LENDING_CONTRACT_ADDRESS, LENDING_ABI, TOKEN_ABI } from '../contracts';
import { useTokenBalance } from '../hooks/useTokenBalance';
import { useLendingContractRead } from '../hooks/useContract';
import { parseInputAmount, formatUSD } from '../utils/helpers';

export default function BorrowRepay() {
  const { address } = useAccount();
  const [borrowAmount, setBorrowAmount] = useState('');
  const [repayAmount, setRepayAmount] = useState('');
  const [actionType, setActionType] = useState('borrow'); // 'borrow' or 'repay'

  const { data: borrowTokenAddress } = useLendingContractRead({
    functionName: 'borrowToken',
  });

  const { data: tokenBalance } = useTokenBalance(
    borrowTokenAddress as `0x${string}` || '0x0000000000000000000000000000000000000000'
  );

  const { data: userData } = useLendingContractRead({
    functionName: 'getUserAccountDetails',
    args: [address],
    enabled: !!address,
  });

  const { config: borrowConfig } = usePrepareContractWrite({
    address: LENDING_CONTRACT_ADDRESS,
    abi: LENDING_ABI,
    functionName: 'borrow',
    args: [parseInputAmount(borrowAmount)],
    enabled: !!borrowAmount && Number(borrowAmount) > 0,
  });

  const { config: repayConfig } = usePrepareContractWrite({
    address: LENDING_CONTRACT_ADDRESS,
    abi: LENDING_ABI,
    functionName: 'repay',
    args: [parseInputAmount(repayAmount)],
    enabled: !!repayAmount && Number(repayAmount) > 0,
  });

  const { data: borrowData, write: borrowWrite, error: borrowError } = useContractWrite(borrowConfig);
  const { data: repayData, write: repayWrite, error: repayError } = useContractWrite(repayConfig);

  const { isLoading: isBorrowLoading, isSuccess: isBorrowSuccess } = useWaitForTransaction({
    hash: borrowData?.hash,
  });

  const { isLoading: isRepayLoading, isSuccess: isRepaySuccess } = useWaitForTransaction({
    hash: repayData?.hash,
  });

  const handleBorrow = () => {
    if (borrowWrite) {
      borrowWrite();
    }
  };

  const handleRepay = () => {
    if (repayWrite) {
      repayWrite();
    }
  };

  return (
    <div className="space-y-8">
      <div className="text-center mb-6">
        <h2 className="text-3xl font-bold bg-gradient-to-r from-indigo-500 to-purple-600 bg-clip-text text-transparent">
          Borrow & Repay
        </h2>
        <p className="text-gray-400 mt-2">Manage your borrow positions</p>
      </div>
      
      <div className="bg-gradient-to-br from-gray-800 to-gray-900 p-6 rounded-2xl shadow-xl border border-gray-700">
        <div className="flex mb-6 bg-gray-700 rounded-lg p-1">
          <button
            className={`flex-1 py-2 px-4 rounded-lg transition-all duration-300 ${actionType === 'borrow' ? 'bg-indigo-600 shadow-lg' : 'hover:bg-gray-600'}`}
            onClick={() => setActionType('borrow')}
          >
            Borrow
          </button>
          <button
            className={`flex-1 py-2 px-4 rounded-lg transition-all duration-300 ${actionType === 'repay' ? 'bg-indigo-600 shadow-lg' : 'hover:bg-gray-600'}`}
            onClick={() => setActionType('repay')}
          >
            Repay
          </button>
        </div>
        
        {actionType === 'borrow' ? (
          <div>
            <div className="mb-6">
              <label className="block mb-2 text-gray-300">Amount to Borrow</label>
              <input
                type="number"
                value={borrowAmount}
                onChange={(e) => setBorrowAmount(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="0.0"
              />
              <div className="text-right text-sm text-gray-400 mt-1">
                Available to borrow: {userData ? formatEther(userData[5] as bigint) : '0'} BORR
              </div>
            </div>
            
            <button
              onClick={handleBorrow}
              disabled={isBorrowLoading || !borrowAmount || Number(borrowAmount) <= 0}
              className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 py-3 rounded-xl font-semibold transition-all duration-300 transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
            >
              {isBorrowLoading ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  Borrowing...
                </div>
              ) : (
                'Borrow BORR'
              )}
            </button>
            
            {borrowError && (
              <div className="text-red-400 mt-2 bg-red-900/30 p-3 rounded-lg">
                Error: {borrowError.message}
              </div>
            )}
            
            {isBorrowSuccess && (
              <div className="text-green-400 mt-2 bg-green-900/30 p-3 rounded-lg">
                Borrow successful!
              </div>
            )}
          </div>
        ) : (
          <div>
            <div className="mb-6">
              <label className="block mb-2 text-gray-300">Amount to Repay</label>
              <div className="relative">
                <input
                  type="number"
                  value={repayAmount}
                  onChange={(e) => setRepayAmount(e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="0.0"
                />
                <button
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1 rounded-lg text-sm transition-all duration-300"
                  onClick={() => setRepayAmount(userData ? formatEther(userData[1] as bigint) : '0')}
                >
                  MAX
                </button>
              </div>
              <div className="text-right text-sm text-gray-400 mt-1">
                Wallet Balance: {tokenBalance ? formatEther(tokenBalance as bigint) : '0'} BORR
              </div>
            </div>
            
            <button
              onClick={handleRepay}
              disabled={isRepayLoading || !repayAmount || Number(repayAmount) <= 0}
              className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 py-3 rounded-xl font-semibold transition-all duration-300 transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
            >
              {isRepayLoading ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  Repaying...
                </div>
              ) : (
                'Repay BORR'
              )}
            </button>
            
            {repayError && (
              <div className="text-red-400 mt-2 bg-red-900/30 p-3 rounded-lg">
                Error: {repayError.message}
              </div>
            )}
            
            {isRepaySuccess && (
              <div className="text-green-400 mt-2 bg-green-900/30 p-3 rounded-lg">
                Repayment successful!
              </div>
            )}
          </div>
        )}
      </div>
      
      <div className="bg-gradient-to-br from-gray-800 to-gray-900 p-6 rounded-2xl shadow-xl border border-gray-700">
        <h3 className="text-xl font-semibold mb-4 text-indigo-400 flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
            <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd" />
          </svg>
          Your Borrow Position
        </h3>
        <div className="space-y-3">
          <div className="flex justify-between items-center py-2 border-b border-gray-700">
            <span className="text-gray-400">Borrowed Amount:</span>
            <span className="font-medium">{userData ? formatEther(userData[1] as bigint) : '0'} BORR</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-gray-700">
            <span className="text-gray-400">Interest Accrued:</span>
            <span className="font-medium">{userData ? formatEther(userData[2] as bigint) : '0'} BORR</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-gray-700">
            <span className="text-gray-400">Total Debt:</span>
            <span className="font-medium">{userData ? formatEther(BigInt(userData[1] as bigint) + BigInt(userData[2] as bigint)) : '0'} BORR</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-gray-700">
            <span className="text-gray-400">Borrow Value:</span>
            <span className="font-medium">{formatUSD(userData ? userData[5] as bigint : BigInt(0))}</span>
          </div>
          <div className="flex justify-between items-center py-2">
            <span className="text-gray-400">Health Factor:</span>
            <span className={`font-medium ${userData && Number(userData[6]) < 8000 ? 'text-red-400' : 'text-green-400'}`}>
              {userData ? (Number(userData[6]) / 100).toFixed(2) : 'N/A'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}