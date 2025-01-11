import { any, between, many, map, opt, Parser, ref, regex, seq, str } from "parser-combinators";
import { rstr, token } from "./utils";
import { Token, VariableName } from "./ast";

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
    'elif',
    'default'
]

export const variableName = token(
    map(
        seq(
            many(any(str('$'), str('.'))),
            ref(
                regex(/\w+/, 'Variable name'),
                p => !disallowedNames.includes(p)
            ),
        ),
        ([front, name]) => (<VariableName>{ front: front.join(''), name })
    )
);
export const typeName = token(regex(/@?[A-Z]\w*/, 'Type name'));
export const functionName = token(
    ref(
        regex(/\w+/, 'Function name'),
        p => !disallowedNames.includes(p)
    )
);

export const unaryOperator = any(
    str('-'),
    str('~'),
    str('!'),
    str('+')
);

export const functionBinaryOperator = any(
    str('+='),
    str('-='),
    str('&&='),
    str('&='),
    str('||='),
    str('|='),
    str('^='),
    str('*='),
    str('%='),
    str('+'),
    str('-'),
    str('&&'),
    str('&'),
    str('||'),
    str('|'),
    str('^'),
    str('*'),
    str('%'),
    str('<='),
    str('>='),
    str('!='),
    str('=='),
    str('<<'),
    str('>>'),
    str('<'),
    str('>'),
    regex(/\/(?!\/)/, '/')
);

export const binaryOperator = any(
    str('+'),
    str('-'),
    str('&&'),
    str('&'),
    str('||'),
    str('|'),
    str('^'),
    str('*'),
    str('%'),
    str('<='),
    str('>='),
    str('!='),
    str('=='),
    str('<<'),
    str('>>'),
    str('<'),
    str('>'),
    regex(/\/(?!\/)/, '/')
);

export const newline = regex(/[ \t]*\r?\n/, 'End of line');

export const functionKind = any(
    str('def'),
    str('dot')
);

export function typeDefinition(): Parser<Token<string>> {
    return (ctx) => token(
        any(
            map(typeName, t => t.value),
            map(between(lbr, typeDefinition(), rstr(']')), (t) => `[${t.value}]`)
        )
    )(ctx);
}

export const lineComment = regex(/\s*\/\/.*?\r?\n/s, 'Line comment');
export const blockComment = regex(/\s*\/\*.*?\*\//s, 'Block comment');