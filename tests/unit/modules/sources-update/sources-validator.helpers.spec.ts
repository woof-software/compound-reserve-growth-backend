import { Algorithm } from '@/common/enum/algorithm.enum';
import {
  composeValidationMiddlewares,
  parseAlgorithmSet,
} from '@/modules/sources-update/helpers/sources-validator.helpers';

describe('sources-validator helpers', () => {
  describe('parseAlgorithmSet', () => {
    it('parses single braces token', () => {
      expect(parseAlgorithmSet(`{${Algorithm.REWARDS}}`)).toEqual([Algorithm.REWARDS]);
    });

    it('parses multiple braces tokens preserving order', () => {
      expect(parseAlgorithmSet(`{${Algorithm.COMET},${Algorithm.COMET_STATS}}`)).toEqual([
        Algorithm.COMET,
        Algorithm.COMET_STATS,
      ]);
    });

    it('parses braces tokens with spaces', () => {
      expect(parseAlgorithmSet(`{ ${Algorithm.COMET} , ${Algorithm.COMET_STATS} }`)).toEqual([
        Algorithm.COMET,
        Algorithm.COMET_STATS,
      ]);
    });

    it('supports plain single-token fallback', () => {
      expect(parseAlgorithmSet(Algorithm.COMET)).toEqual([Algorithm.COMET]);
    });

    it('rejects empty set', () => {
      expect(() => parseAlgorithmSet('{}')).toThrow('Algorithm set must not be empty');
    });

    it('rejects empty token', () => {
      expect(() => parseAlgorithmSet(`{${Algorithm.COMET},}`)).toThrow(
        'Algorithm set contains an empty token',
      );
    });

    it('rejects unknown token', () => {
      expect(() => parseAlgorithmSet('{unknown_algo}')).toThrow(
        'Unsupported algorithm token: unknown_algo',
      );
    });

    it('rejects duplicate token', () => {
      expect(() => parseAlgorithmSet(`{${Algorithm.COMET},${Algorithm.COMET}}`)).toThrow(
        `Duplicate algorithm token: ${Algorithm.COMET}`,
      );
    });

    it('rejects malformed braces format', () => {
      expect(() => parseAlgorithmSet(`{${Algorithm.COMET}`)).toThrow(
        'Algorithm set must start with "{" and end with "}"',
      );
    });
  });

  describe('composeValidationMiddlewares', () => {
    type TestCtx = { value: number; order: string[] };

    it('executes middleware chain in order', async () => {
      const run = composeValidationMiddlewares<TestCtx>([
        async (ctx, next) => {
          ctx.order.push('first');
          ctx.value += 1;
          await next();
        },
        async (ctx, next) => {
          ctx.order.push('second');
          ctx.value += 2;
          await next();
        },
      ]);

      const ctx: TestCtx = { value: 0, order: [] };
      await run(ctx);

      expect(ctx.value).toBe(3);
      expect(ctx.order).toEqual(['first', 'second']);
    });

    it('throws if next() called multiple times', async () => {
      const run = composeValidationMiddlewares<TestCtx>([
        async (_ctx, next) => {
          await next();
          await next();
        },
      ]);

      await expect(run({ value: 0, order: [] })).rejects.toThrow(
        'Validation middleware next() called multiple times',
      );
    });
  });
});
