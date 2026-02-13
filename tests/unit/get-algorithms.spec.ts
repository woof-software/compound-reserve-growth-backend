import { Algorithm } from '../../src/common/enum/algorithm.enum';
import { getAlgorithms } from '../../src/common/utils/get-algorithms';

describe('getAlgorithms', () => {
  describe('valid input: array with at least one non-empty value', () => {
    it('returns same-order array for single non-empty string', () => {
      expect(getAlgorithms([Algorithm.COMET])).toEqual([Algorithm.COMET]);
    });

    it('returns array for multiple non-empty strings', () => {
      expect(getAlgorithms([Algorithm.COMET, Algorithm.COMET_STATS])).toEqual([
        Algorithm.COMET,
        Algorithm.COMET_STATS,
      ]);
    });

    it('coerces non-string elements to string', () => {
      expect(getAlgorithms([123, Algorithm.REWARDS])).toEqual(['123', Algorithm.REWARDS]);
    });

    it('does not trim values (data not modified)', () => {
      expect(getAlgorithms([`  ${Algorithm.COMET}  `])).toEqual([`  ${Algorithm.COMET}  `]);
    });

    it('allows mixed empty and non-empty strings, returns full list', () => {
      expect(getAlgorithms(['', Algorithm.MARKET_V2, ''])).toEqual(['', Algorithm.MARKET_V2, '']);
    });
  });

  describe('invalid input: not an array', () => {
    it('throws when value is a string with braces (DB array literal)', () => {
      expect(() => getAlgorithms('{comet,comet_stats}')).toThrow(
        'Source algorithm must be a JSON array, not a string with braces',
      );
    });

    it('throws when value is a string with only braces', () => {
      expect(() => getAlgorithms('{}')).toThrow(
        'Source algorithm must be a JSON array, not a string with braces',
      );
    });

    it('throws when value is a plain string (no braces)', () => {
      expect(() => getAlgorithms(Algorithm.COMET)).toThrow(
        'Source algorithm must be an array, got string',
      );
    });

    it('throws when value is a number', () => {
      expect(() => getAlgorithms(1)).toThrow('Source algorithm must be an array, got number');
    });

    it('throws when value is null', () => {
      expect(() => getAlgorithms(null)).toThrow('Source algorithm must be an array, got object');
    });

    it('throws when value is a plain object', () => {
      expect(() => getAlgorithms({})).toThrow('Source algorithm must be an array, got object');
    });

    it('throws when value is undefined', () => {
      expect(() => getAlgorithms(undefined)).toThrow(
        'Source algorithm must be an array, got undefined',
      );
    });
  });

  describe('invalid input: array but empty or all empty/whitespace', () => {
    it('throws when array is empty', () => {
      expect(() => getAlgorithms([])).toThrow('Source algorithm must not be empty');
    });

    it('throws when array has only empty strings', () => {
      expect(() => getAlgorithms(['', ''])).toThrow(
        'Source algorithm must contain at least one non-empty value',
      );
    });

    it('throws when array has only whitespace strings', () => {
      expect(() => getAlgorithms(['  ', '\t'])).toThrow(
        'Source algorithm must contain at least one non-empty value',
      );
    });
  });

  describe('edge cases', () => {
    it('single whitespace-only string throws', () => {
      expect(() => getAlgorithms([' '])).toThrow(
        'Source algorithm must contain at least one non-empty value',
      );
    });

    it('string with braces and spaces still triggers braces error', () => {
      expect(() => getAlgorithms('{ comet , comet_stats }')).toThrow(
        'Source algorithm must be a JSON array, not a string with braces',
      );
    });
  });
});
