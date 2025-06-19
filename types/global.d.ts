// types/global.d.ts

export {};

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}
declare module "long" {
  interface Long {
    high: number;
    low: number;
    unsigned: boolean;
    add(other: Long | number | string): Long;
    subtract(other: Long | number | string): Long;
    multiply(other: Long | number | string): Long;
    divide(other: Long | number | string): Long;
    toString(radix?: number): string;
    toNumber(): number;
  }

  declare const Long: {
    new (low: number, high?: number, unsigned?: boolean): Long;
    fromNumber(value: number, unsigned?: boolean): Long;
    fromString(str: string, unsigned?: boolean, radix?: number): Long;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    isLong(obj: any): obj is Long;
    ZERO: Long;
    ONE: Long;
  };

  export = Long;
}
