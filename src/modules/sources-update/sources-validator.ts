import { BadRequestException, Injectable } from '@nestjs/common';

import {
  ASSETS_FILE_PATH,
  ASSET_FIELDS,
  SOURCES_FILE_PATH,
  SOURCE_FIELDS,
  type FileKind,
} from './sources-validator.config';
import {
  composeValidationMiddlewares,
  ensureArray,
  ensureObject,
  formatIssue,
  isValidatedAsset,
  isValidatedSource,
  rejectUnknownFields,
  toMiddleware,
  validateAddress,
  validateAndParseAlgorithmSet,
  validateAssetFieldTypes,
  validateAssetRanges,
  validateRelations,
  validateRequiredFieldsPresence,
  validateSourceFieldTypes,
  validateSourceRanges,
} from './helpers/sources-validator.helpers';
import type {
  AssetCtx,
  SourceCtx,
  ValidatedAsset,
  ValidatedSource,
  ValidationContextBase,
  ValidationIssue,
  ValidationMeta,
} from './types/sources-validator.types';

@Injectable()
export class SourcesUpdateValidationService {
  async validateAll(input: {
    assetsRaw: unknown;
    sourcesRaw: unknown;
  }): Promise<{ assets: ValidatedAsset[]; sources: ValidatedSource[] }> {
    const assets = await this.validateAssets(input.assetsRaw);
    const sources = await this.validateSources(input.sourcesRaw, assets);
    return { assets, sources };
  }

  async validateAssets(raw: unknown): Promise<ValidatedAsset[]> {
    const list = ensureArray(raw, ASSETS_FILE_PATH);
    const issues: ValidationIssue[] = [];

    const runPipeline = composeValidationMiddlewares<AssetCtx>([
      toMiddleware(ensureObject),
      toMiddleware(rejectUnknownFields),
      toMiddleware(validateRequiredFieldsPresence),
      toMiddleware(validateAssetFieldTypes),
      toMiddleware(validateAddress),
      toMiddleware(validateAssetRanges),
    ]);

    const assets: ValidatedAsset[] = [];
    const meta = this.createValidationMeta(ASSET_FIELDS);

    for (let index = 0; index < list.length; index += 1) {
      const ctx = this.createAssetContext({ index, item: list[index], issues, meta });
      await runPipeline(ctx);

      if (ctx.itemIssuesCount === 0 && isValidatedAsset(ctx.normalized)) {
        assets.push(ctx.normalized);
      }
    }

    this.throwIfIssues(issues);
    return assets;
  }

  async validateSources(raw: unknown, assets: ValidatedAsset[]): Promise<ValidatedSource[]> {
    const list = ensureArray(raw, SOURCES_FILE_PATH);
    const issues: ValidationIssue[] = [];
    const assetsById = new Map<number, ValidatedAsset>(assets.map((asset) => [asset.id, asset]));

    const runPipeline = composeValidationMiddlewares<SourceCtx>([
      toMiddleware(ensureObject),
      toMiddleware(rejectUnknownFields),
      toMiddleware(validateRequiredFieldsPresence),
      toMiddleware(validateSourceFieldTypes),
      toMiddleware(validateAddress),
      toMiddleware(validateAndParseAlgorithmSet),
      toMiddleware(validateSourceRanges),
      toMiddleware(validateRelations),
    ]);

    const sources: ValidatedSource[] = [];
    const meta = this.createValidationMeta(SOURCE_FIELDS);

    for (let index = 0; index < list.length; index += 1) {
      const ctx = this.createSourceContext({
        index,
        item: list[index],
        issues,
        meta,
        assetsById,
      });
      await runPipeline(ctx);

      if (ctx.itemIssuesCount === 0 && isValidatedSource(ctx.normalized)) {
        sources.push(ctx.normalized);
      }
    }

    this.throwIfIssues(issues);
    return sources;
  }

  private createValidationMeta(fields: readonly string[]): ValidationMeta {
    return {
      requiredFields: fields,
      knownFields: new Set<string>(fields),
      seenIds: new Map<number, number>(),
    };
  }

  private createAssetContext(params: {
    index: number;
    item: unknown;
    issues: ValidationIssue[];
    meta: ValidationMeta;
  }): AssetCtx {
    return {
      ...this.createBaseContext({
        file: 'assets',
        filePath: ASSETS_FILE_PATH,
        index: params.index,
        item: params.item,
        issues: params.issues,
        meta: params.meta,
      }),
      normalized: {},
      assetsById: new Map<number, ValidatedAsset>(),
    };
  }

  private createSourceContext(params: {
    index: number;
    item: unknown;
    issues: ValidationIssue[];
    meta: ValidationMeta;
    assetsById: Map<number, ValidatedAsset>;
  }): SourceCtx {
    return {
      ...this.createBaseContext({
        file: 'sources',
        filePath: SOURCES_FILE_PATH,
        index: params.index,
        item: params.item,
        issues: params.issues,
        meta: params.meta,
      }),
      normalized: {},
      assetsById: params.assetsById,
    };
  }

  private createBaseContext<F extends FileKind>(params: {
    file: F;
    filePath: string;
    index: number;
    item: unknown;
    issues: ValidationIssue[];
    meta: ValidationMeta;
  }): ValidationContextBase & { file: F } {
    const itemStartCount = params.issues.length;

    const baseCtx: ValidationContextBase & { file: F } = {
      file: params.file,
      filePath: params.filePath,
      index: params.index,
      item: params.item,
      issues: params.issues,
      meta: params.meta,
      itemRecord: null,
      stop: false,
      itemIssuesCount: 0,
      addIssue: (field: string, expected: string, received: unknown, reason?: string) => {
        params.issues.push({
          filePath: params.filePath,
          index: params.index,
          field,
          expected,
          received,
          reason,
        });
        baseCtx.itemIssuesCount = params.issues.length - itemStartCount;
      },
    };

    return baseCtx;
  }

  private throwIfIssues(issues: ValidationIssue[]): void {
    if (!issues.length) return;

    const details = issues.map((issue) => `- ${formatIssue(issue)}`).join('\n');
    throw new BadRequestException(`Invalid reserve source JSON:\n${details}`);
  }
}
