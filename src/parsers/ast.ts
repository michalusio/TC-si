export type XRange = {
    start: number;
    end: number;
}

export type Parameter = {
    name: {
        text: string;
        range: XRange;
    },
    type: {
        text: string;
        range: XRange;
    }
}

export type TypeDefinition = {
    name: {
        text: string;
        range: XRange;
    },
    definition: {
        text: string;
        range: XRange;
    }
}

export type VariableKind = 'const' | 'let' | 'var';
export type FunctionKind = 'dot' | 'def';
export type OperatorKind = 'binary' | 'unary';

export type FunctionDefinition = {
    type: 'function',
    kind: FunctionKind,
    public: boolean,
    name: {
        text: string;
        range: XRange;
    },
    parameters: Parameter[],
    returnType?: string
} | {
    type: 'operator',
    kind: OperatorKind,
    public: boolean,
    name: {
        text: string;
        range: XRange;
    },
    parameters: Parameter[],
    returnType: string
}

export type CastedRValue = {
    type: 'cast',
    to: string,
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
    value: string,
    parameters: RValue[]
}

export type IndexRValue = {
    type: 'index',
    value: string,
    parameters: RValue[]
}

export type VariableRValue = {
    type: 'variable',
    value: string
}

export type BinaryRValue = {
    type: 'binary',
    operator: string,
    left: RValue,
    right: RValue
}

export type RValue = CastedRValue | UnaryRValue | StringRValue | NumberRValue | ArrayRValue | FunctionRValue | IndexRValue | VariableRValue | BinaryRValue;