import { BadRequestException } from '@nestjs/common';
import { getAddress, isAddress } from 'ethers';

import type {
  AssetCtx,
  NormalizedSource,
  SourceCtx,
  ValidatedAsset,
  ValidatedSource,
  ValidationContext,
  ValidationIssue,
  ValidationMiddleware,
} from 'modules/sources-update/types/sources-validator.types';

import { ENFORCE_SOURCE_ASSET_CHAIN_MATCH } from '@/modules/sources-update/sources-validator.config';
import { Algorithm } from '@/common/enum/algorithm.enum';

const ALGORITHM_VALUES = new Set<Algorithm>(Object.values(Algorithm));

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (typeof value !== 'object' || value === null) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
};

const describeValue = (value: unknown): string => {
  if (value === null) return 'null';
  if (typeof value === 'string') return `"${value}"`;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return 'array';
  return typeof value;
};

const readNumberField = (
  ctx: ValidationContext,
  field: string,
  expected: string,
): number | null => {
  if (!ctx.itemRecord) return null;
  const value = ctx.itemRecord[field];
  if (typeof value !== 'number' || Number.isNaN(value)) {
    ctx.addIssue(field, expected, value, 'Invalid field type');
    return null;
  }
  return value;
};

const readStringField = (
  ctx: ValidationContext,
  field: string,
  expected: string,
): string | null => {
  if (!ctx.itemRecord) return null;
  const value = ctx.itemRecord[field];
  if (typeof value !== 'string') {
    ctx.addIssue(field, expected, value, 'Invalid field type');
    return null;
  }
  return value;
};

const validateCommonFieldTypes = (ctx: ValidationContext): void => {
  const id = readNumberField(ctx, 'id', 'number');
  if (id !== null) ctx.normalized.id = id;

  const address = readStringField(ctx, 'address', 'string');
  if (address !== null) ctx.normalized.address = address;

  const chainId = readNumberField(ctx, 'chainId', 'number');
  if (chainId !== null) ctx.normalized.chainId = chainId;

  const type = readStringField(ctx, 'type', 'string');
  if (type !== null) ctx.normalized.type = type;
};

const validateSourceMarketType = (ctx: SourceCtx): void => {
  const marketValue = ctx.itemRecord?.market;
  if (marketValue !== null && typeof marketValue !== 'string') {
    ctx.addIssue('market', 'string | null', marketValue, 'Invalid field type');
    return;
  }
  ctx.normalized.market = (marketValue ?? null) as string | null;
};

const validateSourceAlgorithmType = (ctx: SourceCtx): void => {
  const algorithm = readStringField(ctx, 'algorithm', 'string');
  if (algorithm !== null) ctx.normalized.algorithm = algorithm;
};

const validateSourceStartBlockType = (ctx: SourceCtx): void => {
  const startBlock = readNumberField(ctx, 'startBlock', 'number');
  if (startBlock !== null) ctx.normalized.startBlock = startBlock;
};

const validateSourceEndBlockType = (ctx: SourceCtx): void => {
  const endBlockValue = ctx.itemRecord?.endBlock;
  if (
    endBlockValue !== null &&
    (typeof endBlockValue !== 'number' || Number.isNaN(endBlockValue))
  ) {
    ctx.addIssue('endBlock', 'number | null', endBlockValue, 'Invalid field type');
    return;
  }
  ctx.normalized.endBlock = (endBlockValue ?? null) as number | null;
};

const validateSourceAssetIdType = (ctx: SourceCtx): void => {
  const assetId = readNumberField(ctx, 'assetId', 'number');
  if (assetId !== null) ctx.normalized.assetId = assetId;
};

const stripBraces = (value: string): string => {
  if (!value.startsWith('{') || !value.endsWith('}')) {
    throw new Error('Algorithm set must start with "{" and end with "}"');
  }
  return value.slice(1, -1).trim();
};

const normalizeToken = (value: string): string => value.trim();

const splitTokens = (value: string): string[] => {
  if (value.length === 0) {
    throw new Error('Algorithm set must not be empty');
  }
  const tokens = value.split(',').map((token) => normalizeToken(token));
  if (tokens.some((token) => token.length === 0)) {
    throw new Error('Algorithm set contains an empty token');
  }
  return tokens;
};

const toAlgorithm = (value: string): Algorithm => {
  const parsed = value as Algorithm;
  if (!ALGORITHM_VALUES.has(parsed)) {
    throw new Error(`Unsupported algorithm token: ${value}`);
  }
  return parsed;
};

const ensureNoDuplicates = (values: Algorithm[]): void => {
  const seen = new Set<Algorithm>();
  for (const value of values) {
    if (seen.has(value)) {
      throw new Error(`Duplicate algorithm token: ${value}`);
    }
    seen.add(value);
  }
};

const validateInteger = (
  ctx: ValidationContext,
  field: string,
  value: unknown,
  expected: string,
  min: number,
): void => {
  if (typeof value !== 'number') return;
  if (!Number.isInteger(value) || value < min) {
    ctx.addIssue(field, expected, value, 'Out of range');
  }
};

const validateNullableInteger = (
  ctx: ValidationContext,
  field: string,
  value: unknown,
  expected: string,
  min: number,
): void => {
  if (value === null || typeof value === 'undefined') return;
  validateInteger(ctx, field, value, expected, min);
};

const validateNonNegative = (ctx: ValidationContext, field: string, value: unknown): void => {
  validateInteger(ctx, field, value, 'integer >= 0', 0);
};

const validateEndBlockNotBeforeStart = (
  ctx: SourceCtx,
  startBlock: unknown,
  endBlock: unknown,
): void => {
  if (typeof startBlock !== 'number' || typeof endBlock !== 'number') return;
  if (endBlock >= startBlock) return;
  ctx.addIssue('endBlock', 'endBlock >= startBlock', endBlock, `startBlock=${startBlock}`);
};

const validateIdRange = (ctx: ValidationContext): void => {
  if (typeof ctx.normalized.id !== 'number') return;

  if (!Number.isInteger(ctx.normalized.id) || ctx.normalized.id <= 0) {
    ctx.addIssue('id', 'integer > 0', ctx.normalized.id, 'Out of range');
    return;
  }

  const firstIndex = ctx.meta.seenIds.get(ctx.normalized.id);
  if (firstIndex !== undefined) {
    ctx.addIssue(
      'id',
      'unique integer > 0',
      ctx.normalized.id,
      `Duplicate id (first seen at index ${firstIndex})`,
    );
    return;
  }

  ctx.meta.seenIds.set(ctx.normalized.id, ctx.index);
};

export const composeValidationMiddlewares = <Ctx extends object>(
  middlewares: ValidationMiddleware<Ctx>[],
): ((ctx: Ctx) => Promise<void>) => {
  return async (ctx: Ctx) => {
    let index = -1;

    const dispatch = async (middlewareIndex: number): Promise<void> => {
      if (middlewareIndex <= index) {
        throw new Error('Validation middleware next() called multiple times');
      }
      index = middlewareIndex;
      const middleware = middlewares[middlewareIndex];
      if (!middleware) return;

      await middleware(ctx, async () => {
        await dispatch(middlewareIndex + 1);
      });
    };

    await dispatch(0);
  };
};

export const toMiddleware = <Ctx extends object>(
  handler: (ctx: Ctx) => void,
): ValidationMiddleware<Ctx> => {
  return async (ctx, next) => {
    handler(ctx);
    await next();
  };
};

export const formatIssue = (issue: ValidationIssue): string => {
  const indexPart = issue.index === null ? 'index=n/a' : `index=${issue.index}`;
  const base = `${issue.filePath}: ${indexPart}, field=${issue.field}, expected=${issue.expected}, received=${describeValue(issue.received)}`;
  return issue.reason ? `${base}, reason=${issue.reason}` : base;
};

export const ensureArray = (raw: unknown, filePath: string): unknown[] => {
  if (!Array.isArray(raw)) {
    throw new BadRequestException(
      `${filePath}: top-level JSON value must be an array, received=${describeValue(raw)}`,
    );
  }
  return raw;
};

export const ensureObject = (ctx: ValidationContext): void => {
  if (ctx.stop) return;
  if (!isPlainObject(ctx.item)) {
    ctx.addIssue('item', 'plain object', ctx.item, 'Each array element must be an object');
    ctx.stop = true;
    return;
  }
  ctx.itemRecord = ctx.item;
};

export const rejectUnknownFields = (ctx: ValidationContext): void => {
  if (ctx.stop || !ctx.itemRecord) return;

  for (const field of Object.keys(ctx.itemRecord)) {
    if (!ctx.meta.knownFields.has(field)) {
      ctx.addIssue(
        field,
        `known field (${ctx.meta.requiredFields.join(', ')})`,
        ctx.itemRecord[field],
        'Unknown field',
      );
    }
  }
};

export const validateRequiredFieldsPresence = (ctx: ValidationContext): void => {
  if (ctx.stop || !ctx.itemRecord) return;

  for (const field of ctx.meta.requiredFields) {
    if (!Object.prototype.hasOwnProperty.call(ctx.itemRecord, field)) {
      ctx.addIssue(field, 'present', undefined, 'Missing required field');
    }
  }
};

export const validateAssetFieldTypes = (ctx: AssetCtx): void => {
  validateCommonFieldTypes(ctx);

  const decimals = readNumberField(ctx, 'decimals', 'number');
  if (decimals !== null) ctx.normalized.decimals = decimals;

  const symbol = readStringField(ctx, 'symbol', 'string');
  if (symbol !== null) ctx.normalized.symbol = symbol;
};

export const validateSourceFieldTypes = (ctx: SourceCtx): void => {
  validateCommonFieldTypes(ctx);
  validateSourceMarketType(ctx);
  validateSourceAlgorithmType(ctx);
  validateSourceStartBlockType(ctx);
  validateSourceEndBlockType(ctx);
  validateSourceAssetIdType(ctx);
};

export const validateAddress = (ctx: ValidationContext): void => {
  if (ctx.stop || typeof ctx.normalized.address !== 'string') return;

  if (!isAddress(ctx.normalized.address)) {
    ctx.addIssue('address', 'valid EVM address', ctx.normalized.address, 'Invalid address');
    return;
  }

  ctx.normalized.address = getAddress(ctx.normalized.address);
};

export const parseAlgorithmSet = (input: string): Algorithm[] => {
  const raw = input.trim();

  if (raw.startsWith('{') || raw.endsWith('}')) {
    const inner = stripBraces(raw);
    const tokens = splitTokens(inner);
    const parsed = tokens.map((token) => toAlgorithm(token));
    ensureNoDuplicates(parsed);
    return parsed;
  }

  return [toAlgorithm(raw)];
};

export const validateAndParseAlgorithmSet = (ctx: SourceCtx): void => {
  if (ctx.stop || typeof ctx.normalized.algorithm !== 'string') return;
  try {
    ctx.normalized.algorithm = parseAlgorithmSet(ctx.normalized.algorithm);
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Invalid algorithm set format';
    ctx.addIssue(
      'algorithm',
      'string in "{algo}" or "{algo1,algo2}" format (or single enum token fallback)',
      ctx.normalized.algorithm,
      reason,
    );
  }
};

export const validateCommonRanges = (ctx: ValidationContext): void => {
  validateIdRange(ctx);
  validateInteger(ctx, 'chainId', ctx.normalized.chainId, 'integer > 0', 1);

  if (typeof ctx.normalized.type === 'string') {
    const trimmed = ctx.normalized.type.trim();
    if (trimmed.length === 0) {
      ctx.addIssue('type', 'non-empty string', ctx.normalized.type, 'Must not be empty');
    } else {
      ctx.normalized.type = trimmed;
    }
  }
};

export const validateAssetRanges = (ctx: AssetCtx): void => {
  validateCommonRanges(ctx);

  if (typeof ctx.normalized.decimals === 'number') {
    const invalidDecimals =
      !Number.isInteger(ctx.normalized.decimals) ||
      ctx.normalized.decimals < 0 ||
      ctx.normalized.decimals > 255;
    if (invalidDecimals) {
      ctx.addIssue('decimals', 'integer in range 0..255', ctx.normalized.decimals, 'Out of range');
    }
  }

  if (typeof ctx.normalized.symbol === 'string') {
    const trimmed = ctx.normalized.symbol.trim();
    if (trimmed.length === 0) {
      ctx.addIssue('symbol', 'non-empty string', ctx.normalized.symbol, 'Must not be empty');
    } else {
      ctx.normalized.symbol = trimmed;
    }
  }
};

export const validateSourceRanges = (ctx: SourceCtx): void => {
  validateCommonRanges(ctx);

  if (typeof ctx.normalized.market === 'string') {
    const trimmed = ctx.normalized.market.trim();
    if (trimmed.length === 0) {
      ctx.addIssue(
        'market',
        'null or non-empty string',
        ctx.normalized.market,
        'Must not be empty',
      );
    } else {
      ctx.normalized.market = trimmed;
    }
  }

  validateInteger(ctx, 'assetId', ctx.normalized.assetId, 'integer > 0', 1);
  validateNonNegative(ctx, 'startBlock', ctx.normalized.startBlock);
  validateNullableInteger(ctx, 'endBlock', ctx.normalized.endBlock, 'integer >= 0 or null', 0);
  validateEndBlockNotBeforeStart(ctx, ctx.normalized.startBlock, ctx.normalized.endBlock);
};

export const validateRelations = (ctx: SourceCtx): void => {
  if (ctx.stop || typeof ctx.normalized.assetId !== 'number') return;

  const asset = ctx.assetsById.get(ctx.normalized.assetId);
  if (!asset) {
    ctx.addIssue(
      'assetId',
      'existing assets.id',
      ctx.normalized.assetId,
      'Referenced asset was not found',
    );
    return;
  }

  if (
    ENFORCE_SOURCE_ASSET_CHAIN_MATCH &&
    typeof ctx.normalized.chainId === 'number' &&
    ctx.normalized.chainId !== asset.chainId
  ) {
    ctx.addIssue(
      'chainId',
      `must match assetId=${asset.id} chainId (${asset.chainId})`,
      ctx.normalized.chainId,
      'Source chain and asset chain mismatch',
    );
  }
};

export const isValidatedAsset = (value: Partial<ValidatedAsset>): value is ValidatedAsset => {
  return (
    typeof value.id === 'number' &&
    typeof value.address === 'string' &&
    typeof value.decimals === 'number' &&
    typeof value.symbol === 'string' &&
    typeof value.chainId === 'number' &&
    typeof value.type === 'string'
  );
};

export const isValidatedSource = (value: Partial<NormalizedSource>): value is ValidatedSource => {
  return (
    typeof value.id === 'number' &&
    typeof value.address === 'string' &&
    (typeof value.market === 'string' || value.market === null) &&
    Array.isArray(value.algorithm) &&
    value.algorithm.length > 0 &&
    typeof value.startBlock === 'number' &&
    (typeof value.endBlock === 'number' || value.endBlock === null) &&
    typeof value.chainId === 'number' &&
    typeof value.assetId === 'number' &&
    typeof value.type === 'string'
  );
};
