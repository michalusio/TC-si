import {
  Context,
  failure,
  Failure,
  isFailure,
  Parser,
  Result,
  str,
  success,
} from "parser-combinators";
import { getRecoveryIssues } from "./base";
import { Token } from "./types/ast";

export function recoverBySkippingChars<T>(
  chars: number,
  parser: Parser<T>
): Parser<T> {
  return (ctx) => {
    let firstFailure: Failure | null = null;
    for (let i = 0; i <= chars; i++) {
      const result = parser({
        index: ctx.index + i,
        path: ctx.path,
        text: ctx.text,
      });
      if (isFailure(result)) {
        if (firstFailure == null) {
          firstFailure = result;
        }
      } else {
        if (i > 0) {
          getRecoveryIssues().push({
            type: "skipped",
            index: ctx.index,
            text: ctx.text.slice(ctx.index, ctx.index + i),
          });
        }
        return result;
      }
    }
    if (firstFailure == null) throw "Missing failure info";
    return firstFailure;
  };
}

export function recoverByAddingChars<T>(
  chars: string,
  parser: Parser<T>,
  log: boolean = true,
  message?: string
): Parser<T> {
  return (ctx) => {
    let firstFailure: Failure | null = null;

    for (let i = 0; i <= chars.length; i++) {
      const addedChars = chars.slice(0, i);
      const result = parser({
        index: ctx.index,
        path: ctx.path,
        text: `${ctx.text.slice(0, ctx.index)}${addedChars}${ctx.text.slice(
          ctx.index
        )}`,
      });
      if (isFailure(result)) {
        if (firstFailure == null) {
          firstFailure = result;
        }
      } else {
        if (log && i > 0) {
          getRecoveryIssues().push({
            type: "added",
            index: ctx.index,
            text: message ?? `\`${addedChars}\``,
          });
        }
        return result;
      }
    }
    if (firstFailure == null) throw "Missing failure info";
    return firstFailure;
  };
}

export function recoverBySkipping<T, V>(
  parser: Parser<T>,
  skipBy: Parser<V>,
  log: boolean = true
): Parser<T | null> {
  return (ctx) => {
    const result = parser(ctx);
    if (isFailure(result)) {
      if (result.history.includes("surely")) {
        const skipped = skipBy(ctx);
        if (log && !isFailure(skipped)) {
          getRecoveryIssues().push({
            type: "skipped",
            index: ctx.index,
            text: result.ctx.text.slice(ctx.index, skipped.ctx.index),
          });
        }
        return {
          ...skipped,
          value: null
        };
      }
    }
    return result;
  }
}

export function rstr<T extends string>(value: T, log: boolean = true): Parser<T> {
  return recoverByAddingChars(value, str(value), log);
}

export const eof: Parser<void> = (ctx) => {
  if (ctx.index === ctx.text.length) {
    return success(ctx, void 0);
  } else {
    return failure(ctx, "End Of File", ["EOF"]);
  }
};

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

export function token<T>(parser: Parser<T>): Parser<Token<T>> {
  return (ctx) => {
    const result = parser(ctx);
    if (result.success) {
      return {
        ...result,
        value: {
          value: result.value,
          start: ctx.index,
          end: result.ctx.index
        }
      }
    }
    return result;
  }
}

export function lookaround<T>(parser: Parser<T>): Parser<void> {
  return (ctx) => {
    const result = parser(ctx);
    if (result.success) {
      return success(ctx, void 0);
    }
    return failure(ctx, result.expected, ['lookaround', ...result.history]);
  }
}