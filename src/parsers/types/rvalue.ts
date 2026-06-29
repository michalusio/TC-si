import { VariableName } from "./ast"
import { BinaryOperators } from "../base"
import { Token } from "parser-combinators"

export type CastedRValue = {
    type: 'cast',
    to: Token<string>,
    value: Token<RValue>
}

export type UnaryRValue = {
    type: 'unary',
    operator: string,
    value: Token<RValue>
}

export type StringRValue = {
    type: 'string',
    value: string
}

export type InterpolatedRValue = {
    type: 'interpolated',
    value: string,
    inserts: {
        index: number,
        value: Token<RValue>
    }[]
}

export type NumberRValue = {
    type: 'number',
    value: number
}

export type ParenthesisedRValue = {
    type: 'parenthesis',
    value: Token<RValue>
};

export type TranslationRValue = {
    type: 'translation',
    code: number,
    value: InterpolatedRValue
}

export type TypeRValue = {
    type: 'type',
    typeValue: Token<string>
}

export type ArrayRValue = {
    type: 'array',
    values: Token<RValue>[]
}

export type FunctionRValue = {
    type: 'function',
    value: Token<string>,
    parameters: Token<RValue>[]
}

export type StructRValue = {
    type: 'struct',
    typeValue: Token<string>,
    parameters: [Token<VariableName>, Token<RValue>][]
}

export type DotPropertyRValue = {
    type: 'dotProperty',
    object: Token<RValue>,
    value: Token<string>
}

export type DotMethodRValue = {
    type: 'dotMethod',
    object: Token<RValue>,
    value: Token<string>,
    parameters: Token<RValue>[]
}

export type IndexRValue = {
    type: 'index',
    value: Token<RValue>,
    parameter: Token<RValue>
}

export type VariableRValue = {
    type: 'variable',
    value: Token<VariableName>
}

export type BinaryRValue = {
    type: 'binary',
    operator: BinaryOperators,
    left: Token<RValue>,
    right: Token<RValue>
}

export type TernaryRValue = {
    type: 'ternary',
    condition: Token<RValue>,
    ifTrue: Token<RValue>,
    ifFalse: Token<RValue>
}

export type RValue = TranslationRValue | TypeRValue | ParenthesisedRValue | CastedRValue | UnaryRValue | StringRValue | InterpolatedRValue | NumberRValue | ArrayRValue | StructRValue | FunctionRValue | DotPropertyRValue | DotMethodRValue | IndexRValue | VariableRValue | BinaryRValue | TernaryRValue;