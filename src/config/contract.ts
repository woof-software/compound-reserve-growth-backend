export type ContractConfig = {
  bytes32Tokens: string[];
  cEthMarketAddress: string;
  nativeTokenAddress: string;
};

export default (): { contract: ContractConfig } => ({
  contract: {
    bytes32Tokens: [
      '0x89d24A6b4CcB1B6fAA2625fE562bDD9a23260359',
      '0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2',
    ],
    cEthMarketAddress: '0x4Ddc2D193948926D02f9B1fE9e1daa0718270ED5',
    nativeTokenAddress: '0x0000000000000000000000000000000000000000',
  },
});
