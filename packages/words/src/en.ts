import type { EnglishNoun } from './currencies.ts';

const SMALL = [
  '', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen',
];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const SCALES = ['', 'thousand', 'million', 'billion', 'trillion', 'quadrillion'];

const belowThousand = (v: number): string => {
  const h = Math.floor(v / 100);
  const r = v % 100;
  const parts: string[] = [];
  if (h > 0) parts.push(`${SMALL[h]} hundred`);
  if (r > 0) {
    if (r < 20) parts.push(SMALL[r]);
    else parts.push(r % 10 === 0 ? TENS[Math.floor(r / 10)] : `${TENS[Math.floor(r / 10)]}-${SMALL[r % 10]}`);
  }
  return parts.join(' ');
};

export const numberWords = (n: bigint): string => {
  if (n === 0n) return 'zero';
  const str = n.toString();
  const groupCount = Math.ceil(str.length / 3);
  const padded = str.padStart(groupCount * 3, '0');
  const parts: string[] = [];
  for (let k = 0; k < groupCount; k += 1) {
    const v = Number(padded.slice(k * 3, k * 3 + 3));
    if (v === 0) continue;
    const scale = SCALES[groupCount - k - 1];
    parts.push(scale ? `${belowThousand(v)} ${scale}` : belowThousand(v));
  }
  return parts.join(' ');
};

export const countWithNounEn = (n: bigint, noun: EnglishNoun): string =>
  `${numberWords(n)} ${n === 1n ? noun.singular : noun.plural}`;
