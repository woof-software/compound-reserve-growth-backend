import { ValueTransformer } from 'typeorm';

export const BigIntTransformer = {
  to: (value: bigint) => (value === null || value === undefined ? null : value.toString()),
  from: (value: string) => value,
} as ValueTransformer;
