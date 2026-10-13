export type WordsErrorCode = 'INVALID_AMOUNT' | 'TOO_MANY_DECIMALS' | 'AMOUNT_TOO_LARGE';

export class WordsError extends Error {
  code: WordsErrorCode;

  constructor(code: WordsErrorCode, message: string) {
    super(message);
    this.name = 'WordsError';
    this.code = code;
  }
}
