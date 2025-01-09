import { Token, VariableName } from "./ast"

export type CastedRValue = {
    type: 'cast',
    to: Token<string>,
    value: RValue
}

export type UnaryRValue = {
    type: 'unary',
    operator: string,
    value: RValue
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
        value: RValue
    }[]
}

export type NumberRValue = {
    type: 'number',
    value: number
}

export type ArrayRValue = {
    type: 'array',
    values: RValue[]
}

export type FunctionRValue = {
    type: 'function',
    value: Token<string>,
    parameters: RValue[]
}

export type DotMethodRValue = {
    type: 'dotMethod',
    object: RValue,
    value: Token<string>,
    parameters: RValue[]
}

export type IndexRValue = {
    type: 'index',
    value: RValue,
    parameter: RValue
}

export type VariableRValue = {
    type: 'variable',
    value: Token<VariableName>
}

export type BinaryRValue = {
    type: 'binary',
    operator: string,
    left: RValue,
    right: RValue
}

export type TernaryRValue = {
    type: 'ternary',
    condition: RValue,
    ifTrue: RValue,
    ifFalse: RValue
}

export type RValue = CastedRValue | UnaryRValue | StringRValue | InterpolatedRValue | NumberRValue | ArrayRValue | FunctionRValue | DotMethodRValue | IndexRValue | VariableRValue | BinaryRValue | TernaryRValue;