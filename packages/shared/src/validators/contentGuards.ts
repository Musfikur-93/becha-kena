import { toAsciiDigits } from './primitives.js';

const SPOKEN_DIGITS: Record<string, string> = {
  zero: '0',
  one: '1',
  two: '2',
  three: '3',
  four: '4',
  five: '5',
  six: '6',
  seven: '7',
  eight: '8',
  nine: '9'
};

/**
 * Detects embedded Bangladeshi phone numbers, including Bengali digits (০-৯),
 * spaced/hyphenated/dotted digits ("0 1 7 1 1-223344"), or "plus88017...".
 */
export function containsPhoneNumber(text: string): boolean {
  if (!text) return false;
  let normalized = toAsciiDigits(text).toLowerCase();
  normalized = normalized.replace(/\bplus\b/g, '+');
  normalized = normalized.replace(
    /\b(zero|one|two|three|four|five|six|seven|eight|nine)\b/g,
    (w) => SPOKEN_DIGITS[w] ?? w
  );

  // Match (+88)?01[3-9] followed by 8 digits with optional separators between digits
  const disguisedBdPhone = /(?:\+?8[\s._-]*8[\s._-]*)?0[\s._-]*1[\s._-]*[3-9](?:[\s._-]*\d){8}\b/;
  if (disguisedBdPhone.test(normalized)) {
    return true;
  }

  // Fallback: compact out separators inside digit-heavy runs and test
  const compact = normalized.replace(/(\d)[\s._-]+(?=\d)/g, '$1');
  return /(?:\+?88)?01[3-9]\d{8}/.test(compact);
}

const URL_PATTERNS: RegExp[] = [
  // Standard schemes or www
  /\b(?:https?:\/\/|www\.)\S+/i,
  // Common messaging/shortener domains
  /\b(?:wa\.me|t\.me|bit\.ly|tinyurl\.com|fb\.com|facebook\.com|m\.me|youtu\.be|instagram\.com|telegram\.me)\b/i,
  // Standard domain with TLD (e.g. example.com, shop.com.bd, test.xyz)
  /\b[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.(?:com|net|org|bd|xyz|io|me|co|info|biz|shop|store|online|site|app|ly)\b/i,
  // Obfuscated [dot] / (dot) / " dot " followed by a known TLD
  /\b[a-z0-9-]+\s*(?:\[\s*dot\s*\]|\(\s*dot\s*\)|\s+dot\s+)\s*(?:com|net|org|bd|xyz|io|me|co|ly|info|biz|shop)\b/i,
  // Obfuscated space around period before a known TLD: "example . com"
  /\b[a-z0-9-]+\s+\.\s+(?:com|net|org|bd|xyz|io|me|co|ly)\b/i
];

/**
 * Detects external URLs, shorteners, messaging handles, and obfuscated domains
 * without triggering false positives on ordinary English words like "dotted" or "company".
 */
export function containsUrl(text: string): boolean {
  if (!text) return false;
  return URL_PATTERNS.some((pattern) => pattern.test(text));
}

export function containsProhibitedContactOrUrl(text: string): boolean {
  return containsPhoneNumber(text) || containsUrl(text);
}
