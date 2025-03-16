import {
  any,
  between,
  exhaust,
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
import { rstr, token } from "./utils";
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

const disallowedNames = [
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
];

export const variableName = token(
  map(
    seq(
      many(any(str("$"), str("."))),
      ref(regex(/\w+/, "Variable name"), (p) => !disallowedNames.includes(p))
    ),
    ([front, name]) => <VariableName>{ front: front.join(""), name }
  )
);
export const typeName = token(regex(/@?[A-Z]\w*/, "Type name"));
export const functionName = token(
  ref(regex(/\w+/, "Function name"), (p) => !disallowedNames.includes(p))
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
  "?",
];

export const unaryOperator = any(
  ...operatable.flatMap(o => [
    ...operatable.map(o2 => str(o+o2)),
    str(o)
  ]),
  regex(/\/(?!\/)/, "/")
);

export const functionBinaryOperator = any(
  ...operatable.flatMap(o => [
    ...operatable.flatMap(o2 => [
      ...operatable.map(o3 => str(o+o2+o3)),
      str(o+o2)
    ]),
    str(o)
  ]),
  str('/='),
  regex(/\/(?!\/)/, "/")
);

export const binaryOperator = any(
  str("<u"),
  str("<s"),
  str("==="),
  str("rol"),
  str("ror"),
  str("asr"),
  regex(/\/(?!\/)/, "/"),
  ...operatable.flatMap(o => o === '?'
    ? []
    : [
    ...operatable.flatMap(o2 => [
      ...operatable.map(o3 => str(o+o2+o3)),
      str(o+o2)
    ]),
    str(o)
  ]),
  str('/='),
);

export type BinaryOperators = ParseReturnType<typeof binaryOperator>;

export const lineComment = regex(/\s*\/\/.*?\r?\n/s, "Line comment");
export const blockComment = regex(/\s*\/\*.*?\*\//s, "Block comment");

export const newline = regex(/[ \t]*\r?\n/, "End of line");

export const functionKind = any(str("def"), str("dot"));

export const typeDefinition = any(
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
);

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
