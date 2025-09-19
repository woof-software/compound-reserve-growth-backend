export function scientificToDecimal(num: string | number): string {
  const str = num.toString();
  // (!/\d+\.?\d*e[+\-]*\d+/i.test(str))
  if (!str.includes('e')) return str;
  const [coeff, exp] = str.toLowerCase().split('e');
  const e = parseInt(exp, 10);
  const [integer, frac = ''] = coeff.split('.');

  if (e < 0) {
    const zeroes = Math.abs(e) - integer.length;
    return '0.' + '0'.repeat(zeroes > 0 ? zeroes : 0) + integer + frac;
  } else {
    const needed = e - frac.length;
    return (
      integer +
      frac +
      '0'.repeat(needed > 0 ? needed : 0) +
      (needed < 0 ? '.' + frac.slice(frac.length + needed) : '')
    );
  }
}
