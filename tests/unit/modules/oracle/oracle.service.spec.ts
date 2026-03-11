import { ethers } from 'ethers';

import { OracleService } from '@/modules/oracle/oracle.service';
import { Oracle } from '@/modules/oracle/oracle.entity';

describe('OracleService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it('reads oracle data via multicall provider and keeps response shape unchanged', async () => {
    const blockTag = 12_345;
    const provider = {
      getBlock: jest.fn().mockResolvedValue({
        number: blockTag,
        timestamp: 1_710_000_000,
      }),
    };

    const providerFactory = {
      multicall: jest.fn().mockReturnValue(provider),
    };

    const contract = {
      latestRoundData: jest.fn().mockResolvedValue({ answer: 123_450_000n }),
      getRatio: jest.fn().mockResolvedValue(2_000_000_000_000_000_000n),
      isCapped: jest.fn().mockResolvedValue(true),
      decimals: jest.fn().mockResolvedValue(8n),
      snapshotRatio: jest.fn().mockResolvedValue(1_900_000_000_000_000_000n),
      snapshotTimestamp: jest.fn().mockResolvedValue(1_709_999_000n),
      maxYearlyRatioGrowthPercent: jest.fn().mockResolvedValue(500n),
    };

    const contractCtor = jest.fn().mockImplementation(() => contract);
    jest
      .spyOn(ethers, 'Contract', 'get')
      .mockReturnValue(contractCtor as unknown as typeof ethers.Contract);

    const service = new OracleService(providerFactory as never);

    const oracle = {
      address: '0x1111111111111111111111111111111111111111',
      network: 'mainnet',
    } as Oracle;

    const result = await service.getOracleData(oracle, blockTag);

    expect(providerFactory.multicall).toHaveBeenCalledWith('mainnet');
    expect(provider.getBlock).toHaveBeenCalledWith(blockTag);
    expect(contractCtor).toHaveBeenCalledWith(oracle.address, expect.anything(), provider);
    expect(contract.latestRoundData).toHaveBeenCalledWith({ blockTag });
    expect(contract.getRatio).toHaveBeenCalledWith({ blockTag });
    expect(contract.isCapped).toHaveBeenCalledWith({ blockTag });
    expect(contract.decimals).toHaveBeenCalledWith({ blockTag });
    expect(contract.snapshotRatio).toHaveBeenCalledWith({ blockTag });
    expect(contract.snapshotTimestamp).toHaveBeenCalledWith({ blockTag });
    expect(contract.maxYearlyRatioGrowthPercent).toHaveBeenCalledWith({ blockTag });
    expect(result).toEqual({
      ratio: '2000000000000000000',
      price: '1.2345',
      snapshotRatio: '1900000000000000000',
      snapshotTimestamp: 1_709_999_000,
      maxYearlyGrowthPercent: 500,
      isCapped: true,
      blockNumber: blockTag,
      timestamp: 1_710_000_000,
    });
  });
});
