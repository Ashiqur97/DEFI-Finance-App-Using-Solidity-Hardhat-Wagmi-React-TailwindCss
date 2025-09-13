import { useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
import { formatEther } from 'viem';
import { LENDING_CONTRACT_ADDRESS, LENDING_ABI, PRICE_ORACLE_ADDRESS, PRICE_ORACLE_ABI } from '../contracts';
import { formatUSD } from '../utils/helpers';
import { useLendingContractRead, usePriceOracleContractRead } from '../hooks/useContract';

export default function Dashboard() {
  const { address } = useAccount();
  const [collateralPrice, setCollateralPrice] = useState(0);
  const [borrowPrice, setBorrowPrice] = useState(0);

  const { data: marketInfo } = useLendingContractRead({
    functionName: 'getMarketInfo',
  });

  const { data: userData } = useLendingContractRead({
    functionName: 'getUserAccountDetails',
    args: [address],
    enabled: !!address,
  });

  const { data: collateralTokenAddress } = useLendingContractRead({
    functionName: 'collateralToken',
  });

  const { data: borrowTokenAddress } = useLendingContractRead({
    functionName: 'borrowToken',
  });

  const { data: collateralTokenPrice } = usePriceOracleContractRead({
    functionName: 'getPrice',
    args: [collateralTokenAddress],
    enabled: !!collateralTokenAddress,
  });

  const { data: borrowTokenPrice } = usePriceOracleContractRead({
    functionName: 'getPrice',
    args: [borrowTokenAddress],
    enabled: !!borrowTokenAddress,
  });

  useEffect(() => {
    if (collateralTokenPrice) setCollateralPrice(Number(formatEther(collateralTokenPrice)));
    if (borrowTokenPrice) setBorrowPrice(Number(formatEther(borrowTokenPrice)));
  }, [collateralTokenPrice, borrowTokenPrice]);

  if (!marketInfo || !userData) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  const [
    totalDeposits,
    totalBorrows,
    utilizationRate,
    collateralTokenPriceUSD,
    borrowTokenPriceUSD
  ] = marketInfo || [];

  const [
    collateralDeposited,
    amountBorrowed,
    interestAccrued,
    lastInterestUpdate,
    collateralValueUSD,
    borrowValueUSD,
    healthFactor
  ] = userData || [];

  return (
    <div className="space-y-8">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-500 to-purple-600 bg-clip-text text-transparent">
          DeFi Lending Protocol
        </h1>
        <p className="text-gray-400 mt-2">Manage your crypto assets with our decentralized lending platform</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-gradient-to-br from-gray-800 to-gray-900 p-6 rounded-2xl shadow-xl border border-gray-700">
          <h3 className="text-xl font-semibold mb-4 text-indigo-400 flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M12 7a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0V8.414l-4.293 4.293a1 1 0 01-1.414 0L8 10.414l-4.293 4.293a1 1 0 01-1.414-1.414l5-5a1 1 0 011.414 0L11 10.586 14.586 7H12z" clipRule="evenodd" />
            </svg>
            Market Overview
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b border-gray-700">
              <span className="text-gray-400">Total Deposits:</span>
              <span className="font-medium">{totalDeposits ? formatEther(totalDeposits) : '0'} COLL</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-700">
              <span className="text-gray-400">Total Borrows:</span>
              <span className="font-medium">{totalBorrows ? formatEther(totalBorrows) : '0'} BORR</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-700">
              <span className="text-gray-400">Utilization Rate:</span>
              <span className="font-medium">{utilizationRate ? (Number(utilizationRate) / 100).toFixed(2) : '0'}%</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-gray-400">COLL Price:</span>
              <span className="font-medium">${collateralPrice.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-gray-400">BORR Price:</span>
              <span className="font-medium">${borrowPrice.toFixed(2)}</span>
            </div>
          </div>
        </div>
        
        <div className="bg-gradient-to-br from-gray-800 to-gray-900 p-6 rounded-2xl shadow-xl border border-gray-700">
          <h3 className="text-xl font-semibold mb-4 text-indigo-400 flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
              <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
            </svg>
            Your Position
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b border-gray-700">
              <span className="text-gray-400">Collateral Deposited:</span>
              <span className="font-medium">{collateralDeposited ? formatEther(collateralDeposited) : '0'} COLL</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-700">
              <span className="text-gray-400">Amount Borrowed:</span>
              <span className="font-medium">{amountBorrowed ? formatEther(amountBorrowed) : '0'} BORR</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-700">
              <span className="text-gray-400">Interest Accrued:</span>
              <span className="font-medium">{interestAccrued ? formatEther(interestAccrued) : '0'} BORR</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-700">
              <span className="text-gray-400">Collateral Value:</span>
              <span className="font-medium">{formatUSD(collateralValueUSD || BigInt(0))}</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-gray-400">Health Factor:</span>
              <span className={`font-medium ${healthFactor && Number(healthFactor) < 8000 ? 'text-red-400' : 'text-green-400'}`}>
                {healthFactor ? (Number(healthFactor) / 100).toFixed(2) : 'N/A'}
              </span>
            </div>
          </div>
        </div>
      </div>
      
      <div className="bg-gradient-to-br from-gray-800 to-gray-900 p-6 rounded-2xl shadow-xl border border-gray-700">
        <h3 className="text-xl font-semibold mb-4 text-indigo-400 flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          Protocol Information
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gradient-to-br from-gray-700 to-gray-800 p-4 rounded-xl border border-gray-600">
            <h4 className="text-gray-400 mb-2">Collateral Factor</h4>
            <p className="text-2xl font-bold text-indigo-400">75%</p>
          </div>
          <div className="bg-gradient-to-br from-gray-700 to-gray-800 p-4 rounded-xl border border-gray-600">
            <h4 className="text-gray-400 mb-2">Liquidation Threshold</h4>
            <p className="text-2xl font-bold text-indigo-400">80%</p>
          </div>
          <div className="bg-gradient-to-br from-gray-700 to-gray-800 p-4 rounded-xl border border-gray-600">
            <h4 className="text-gray-400 mb-2">Interest Rate</h4>
            <p className="text-2xl font-bold text-indigo-400">5% APY</p>
          </div>
        </div>
      </div>
    </div>
  );
}