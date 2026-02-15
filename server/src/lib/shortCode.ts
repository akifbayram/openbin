import crypto from 'crypto';

const SHORT_CODE_CHARSET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

export function generateShortCode(): string {
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += SHORT_CODE_CHARSET[crypto.randomInt(SHORT_CODE_CHARSET.length)];
  }
  return code;
}
