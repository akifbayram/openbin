import crypto from 'node:crypto';

const LETTER_CHARSET = 'ABCDEFGHJKMNPQRTUVWXY';

const STOP_WORDS = new Set([
  'THE', 'A', 'AN', 'MY', 'OF', 'FOR', 'AND', 'OR', 'IN', 'ON', 'AT', 'TO', 'IS', 'IT', 'BY', 'WITH',
]);

const VOWELS = new Set('AEIOU');

function isConsonant(ch: string): boolean {
  return /[A-Z]/.test(ch) && !VOWELS.has(ch);
}

export function derivePrefix(name: string): string {
  // Normalize: strip accents, keep only letters/spaces, uppercase
  const normalized = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z\s]/g, '')
    .toUpperCase()
    .trim();

  // Split into words and filter stop words
  const allWords = normalized.split(/\s+/).filter(Boolean);
  const words = allWords.filter((w) => !STOP_WORDS.has(w));

  // If all words were stop words, use the original words
  const effective = words.length > 0 ? words : allWords;

  if (effective.length === 0 || effective.join('').length === 0) {
    return 'BIN';
  }

  if (effective.length >= 3) {
    // Acronym: first letter of first 3 words
    return (effective[0][0] + effective[1][0] + effective[2][0]).toUpperCase();
  }

  if (effective.length === 2) {
    // First letter of each word + second consonant of longer word
    const first = effective[0][0];
    const second = effective[1][0];
    const longer = effective[0].length >= effective[1].length ? effective[0] : effective[1];
    // Find the second consonant in the longer word (skip first char)
    let thirdChar = '';
    for (let i = 1; i < longer.length; i++) {
      if (isConsonant(longer[i])) {
        thirdChar = longer[i];
        break;
      }
    }
    // Fallback: use third letter of longer word, or last letter
    if (!thirdChar) {
      thirdChar = longer.length >= 3 ? longer[2] : longer[longer.length - 1];
    }
    return (first + second + thirdChar).toUpperCase();
  }

  // Single word
  const word = effective[0];
  if (word.length <= 2) {
    return (word + 'X'.repeat(3 - word.length)).toUpperCase();
  }

  // First 3 consonants
  const consonants: string[] = [];
  for (const ch of word) {
    if (isConsonant(ch)) {
      consonants.push(ch);
      if (consonants.length === 3) break;
    }
  }
  if (consonants.length === 3) {
    return consonants.join('').toUpperCase();
  }

  // Fallback: first 3 letters
  return word.slice(0, 3).toUpperCase();
}

function randomLetters(count: number): string {
  let result = '';
  for (let i = 0; i < count; i++) {
    result += LETTER_CHARSET[crypto.randomInt(LETTER_CHARSET.length)];
  }
  return result;
}

function generateRandomCode(): string {
  return randomLetters(6);
}

export function generateShortCode(name?: string, prefix?: string): string {
  // Validate and clean prefix if provided
  let resolvedPrefix = '';
  if (prefix) {
    resolvedPrefix = prefix.replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 3);
  }
  // Fall back to name derivation if prefix is missing or too short
  if (resolvedPrefix.length !== 3 && name) {
    resolvedPrefix = derivePrefix(name);
  }

  if (!resolvedPrefix || resolvedPrefix.length !== 3) {
    return generateRandomCode();
  }

  return resolvedPrefix + randomLetters(3);
}
