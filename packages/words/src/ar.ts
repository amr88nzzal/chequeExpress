import type { ArabicNoun, Gender } from './currencies.ts';

const STEMS_FEM = ['', 'واحدة', 'اثنتان', 'ثلاث', 'أربع', 'خمس', 'ست', 'سبع', 'ثمان', 'تسع', 'عشر'];
const TENS = ['', '', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];

type Scale = { one: string; two: string; plural: string };
const SCALES: Scale[] = [
  { one: '', two: '', plural: '' },
  { one: 'ألف', two: 'ألفان', plural: 'آلاف' },
  { one: 'مليون', two: 'مليونان', plural: 'ملايين' },
  { one: 'مليار', two: 'ملياران', plural: 'مليارات' },
  { one: 'ترليون', two: 'ترليونان', plural: 'ترليونات' },
  { one: 'كدرليون', two: 'كدرليونان', plural: 'كدرليونات' },
];

const join = (parts: string[]): string => {
  const items = parts.filter((p) => p !== '');
  return items.map((p, i) => (i === 0 ? p : `و${p}`)).join(' ');
};

/** 1..10 in the requested gender (masculine: ثلاثة, feminine: ثلاث). */
const unit = (n: number, gender: Gender): string => {
  if (gender === 'f') return STEMS_FEM[n];
  if (n === 1) return 'واحد';
  if (n === 2) return 'اثنان';
  if (n === 8) return 'ثمانية';
  return `${STEMS_FEM[n]}ة`;
};

/** 11..19 */
const teen = (n: number, gender: Gender): string => {
  const u = n - 10;
  if (gender === 'm') {
    if (u === 1) return 'أحد عشر';
    if (u === 2) return 'اثنا عشر';
    return `${unit(u, 'm')} عشر`;
  }
  if (u === 1) return 'إحدى عشرة';
  if (u === 2) return 'اثنتا عشرة';
  return `${u === 8 ? 'ثماني' : STEMS_FEM[u]} عشرة`;
};

/** 3..99 (1 and 2 only appear inside compounds such as 21). */
const belowHundred = (r: number, gender: Gender): string => {
  if (r <= 10) return unit(r, gender);
  if (r <= 19) return teen(r, gender);
  const t = Math.floor(r / 10);
  const u = r % 10;
  if (u === 0) return TENS[t];
  const unitWord = u === 1 && gender === 'f' ? 'إحدى' : unit(u, gender);
  return `${unitWord} و${TENS[t]}`;
};

/** `construct` = joined to a following noun (مائتا ألف). */
const hundredsWord = (h: number, construct: boolean): string => {
  if (h === 1) return 'مائة';
  if (h === 2) return construct ? 'مائتا' : 'مائتان';
  return `${STEMS_FEM[h]}مائة`;
};

/** A non-zero group of a scale >= 1 (thousands, millions...). Counted nouns of scales are masculine. */
const scaledGroup = (v: number, scale: number): string => {
  const sc = SCALES[scale];
  const h = Math.floor(v / 100);
  const r = v % 100;

  if (r === 0) return `${hundredsWord(h, true)} ${sc.one}`;

  if (r === 1 || r === 2) {
    const base = r === 1 ? sc.one : sc.two;
    return h > 0 ? `${hundredsWord(h, true)} ${sc.one} و${base}` : base;
  }

  const hw = h > 0 ? hundredsWord(h, false) : '';
  if (r <= 10) return join([hw, `${unit(r, 'm')} ${sc.plural}`]);
  return join([hw, `${belowHundred(r, 'm')} ${sc.one}ا`]);
};

/** Dual of a singular noun (ديناران، ليرتان، فلسان). */
export const dualOf = (noun: ArabicNoun): string => {
  if (noun.dual) return noun.dual;
  const w = noun.singular;
  const last = w.slice(-1);
  if (last === 'ة') return `${w.slice(0, -1)}تان`;
  if (last === 'ى') return `${w.slice(0, -1)}يان`;
  if (last === 'ا') return `${w.slice(0, -1)}وان`;
  if (w.endsWith('اء')) return noun.gender === 'f' ? `${w.slice(0, -1)}وان` : `${w}ان`;
  return `${w}ان`;
};

/** Singular with tanween alif, used after numbers 11..99 (دينارا). */
export const accusativeOf = (noun: ArabicNoun): string => {
  if (noun.accusative) return noun.accusative;
  const last = noun.singular.slice(-1);
  return last === 'ة' || last === 'ى' || last === 'ا' ? noun.singular : `${noun.singular}ا`;
};

/**
 * A whole count together with its counted noun, e.g. 25300 + دينار ->
 * "خمسة وعشرون ألفا وثلاثمائة دينار".
 */
export const countWithNoun = (n: bigint, noun: ArabicNoun): string => {
  if (n === 0n) return `صفر ${noun.singular}`;

  const gender = noun.gender;
  const str = n.toString();
  const groupCount = Math.ceil(str.length / 3);
  const padded = str.padStart(groupCount * 3, '0');

  const parts: string[] = [];
  for (let k = 0; k < groupCount; k += 1) {
    const v = Number(padded.slice(k * 3, k * 3 + 3));
    const scale = groupCount - k - 1;
    if (v === 0) continue;
    if (scale > 0) {
      parts.push(scaledGroup(v, scale));
      continue;
    }
    const h = Math.floor(v / 100);
    const r = v % 100;
    if (r === 0) parts.push(hundredsWord(h, v === 200));
    else if (r <= 2) parts.push(h > 0 ? hundredsWord(h, false) : '');
    else parts.push(h > 0 ? hundredsWord(h, false) : '', belowHundred(r, gender));
  }

  let words = join(parts);

  // Trailing tanween alif of a scale word is dropped when nothing follows it
  // (خمسة وعشرون ألفا -> ألف), and a final dual loses its nun (ألفان -> ألفا).
  if (words.endsWith('ا') && !words.endsWith('تا')) words = words.slice(0, -1);
  const lastGroup = Number(padded.slice(-3));
  if (lastGroup === 0 && words.endsWith('ان')) words = words.slice(0, -1);

  const tail = Number(n % 100n);
  if (tail === 0) return `${words} ${noun.singular}`;
  if (tail === 1) {
    const one = `${noun.singular} ${gender === 'f' ? 'واحدة' : 'واحد'}`;
    return words ? `${words} و${one}` : one;
  }
  if (tail === 2) {
    const two = `${dualOf(noun)} ${gender === 'f' ? 'اثنتان' : 'اثنان'}`;
    return words ? `${words} و${two}` : two;
  }
  if (tail <= 10) return `${words} ${noun.plural}`;
  return `${words} ${accusativeOf(noun)}`;
};
