import { Transform } from 'class-transformer';

export function ToTitleCase() {
  return Transform(({ value }) => {
    if (typeof value !== 'string') return value;
    return value
      .trim()
      .toLowerCase()
      .split(/(\s+|-)/)
      .map((chunk) =>
        /(\s+|-)/.test(chunk) ? chunk : chunk.charAt(0).toUpperCase() + chunk.slice(1),
      )
      .join('');
  });
}
