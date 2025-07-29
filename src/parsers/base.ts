import {
  any,
  between,
  exhaust,
  fail,
  many,
  map,
  opt,
  Parser,
  ref,
  regex,
  seq,
  str,
  wspaces,
} from "parser-combinators";
import { rstr, time, token } from "./utils";
import { ParseReturnType, Token, VariableName } from "./types/ast";

const recoveryIssues: {
  type: "added" | "skipped";
  kind?: "warning";
  text: string;
  index: number;
}[] = [];

export const getRecoveryIssues = () => recoveryIssues;

export const lbr = str("[");
export const rbr = str("]");

export const lpr = str("(");
export const rpr = str(")");

export const lcb = str("{");
export const rcb = str("}");

export const lab = str("<");
export const rab = str(">");

const disallowedNames = new Set([
  "def",
  "dot",
  "switch",
  "while",
  "if",
  "return",
  "var",
  "const",
  "let",
  "type",
  "else",
  "elif",
  "default",
]);

export const variableName = token(
  map(
    seq(
      many(any(str("$"), str("."))),
      ref(regex(/\w+/, "Variable name"), (p) => !disallowedNames.has(p))
    ),
    ([front, name]) => <VariableName>{ front: front.join(""), name }
  )
);
export const typeName = token(regex(/@?[A-Z]\w*/, "Type name"));
export const functionName = token(
  ref(regex(/\w+/, "Function name"), (p) => !disallowedNames.has(p))
);

const operatable = [
  "-",
  "=",
  "<",
  ">",
  '*',
  '%',
  "+",
  "~",
  '|',
  '^',
  "!",
  "&",
  "?"
];

const operatableParsers = operatable.map(o => str(o));

export const unaryOperator = time('operators', any(
  regex(/\/(?!\/)/, "/"),
  ...operatableParsers.map((o, i) => operatable[i] === '?'
    ? fail<string>('Cannot use `?` as the first term of operator')
    : map(
      seq(o, opt(any(...operatableParsers))),
      ([a, b]) => b ? (a + b) : a)
  )
));

export const functionBinaryOperator = time('operators', any(
  regex(/\/(?!\/)/, "/"),
  ...operatableParsers.map((o, i) => operatable[i] === '?'
    ? fail<string>('Cannot use `?` as the first term of operator')
    : map(
      seq(o, opt(any(...operatableParsers.map(o2 => map(
        seq(o2, opt(any(...operatableParsers))),
        ([a, b]) => b ? (a + b) : a)
      )))),
      ([a, b]) => b ? (a + b) : a)
  )
));

export const binaryOperator = time('operators', any(
  regex(/\/(?!\/)/, "/"),
  str("<u"),
  str("<s"),
  ...operatableParsers.map((o, i) => operatable[i] === '?'
    ? fail<string>('Cannot use `?` as the first term of operator')
    : map(
      seq(o, opt(any(...operatableParsers.map(o2 => map(
        seq(o2, opt(any(...operatableParsers))),
        ([a, b]) => b ? (a + b) : a)
      )))),
      ([a, b]) => b ? (a + b) : a)
  ),
));

export type BinaryOperators = ParseReturnType<typeof binaryOperator>;

export const lineComment = time('comments', regex(/\s*\/\/.*?\r?\n/s, "Line comment"));
export const blockComment = time('comments', regex(/\s*\/\*.*?\*\//s, "Block comment"));

export const newline = regex(/[ \t]*\r?\n/, "End of line");

export const functionKind = any(str("def"), str("dot"));

export const typeDefinition = time('type definitions', any(
  typeAliasDefinition(),
  between(
    lab,
    token(
      map(
        seq(
          wspaces,
          regex(/\w+/, "Variable name"),
          exhaust(
            seq(
              wspaces,
              str(","),
              opt(any(lineComment, blockComment)),
              wspaces,
              regex(/\w+/, "Variable name")
            ),
            seq(wspaces, rstr(">", false))
          )
        ),
        ([_, variant, variants]) => [variant, ...variants.map((p) => p[4])]
      )
    ),
    seq(wspaces, rstr(">"))
  )
));

export function typeAliasDefinition(): Parser<Token<string>> {
  return (ctx) =>
    token(
      any(
        map(typeName, (t) => t.value),
        map(
          between(lbr, typeAliasDefinition(), rstr("]")),
          (t) => `[${t.value}]`
        )
      )
    )(ctx);
}
