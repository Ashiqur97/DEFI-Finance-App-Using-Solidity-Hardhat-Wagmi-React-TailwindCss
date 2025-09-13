import { formatEther, parseEther } from 'viem';

export const formatBalance = (balance: bigint, decimals = 18) => {
  return Number(formatEther(balance)).toFixed(decimals);
};

export const parseInputAmount = (value: string) => {
  if (!value || isNaN(Number(value))) return BigInt(0);
  return parseEther(value);
};

export const formatUSD = (value: bigint) => {
  return `$${formatEther(value)}`;
};