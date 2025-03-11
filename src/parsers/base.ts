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
import { Token, VariableName } from "./ast";

export type ParseReturnType<T> = T extends Parser<infer R> ? R : never;

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

export const unaryOperator = any(str("-"), str("~"), str("!"), str("+"));

export const functionBinaryOperator = any(
  str("+="),
  str("-="),
  str("&&="),
  str("&="),
  str("||="),
  str("|="),
  str("^="),
  str("*="),
  str("%="),
  str("+"),
  str("-"),
  str("&&"),
  str("&"),
  str("||"),
  str("|"),
  str("^"),
  str("*"),
  str("%"),
  str("<="),
  str(">="),
  str("!="),
  str("=="),
  str("<<"),
  str(">>"),
  str("<"),
  str(">"),
  regex(/\/(?!\/)/, "/")
);

export const binaryOperator = any(
  str("+"),
  str("-"),
  str("&&"),
  str("&"),
  str("||"),
  str("|"),
  str("^"),
  str("*"),
  str("%"),
  str("<="),
  str("<u"),
  str("<s"),
  str(">="),
  str("!="),
  str("==="),
  str("=="),
  str("<<"),
  str(">>"),
  str("<"),
  str(">"),
  str("rol"),
  str("ror"),
  str("asr"),
  map<string, "/">(regex(/\/(?!\/)/, "/"), (r) => r as "/")
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
