import { BadRequestException } from '@nestjs/common';

import { Algorithm } from '@/common/enum/algorithm.enum';
import { SourcesUpdateValidationService } from '@/modules/sources-update/sources-validator';

describe('SourcesUpdateValidationService', () => {
  const validAsset = {
    id: 1,
    address: '0x0000000000000000000000000000000000000001',
    decimals: 18,
    symbol: 'USDC',
    chainId: 1,
    type: 'erc20',
  };

  const validSource = {
    id: 10,
    address: '0x0000000000000000000000000000000000000010',
    market: null,
    algorithm: `{${Algorithm.COMET}}`,
    startBlock: 100,
    endBlock: null,
    chainId: 1,
    assetId: 1,
    type: 'treasury',
  };

  let service: SourcesUpdateValidationService;

  beforeEach(() => {
    service = new SourcesUpdateValidationService();
  });

  it('returns validated typed output for valid assets and sources', async () => {
    const result = await service.validateAll({
      assetsRaw: [validAsset],
      sourcesRaw: [validSource],
    });

    expect(result.assets).toHaveLength(1);
    expect(result.sources).toHaveLength(1);
    expect(result.assets[0].address).toBe('0x0000000000000000000000000000000000000001');
    expect(result.sources[0].algorithm).toEqual([Algorithm.COMET]);
  });

  it('fails when assets top-level is not an array', async () => {
    await expect(service.validateAssets({})).rejects.toThrow(
      /data\/assets\.json: top-level JSON value must be an array/,
    );
  });

  it('fails when sources top-level is not an array', async () => {
    await expect(service.validateSources({}, [validAsset])).rejects.toThrow(
      /data\/sources\.json: top-level JSON value must be an array/,
    );
  });

  it('fails when an array item is not an object', async () => {
    await expect(
      service.validateAssets([123 as unknown as Record<string, unknown>]),
    ).rejects.toThrow(/data\/assets\.json: index=0, field=item, expected=plain object/);
  });

  it('fails when unknown field is present', async () => {
    await expect(
      service.validateAssets([{ ...validAsset, unexpectedField: true }]),
    ).rejects.toThrow(/data\/assets\.json: index=0, field=unexpectedField/);
  });

  it('parses algorithm set with multiple values preserving order', async () => {
    const result = await service.validateSources(
      [{ ...validSource, algorithm: `{${Algorithm.COMET},${Algorithm.COMET_STATS}}` }],
      [validAsset],
    );

    expect(result[0].algorithm).toEqual([Algorithm.COMET, Algorithm.COMET_STATS]);
  });

  it('allows braces format with spaces around commas', async () => {
    const result = await service.validateSources(
      [{ ...validSource, algorithm: `{${Algorithm.COMET}, ${Algorithm.COMET_STATS}}` }],
      [validAsset],
    );

    expect(result[0].algorithm).toEqual([Algorithm.COMET, Algorithm.COMET_STATS]);
  });

  it('supports plain single-token fallback algorithm string', async () => {
    const result = await service.validateSources(
      [{ ...validSource, algorithm: Algorithm.REWARDS }],
      [validAsset],
    );

    expect(result[0].algorithm).toEqual([Algorithm.REWARDS]);
  });

  it('fails for invalid asset address', async () => {
    await expect(
      service.validateAssets([{ ...validAsset, address: 'not-an-address' }]),
    ).rejects.toThrow(BadRequestException);

    await expect(
      service.validateAssets([{ ...validAsset, address: 'not-an-address' }]),
    ).rejects.toThrow(/data\/assets\.json: index=0, field=address/);
  });

  it('fails for missing required asset field', async () => {
    const { symbol, ...assetWithoutSymbol } = validAsset;
    void symbol;

    await expect(service.validateAssets([assetWithoutSymbol])).rejects.toThrow(BadRequestException);
    await expect(service.validateAssets([assetWithoutSymbol])).rejects.toThrow(
      /data\/assets\.json: index=0, field=symbol, expected=present/,
    );
  });

  it('fails for wrong type in assets', async () => {
    await expect(service.validateAssets([{ ...validAsset, decimals: '18' }])).rejects.toThrow(
      /data\/assets\.json: index=0, field=decimals, expected=number/,
    );
  });

  it('fails for non-integer asset id', async () => {
    await expect(service.validateAssets([{ ...validAsset, id: 1.5 }])).rejects.toThrow(
      /data\/assets\.json: index=0, field=id, expected=integer > 0/,
    );
  });

  it('fails for non-positive asset id', async () => {
    await expect(service.validateAssets([{ ...validAsset, id: 0 }])).rejects.toThrow(
      /data\/assets\.json: index=0, field=id, expected=integer > 0/,
    );
  });

  it('fails for NaN decimals', async () => {
    await expect(service.validateAssets([{ ...validAsset, decimals: Number.NaN }])).rejects.toThrow(
      /data\/assets\.json: index=0, field=decimals, expected=number/,
    );
  });

  it('fails for out-of-range decimals', async () => {
    await expect(service.validateAssets([{ ...validAsset, decimals: 300 }])).rejects.toThrow(
      /data\/assets\.json: index=0, field=decimals, expected=integer in range 0..255/,
    );
  });

  it('fails for empty symbol after trim', async () => {
    await expect(service.validateAssets([{ ...validAsset, symbol: '   ' }])).rejects.toThrow(
      /data\/assets\.json: index=0, field=symbol, expected=non-empty string/,
    );
  });

  it('fails when source endBlock is lower than startBlock', async () => {
    await expect(
      service.validateSources([{ ...validSource, startBlock: 10, endBlock: 5 }], [validAsset]),
    ).rejects.toThrow(
      /data\/sources\.json: index=0, field=endBlock, expected=endBlock >= startBlock/,
    );
  });

  it('fails when startBlock is negative', async () => {
    await expect(
      service.validateSources([{ ...validSource, startBlock: -1 }], [validAsset]),
    ).rejects.toThrow(/data\/sources\.json: index=0, field=startBlock, expected=integer >= 0/);
  });

  it('fails when endBlock is float', async () => {
    await expect(
      service.validateSources([{ ...validSource, endBlock: 10.2 }], [validAsset]),
    ).rejects.toThrow(
      /data\/sources\.json: index=0, field=endBlock, expected=integer >= 0 or null/,
    );
  });

  it('fails when source algorithm is not in enum', async () => {
    await expect(
      service.validateSources([{ ...validSource, algorithm: '{unknown_algorithm}' }], [validAsset]),
    ).rejects.toThrow(/data\/sources\.json: index=0, field=algorithm/);
  });

  it('fails when source algorithm set is empty', async () => {
    await expect(
      service.validateSources([{ ...validSource, algorithm: '{}' }], [validAsset]),
    ).rejects.toThrow(/data\/sources\.json: index=0, field=algorithm/);
  });

  it('fails when source algorithm has duplicate values', async () => {
    await expect(
      service.validateSources(
        [{ ...validSource, algorithm: `{${Algorithm.COMET},${Algorithm.COMET}}` }],
        [validAsset],
      ),
    ).rejects.toThrow(/data\/sources\.json: index=0, field=algorithm/);
  });

  it('fails when source algorithm has empty token at beginning', async () => {
    await expect(
      service.validateSources(
        [{ ...validSource, algorithm: `{,${Algorithm.COMET}}` }],
        [validAsset],
      ),
    ).rejects.toThrow(/data\/sources\.json: index=0, field=algorithm/);
  });

  it('fails when source algorithm has empty token at end', async () => {
    await expect(
      service.validateSources(
        [{ ...validSource, algorithm: `{${Algorithm.COMET},}` }],
        [validAsset],
      ),
    ).rejects.toThrow(/data\/sources\.json: index=0, field=algorithm/);
  });

  it('fails when source algorithm is not a string', async () => {
    await expect(
      service.validateSources(
        [{ ...validSource, algorithm: [Algorithm.COMET] as unknown as string }],
        [validAsset],
      ),
    ).rejects.toThrow(/data\/sources\.json: index=0, field=algorithm/);
  });

  it('fails for duplicate source id', async () => {
    const source2 = {
      ...validSource,
      address: '0x0000000000000000000000000000000000000020',
    };

    await expect(service.validateSources([validSource, source2], [validAsset])).rejects.toThrow(
      /data\/sources\.json: index=1, field=id, expected=unique integer > 0/,
    );
  });

  it('fails when source assetId does not exist in assets', async () => {
    await expect(
      service.validateSources([{ ...validSource, assetId: 999 }], [validAsset]),
    ).rejects.toThrow(/data\/sources\.json: index=0, field=assetId, expected=existing assets\.id/);
  });

  it('fails when source market is an empty string', async () => {
    await expect(
      service.validateSources([{ ...validSource, market: '   ' }], [validAsset]),
    ).rejects.toThrow(
      /data\/sources\.json: index=0, field=market, expected=null or non-empty string/,
    );
  });

  it('accepts source market as null', async () => {
    const result = await service.validateSources([{ ...validSource, market: null }], [validAsset]);
    expect(result[0].market).toBeNull();
  });

  it('normalizes source market by trimming', async () => {
    const result = await service.validateSources(
      [{ ...validSource, market: ' compound ' }],
      [validAsset],
    );
    expect(result[0].market).toBe('compound');
  });

  it('fails when source market has invalid type', async () => {
    await expect(
      service.validateSources([{ ...validSource, market: 42 as unknown as string }], [validAsset]),
    ).rejects.toThrow(/data\/sources\.json: index=0, field=market, expected=string \| null/);
  });

  it('fails when source endBlock has invalid type', async () => {
    await expect(
      service.validateSources(
        [{ ...validSource, endBlock: '10' as unknown as number }],
        [validAsset],
      ),
    ).rejects.toThrow(/data\/sources\.json: index=0, field=endBlock, expected=number \| null/);
  });

  it('fails when sources item has unknown field', async () => {
    await expect(
      service.validateSources(
        [{ ...validSource, extraField: 'x' } as typeof validSource & { extraField: string }],
        [validAsset],
      ),
    ).rejects.toThrow(/data\/sources\.json: index=0, field=extraField/);
  });

  it('fails when source chainId mismatches referenced asset chainId', async () => {
    await expect(
      service.validateSources([{ ...validSource, chainId: 10 }], [validAsset]),
    ).rejects.toThrow(/data\/sources\.json: index=0, field=chainId/);
  });

  it('collects multiple validation errors in one exception with file/index/field details', async () => {
    await expect(
      service.validateSources(
        [
          {
            ...validSource,
            id: -1,
            address: 'bad-address',
            market: '',
            algorithm: 'bad_algo',
            startBlock: 10,
            endBlock: 5,
            chainId: 0,
            assetId: 999,
            type: ' ',
          },
        ],
        [validAsset],
      ),
    ).rejects.toThrow(BadRequestException);

    try {
      await service.validateSources(
        [
          {
            ...validSource,
            id: -1,
            address: 'bad-address',
            market: '',
            algorithm: 'bad_algo',
            startBlock: 10,
            endBlock: 5,
            chainId: 0,
            assetId: 999,
            type: ' ',
          },
        ],
        [validAsset],
      );
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      const message = (error as Error).message;
      expect(message).toContain('data/sources.json: index=0, field=address');
      expect(message).toContain('data/sources.json: index=0, field=endBlock');
      expect(message).toContain('data/sources.json: index=0, field=assetId');
    }
  });
});
