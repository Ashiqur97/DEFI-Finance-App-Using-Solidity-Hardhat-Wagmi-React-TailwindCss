import { readContract } from 'wagmi';
import { LENDING_ABI, PRICE_ORACLE_ABI, SWAP_ABI, TOKEN_ABI } from '../contracts';
import { LENDING_CONTRACT_ADDRESS, PRICE_ORACLE_ADDRESS, SWAP_CONTRACT_ADDRESS } from '../contracts';
import { useQuery } from '@tanstack/react-query';

// Helper types for contract interactions
export type ContractReadConfig = {
  functionName: string;
  args?: any[];
  enabled?: boolean;
};

// Custom hook factory
const createContractReadHook = (address: `0x${string}`, abi: any) => {
  return (config: ContractReadConfig) => {
    return useQuery({
      queryKey: ['contractRead', address, config.functionName, config.args],
      queryFn: async () => {
        // Real implementation using wagmi
        return readContract({
          address,
          abi,
          functionName: config.functionName,
          args: config.args || [],
        });
      },
      enabled: config.enabled !== false,
    });
  };
};

// Read hooks
export const useLendingContractRead = createContractReadHook(LENDING_CONTRACT_ADDRESS, LENDING_ABI);
export const usePriceOracleContractRead = createContractReadHook(PRICE_ORACLE_ADDRESS, PRICE_ORACLE_ABI);
export const useSwapContractRead = createContractReadHook(SWAP_CONTRACT_ADDRESS, SWAP_ABI);

export const useTokenContractRead = (tokenAddress: `0x${string}`, config: ContractReadConfig) => {
  return useQuery({
    queryKey: ['contractRead', tokenAddress, config.functionName, config.args],
    queryFn: async () => {
      // Real implementation using wagmi
      return readContract({
        address: tokenAddress,
        abi: TOKEN_ABI,
        functionName: config.functionName,
        args: config.args || [],
      });
    },
    enabled: config.enabled !== false,
  });
};