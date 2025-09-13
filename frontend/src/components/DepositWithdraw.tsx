import { useState } from 'react';
import { useAccount } from 'wagmi';
import { useContractWrite, usePrepareContractWrite } from 'wagmi';
import { useWaitForTransaction } from '@wagmi/core';
import { parseEther, formatEther } from 'viem';
import { LENDING_CONTRACT_ADDRESS, LENDING_ABI, TOKEN_ABI } from '../contracts';
import { useTokenBalance } from '../hooks/useTokenBalance';
import { useLendingContractRead } from '../hooks/useContract';
import { parseInputAmount, formatUSD } from '../utils/helpers';

export default function DepositWithdraw() {
  const { address } = useAccount();
  const [depositAmount, setDepositAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [actionType, setActionType] = useState('deposit'); // 'deposit' or 'withdraw'

  const { data: collateralTokenAddress } = useLendingContractRead({
    functionName: 'collateralToken',
  });

  const { data: tokenBalance } = useTokenBalance(
    collateralTokenAddress as `0x${string}` || '0x0000000000000000000000000000000000000000'
  );

  const { data: userCollateral } = useLendingContractRead({
    functionName: 'getUserAccountDetails',
    args: [address],
    enabled: !!address,
  });

  const { config: depositConfig } = usePrepareContractWrite({
    address: LENDING_CONTRACT_ADDRESS,
    abi: LENDING_ABI,
    functionName: 'deposit',
    args: [parseInputAmount(depositAmount)],
    enabled: !!depositAmount && Number(depositAmount) > 0,
  });

  const { config: withdrawConfig } = usePrepareContractWrite({
    address: LENDING_CONTRACT_ADDRESS,
    abi: LENDING_ABI,
    functionName: 'withdraw',
    args: [parseInputAmount(withdrawAmount)],
    enabled: !!withdrawAmount && Number(withdrawAmount) > 0,
  });

  const { data: depositData, write: depositWrite, error: depositError } = useContractWrite(depositConfig);
  const { data: withdrawData, write: withdrawWrite, error: withdrawError } = useContractWrite(withdrawConfig);

  const { isLoading: isDepositLoading, isSuccess: isDepositSuccess } = useWaitForTransaction({
    hash: depositData?.hash,
  });

  const { isLoading: isWithdrawLoading, isSuccess: isWithdrawSuccess } = useWaitForTransaction({
    hash: withdrawData?.hash,
  });

  const handleDeposit = () => {
    if (depositWrite) {
      depositWrite();
    }
  };

  const handleWithdraw = () => {
    if (withdrawWrite) {
      withdrawWrite();
    }
  };

  return (
    <div className="space-y-8">
      <div className="text-center mb-6">
        <h2 className="text-3xl font-bold bg-gradient-to-r from-indigo-500 to-purple-600 bg-clip-text text-transparent">
          Deposit & Withdraw
        </h2>
        <p className="text-gray-400 mt-2">Manage your collateral deposits</p>
      </div>
      
      <div className="bg-gradient-to-br from-gray-800 to-gray-900 p-6 rounded-2xl shadow-xl border border-gray-700">
        <div className="flex mb-6 bg-gray-700 rounded-lg p-1">
          <button
            className={`flex-1 py-2 px-4 rounded-lg transition-all duration-300 ${actionType === 'deposit' ? 'bg-indigo-600 shadow-lg' : 'hover:bg-gray-600'}`}
            onClick={() => setActionType('deposit')}
          >
            Deposit
          </button>
          <button
            className={`flex-1 py-2 px-4 rounded-lg transition-all duration-300 ${actionType === 'withdraw' ? 'bg-indigo-600 shadow-lg' : 'hover:bg-gray-600'}`}
            onClick={() => setActionType('withdraw')}
          >
            Withdraw
          </button>
        </div>
        
        {actionType === 'deposit' ? (
          <div>
            <div className="mb-6">
              <label className="block mb-2 text-gray-300">Amount to Deposit</label>
              <div className="relative">
                <input
                  type="number"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="0.0"
                />
                <button
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1 rounded-lg text-sm transition-all duration-300"
                  onClick={() => setDepositAmount(tokenBalance ? formatEther(tokenBalance as bigint) : '0')}
                >
                  MAX
                </button>
              </div>
              <div className="text-right text-sm text-gray-400 mt-1">
                Balance: {tokenBalance ? formatEther(tokenBalance as bigint) : '0'} COLL
              </div>
            </div>
            
            <button
              onClick={handleDeposit}
              disabled={isDepositLoading || !depositAmount || Number(depositAmount) <= 0}
              className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 py-3 rounded-xl font-semibold transition-all duration-300 transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
            >
              {isDepositLoading ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  Depositing...
                </div>
              ) : (
                'Deposit COLL'
              )}
            </button>
            
            {depositError && (
              <div className="text-red-400 mt-2 bg-red-900/30 p-3 rounded-lg">
                Error: {depositError.message}
              </div>
            )}
            
            {isDepositSuccess && (
              <div className="text-green-400 mt-2 bg-green-900/30 p-3 rounded-lg">
                Deposit successful!
              </div>
            )}
          </div>
        ) : (
          <div>
            <div className="mb-6">
              <label className="block mb-2 text-gray-300">Amount to Withdraw</label>
              <div className="relative">
                <input
                  type="number"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="0.0"
                />
                <button
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1 rounded-lg text-sm transition-all duration-300"
                  onClick={() => setWithdrawAmount(userCollateral ? formatEther(userCollateral[0] as bigint) : '0')}
                >
                  MAX
                </button>
              </div>
              <div className="text-right text-sm text-gray-400 mt-1">
                Deposited: {userCollateral ? formatEther(userCollateral[0] as bigint) : '0'} COLL
              </div>
            </div>
            
            <button
              onClick={handleWithdraw}
              disabled={isWithdrawLoading || !withdrawAmount || Number(withdrawAmount) <= 0}
              className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 py-3 rounded-xl font-semibold transition-all duration-300 transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
            >
              {isWithdrawLoading ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  Withdrawing...
                </div>
              ) : (
                'Withdraw COLL'
              )}
            </button>
            
            {withdrawError && (
              <div className="text-red-400 mt-2 bg-red-900/30 p-3 rounded-lg">
                Error: {withdrawError.message}
              </div>
            )}
            
            {isWithdrawSuccess && (
              <div className="text-green-400 mt-2 bg-green-900/30 p-3 rounded-lg">
                Withdrawal successful!
              </div>
            )}
          </div>
        )}
      </div>
      
      <div className="bg-gradient-to-br from-gray-800 to-gray-900 p-6 rounded-2xl shadow-xl border border-gray-700">
        <h3 className="text-xl font-semibold mb-4 text-indigo-400 flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M5 2a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H3a1 1 0 010-2h1V3a1 1 0 011-1zm0 10a1 1 0 01.967.744L14.146 7.2 13.047 14.01c-.04.27-.25.47-.5.5a1 1 0 01-.894-.553l-2-4a1 1 0 111.789-.894l1.105 2.21 1.282-6.41a1 1 0 01.98-.803z" clipRule="evenodd" />
          </svg>
          Your Collateral
        </h3>
        <div className="space-y-3">
          <div className="flex justify-between items-center py-2 border-b border-gray-700">
            <span className="text-gray-400">Deposited COLL:</span>
            <span className="font-medium">{userCollateral ? formatEther(userCollateral[0] as bigint) : '0'}</span>
          </div>
          <div className="flex justify-between items-center py-2">
            <span className="text-gray-400">Collateral Value:</span>
            <span className="font-medium">{formatUSD(userCollateral ? userCollateral[4] as bigint : BigInt(0))}</span>
          </div>
        </div>
      </div>
    </div>
  );
}