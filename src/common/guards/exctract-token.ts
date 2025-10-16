export const extractToken = (bearer: string): string => {
  const [, token] = bearer.split(' ');
  return token ?? '';
};
