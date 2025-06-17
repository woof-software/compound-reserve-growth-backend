export type TGetRandomNumber = (min?: number, max?: number) => number;

export const getRandomNumber: TGetRandomNumber = (min = 1, max = 1000000) => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};
