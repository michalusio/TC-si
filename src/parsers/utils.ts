import {
  Context,
  failure,
  isFailure,
  Parser,
  recoverByAddingChars,
  Result,
  str,
  success,
} from "parser-combinators";

export function recoverBySkipping<T, V>(
  parser: Parser<T>,
  skipBy: Parser<V>
): Parser<T | null> {
  return (ctx) => {
    const result = parser(ctx);
    if (isFailure(result)) {
      if (result.history.includes("surely")) {
        return {
          ...skipBy(ctx),
          value: null
        };
      }
    }
    return result;
  }
}

export function rstr<T extends string>(value: T): Parser<T> {
  return recoverByAddingChars(str(value), value);
}

export const timings: Record<string, number> = {};

export const clearTimings = () => {
  Object.keys(timings).forEach(key => delete timings[key]);
}

export function time<T>(label: string, parser: Parser<T>): Parser<T> {
  return (ctx) => {
    const start = performance.now();
    const result = parser(ctx);
    timings[label] = (timings[label] ?? 0) + (performance.now() - start);
    return result;
  };
}

export function manyForSure<T>(parser: Parser<T>): Parser<T[]> {
  return (ctx: Context): Result<T[]> => {
    const results: T[] = [];
    while (true) {
      const res = parser(ctx);
      if (isFailure(res)) {
        if (res.history.includes("surely")) {
          return failure(
            res.ctx,
            res.expected,
            res.history.filter((h) => h !== "surely")
          );
        }
        return success(ctx, results);
      }
      ctx = res.ctx;
      results.push(res.value);
    }
  };
}

export function logg<T>(parser: Parser<T>): Parser<T> {
  return (ctx: Context): Result<T> => {
    const res = parser(ctx);
    if (isFailure(res)) {
      console.log(`Failure at ${res.ctx.index}: ${res.expected}`);
      console.log(`History: [${res.history.join(', ')}]`)
      return res;
    } else {
      console.log(`Success at ${res.ctx.index}: ${JSON.stringify(res.value, null, 2)}`);
      return res;
    }
  }
}