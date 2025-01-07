import { any, between, map, Parser, ref, regex, str } from "parser-combinators";
import { rstr } from "./utils";

export type ParseReturnType<T> = T extends Parser<infer R> ? R : never;

const recoveryIssues: {
    type: 'added' | 'skipped',
    kind?: 'warning',
    text: string,
    index: number
}[] = [];

export const getRecoveryIssues = () => recoveryIssues;

export const lbr = str('[');
export const rbr = str(']');

export const lpr = str('(');
export const rpr = str(')');

export const lcb = str('{');
export const rcb = str('}');

export const lab = str('<');
export const rab = str('>');

const disallowedNames = [
    'def',
    'dot',
    'switch',
    'while',
    'if',
    'return',
    'var',
    'const',
    'let',
    'type',
    'else',
    'elif'
]

export const variableName = ref(regex(/[\$\.]?\w+/, 'Variable name'), p => !disallowedNames.includes(p));
export const typeName = regex(/[A-Z]\w*/, 'Type name');
export const functionName = ref(regex(/\w+/, 'Function name'), p => !disallowedNames.includes(p));

export const unaryOperator = any(
    str('-'),
    str('~')
);

export const binaryOperator = any(
    str('+'),
    str('-'),
    str('&&'),
    str('&'),
    str('||'),
    str('|'),
    str('^'),
    str('<='),
    str('>='),
    str('=='),
    str('!='),
    str('<<'),
    str('>>'),
    str('<'),
    str('>'),
    str('*'),
    regex('/(?!/)', '/')
);

export const newline = regex(/[ \t]*\r?\n/, 'End of line');

export const functionKind = any(
    str('def'),
    str('dot')
);

export function typeDefinition(): Parser<string> {
    return (ctx) => any(typeName, map(between(lbr, typeDefinition(), rstr(']')), (t) => `[${t}]`))(ctx);
}

export const lineComment = regex(/ *\/\/.*?\r?\n/, 'Line comment');
export const blockComment = regex(/ *\/\*.*?\*\//, 'Block comment');