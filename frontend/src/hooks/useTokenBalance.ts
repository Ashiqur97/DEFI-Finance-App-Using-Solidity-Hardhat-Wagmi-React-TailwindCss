import { useAccount } from 'wagmi';
import { TOKEN_ABI } from '../contracts';
import { useTokenContractRead } from './useContract';

export function useTokenBalance(tokenAddress: `0x${string}`) {
  const { address } = useAccount();

  return useTokenContractRead(tokenAddress, {
    functionName: 'balanceOf',
    args: [address],
    enabled: !!address && !!tokenAddress,
  });
}