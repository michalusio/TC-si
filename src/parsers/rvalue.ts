import { Token, VariableName } from "./ast"
import { binaryOperator, BinaryOperators, ParseReturnType } from "./base"

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

export type ArrayRValue = {
    type: 'array',
    values: Token<RValue>[]
}

export type FunctionRValue = {
    type: 'function',
    value: Token<string>,
    parameters: Token<RValue>[]
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

export type RValue = ParenthesisedRValue | CastedRValue | UnaryRValue | StringRValue | InterpolatedRValue | NumberRValue | ArrayRValue | FunctionRValue | DotMethodRValue | IndexRValue | VariableRValue | BinaryRValue | TernaryRValue;