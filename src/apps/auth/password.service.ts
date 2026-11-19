import argon2 from 'argon2';

export const passwordService = {
  hash: (plain: string) => argon2.hash(plain),

  verify: (hash: string, plain: string) => argon2.verify(hash, plain).catch(() => false),
};
