import { IndexRValue, NumberRValue, RValue, StringRValue, VariableRValue } from "./rvalue";

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
    definition: Token<string> | Token<string[]>
}

export type VariableName = {
    front: '$' | '.' | '$.' | '.$' | '',
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
    returnType: Token<string | null>
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
    value: Token<RValue>
}

export type VariableModification = {
    type: 'modification',
    name: Token<IndexRValue | VariableRValue>,
    operator?: string,
    value: Token<RValue>
}

export type StatementsBlock = Statement[];

export type Statement = TypeDefinition | FunctionDeclaration | StatementsStatement | VariableDeclaration | VariableModification | RegAllocUseStatement | ReturnStatement | SwitchStatement | WhileStatement | IfStatement | RValue;

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
    value: Token<RValue | null>
};

export type SwitchStatement = {
    type: 'switch',
    value: Token<RValue>,
    cases: {
        caseName: Token<StringRValue | NumberRValue | VariableRValue | "default">,
        statements: StatementsBlock
    }[]
};

export type WhileStatement = {
    type: 'while',
    value: Token<RValue>,
    statements: StatementsBlock
};

export type IfStatement = {
    type: 'if',
    value: Token<RValue>,
    ifBlock: StatementsBlock,
    elifBlocks: {
        value: Token<RValue>,
        statements: StatementsBlock
    }[],
    elseBlock: StatementsBlock
};

export type ParserOutput = (VariableDeclaration | TypeDefinition | FunctionDeclaration)[];