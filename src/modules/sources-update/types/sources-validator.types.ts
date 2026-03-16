import type { Algorithm } from '@/common/enum/algorithm.enum';
import type { FileKind } from '@/modules/sources-update/sources-validator.config';
import type {
  RemoteAsset,
  RemoteSource,
} from '@/modules/sources-update/types/remote-reserve-sources.types';

export type NextMiddleware = () => Promise<void>;

export interface ValidatedAsset extends Omit<RemoteAsset, 'type'> {
  type: string;
}

export interface ValidatedSource extends Omit<RemoteSource, 'algorithm' | 'type'> {
  algorithm: Algorithm[];
  type: string;
}

export interface NormalizedSource extends Omit<ValidatedSource, 'algorithm'> {
  algorithm: string | Algorithm[];
}

export interface ValidationIssue {
  filePath: string;
  index: number | null;
  field: string;
  expected: string;
  received: unknown;
  reason?: string;
}

export interface ValidationMeta {
  requiredFields: readonly string[];
  knownFields: ReadonlySet<string>;
  seenIds: Map<number, number>;
}

export interface ValidationContextBase {
  file: FileKind;
  filePath: string;
  index: number;
  item: unknown;
  issues: ValidationIssue[];
  meta: ValidationMeta;
  itemRecord: Record<string, unknown> | null;
  stop: boolean;
  itemIssuesCount: number;
  addIssue: (field: string, expected: string, received: unknown, reason?: string) => void;
}

export interface AssetCtx extends ValidationContextBase {
  file: 'assets';
  normalized: Partial<ValidatedAsset>;
  assetsById: Map<number, ValidatedAsset>;
}

export interface SourceCtx extends ValidationContextBase {
  file: 'sources';
  normalized: Partial<NormalizedSource>;
  assetsById: Map<number, ValidatedAsset>;
}

export type ValidationContext = AssetCtx | SourceCtx;

export type ValidationMiddleware<Ctx extends object> = (
  ctx: Ctx,
  next: NextMiddleware,
) => Promise<void> | void;
