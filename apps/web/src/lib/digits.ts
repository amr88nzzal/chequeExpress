const ARABIC_INDIC_ZERO = 0x0660;
const EXTENDED_ARABIC_INDIC_ZERO = 0x06f0;
const ASCII_ZERO = 0x30;

/**
 * Arabic keyboards emit Arabic-Indic digits (`٥`) and their own separators.
 * Operators also type the extended Persian forms (`۵`). Cheque numbers and
 * amounts travel to the server as ASCII decimal strings, so the UI normalises
 * what was typed before it validates or compares — otherwise a perfectly
 * correct Arabic entry would be rejected as malformed.
 */
export function toWesternDigits(value: string): string {
  let out = '';
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0;
    if (code >= ARABIC_INDIC_ZERO && code <= ARABIC_INDIC_ZERO + 9) {
      out += String.fromCharCode(ASCII_ZERO + (code - ARABIC_INDIC_ZERO));
      continue;
    }
    if (code >= EXTENDED_ARABIC_INDIC_ZERO && code <= EXTENDED_ARABIC_INDIC_ZERO + 9) {
      out += String.fromCharCode(ASCII_ZERO + (code - EXTENDED_ARABIC_INDIC_ZERO));
      continue;
    }
    if (char === '٫') {
      out += '.';
      continue;
    }
    if (char === '٬' || char === '،') {
      continue;
    }
    out += char;
  }
  return out;
}
