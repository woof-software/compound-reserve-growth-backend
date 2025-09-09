// Jest setup file to handle BigInt serialization
// This fixes the "Do not know how to serialize a BigInt" error

// Add BigInt support to JSON.stringify
BigInt.prototype.toJSON = function () {
  return this.toString();
};

// Override the default serializer for Jest
expect.addSnapshotSerializer({
  test: (val) => typeof val === 'bigint',
  print: (val) => `BigInt(${val.toString()})`,
});

// Handle BigInt in expect.toEqual and other matchers
expect.extend({
  toEqualBigInt(received: any, expected: any) {
    if (typeof received === 'bigint' && typeof expected === 'bigint') {
      const pass = received === expected;
      return {
        message: () =>
          `expected ${received.toString()} ${pass ? 'not ' : ''}to equal ${expected.toString()}`,
        pass,
      };
    }
    return {
      message: () => `expected BigInt values but got ${typeof received} and ${typeof expected}`,
      pass: false,
    };
  },
});

// Extend the Jest matchers type
declare global {
  namespace jest {
    interface Matchers<R> {
      toEqualBigInt(expected: bigint): R;
    }
  }
}

// Monkey patch JSON.stringify to handle BigInt
const originalStringify = JSON.stringify;
JSON.stringify = function (value, replacer, space) {
  const customReplacer = (key: string, val: any) => {
    if (typeof val === 'bigint') {
      return val.toString();
    }
    return replacer ? replacer(key, val) : val;
  };
  return originalStringify.call(this, value, customReplacer, space);
};
