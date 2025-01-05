import { any, between, map, Parser, regex, str } from "parser-combinators";

export const lbr = str('[');
export const rbr = str(']');

export const lpr = str('(');
export const rpr = str(')');

export const lcb = str('{');
export const rcb = str('}');

export const lab = str('<');
export const rab = str('>');

export const variableName = regex(/\$?\w+/, 'Variable name');
export const typeName = regex(/[A-Z]\w*/, 'Type name');
export const functionName = regex(/\w+/, 'Function name');

export const unaryOperator = any(
    str('-')
);

export const binaryOperator = any(
    str('+'),
    str('-'),
    str('&'),
    str('|'),
    str('^'),
    str('<<'),
    str('>>'),
    str('<'),
    str('>'),
    str('*'),
    str('/')
);

export const newline = regex(/ *\r?\n/, 'End of line');

export const functionKind = any(
    str('def'),
    str('dot')
);

export function typeDefinition(): Parser<string> {
    return (ctx) => any(typeName, map(between(lbr, typeDefinition(), rbr), (t) => `[${t}]`))(ctx);
}