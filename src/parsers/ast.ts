import { FunctionRValue, IndexRValue, NumberRValue, RValue, StringRValue, VariableRValue } from "./rvalue";

export type TokenRange = {
    start: number, 
    end: number
}

export type Token<T> = TokenRange & {
    value: T
};

export type Parameter = {
    name: Token<VariableName>,
    type: Token<string>
}

export type TypeDefinition = {
    type: 'type-definition',
    public: boolean,
    name: Token<string>,
    definition: Token<string>
}

export type VariableName = {
    front: '$' | '.' | null,
    name: string
}
export type VariableKind = 'const' | 'let' | 'var';
export type FunctionKind = 'dot' | 'def';
export type OperatorKind = 'binary' | 'unary';

export type FunctionDefinition = {
    type: 'function',
    kind: FunctionKind,
    public: boolean,
    name: Token<string>,
    parameters: Parameter[],
    returnType?: Token<string>
} | {
    type: 'operator',
    kind: OperatorKind,
    public: boolean,
    name: Token<string>,
    parameters: Parameter[],
    returnType: Token<string | null>
}

export type FunctionDeclaration = {
    type: 'function-declaration',
    definition: FunctionDefinition,
    statements: StatementsBlock
}

export type VariableDeclaration = {
    type: 'declaration',
    public: boolean,
    name: Token<VariableName>,
    kind: Token<VariableKind>,
    value: RValue
}

export type VariableModification = {
    type: 'modification',
    name: IndexRValue | VariableRValue,
    operator: string,
    value: RValue
}

export type StatementsBlock = Statement[];

export type Statement = FunctionDeclaration | StatementsStatement | VariableDeclaration | VariableModification | RegAllocUseStatement | ReturnStatement | SwitchStatement | WhileStatement | IfStatement | RValue;

export type StatementsStatement = {
    type: 'statements',
    statements: StatementsBlock
}

export type RegAllocUseStatement = {
    type: '_reg_alloc_use',
    value: Token<VariableName>
};

export type ReturnStatement = {
    type: 'return',
    value?: RValue
};

export type SwitchStatement = {
    type: 'switch',
    value: RValue,
    cases: {
        caseName: 'default' | NumberRValue | StringRValue | Token<VariableName>,
        statements: StatementsBlock
    }[]
};

export type WhileStatement = {
    type: 'while',
    value: RValue,
    statements: StatementsBlock
};

export type IfStatement = {
    type: 'if',
    value: RValue,
    ifBlock: StatementsBlock,
    elifBlocks: {
        value: RValue,
        statements: StatementsBlock
    }[],
    elseBlock: StatementsBlock
};

export type ParserOutput = (VariableDeclaration | TypeDefinition | FunctionDeclaration)[];