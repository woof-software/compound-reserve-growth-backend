export const sleep = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

export const formatTokenBalance = (balance = 0n, decimals = 1): string => {
  const balanceString = balance.toString();
  const integerPart = balanceString.slice(0, -decimals) || '0';
  const fractionalPart = balanceString.slice(-decimals).padStart(decimals, '0');
  const formattedBalance = `${integerPart}.${fractionalPart}`;
  if (+formattedBalance === 0) return '0';
  return formattedBalance;
};
