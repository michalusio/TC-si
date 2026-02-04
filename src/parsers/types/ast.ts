import { Parser, Token } from "parser-combinators";
import { CastedRValue, IndexRValue, RValue, VariableRValue } from "./rvalue";

export type ParseReturnType<T> = T extends Parser<infer R> ? R : never;

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
    returnType: Token<string | null>,
    assumptions: FunctionDefinition[]
} | {
    type: 'operator',
    kind: OperatorKind,
    public: boolean,
    name: Token<string>,
    parameters: Parameter[],
    returnType: Token<string | null>,
    assumptions: FunctionDefinition[]
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
    name: Token<IndexRValue | CastedRValue | VariableRValue>,
    operator?: string,
    value: Token<RValue>
}

export type AsmStatement = {
    type: 'asm',
    architecture: string,
    code: string
}

export type StatementsBlock = Token<Statement>[];

export type Statement = TypeDefinition | FunctionDeclaration | StatementsStatement | VariableDeclaration | VariableModification | RegAllocUseStatement | AsmStatement | ReturnStatement | BreakStatement | ContinueStatement | SwitchStatement | WhileStatement | IfStatement | RValue | CommentStatement;

export type StatementsStatement = {
    type: 'statements',
    statements: StatementsBlock
}

export type CommentStatement = {
    type: 'comment',
    value: string;
}

export type RegAllocUseStatement = {
    type: '_reg_alloc_use',
    values: Token<VariableName>[]
};

export type ReturnStatement = {
    type: 'return',
    value: Token<RValue | null>,
    variablesToDeallocate?: VariableName[]
};

export type BreakStatement = {
    type: 'break'
};

export type ContinueStatement = {
    type: 'continue'
};

export type SwitchStatement = {
    type: 'switch',
    value: Token<RValue>,
    cases: {
        caseName: Token<RValue | "default">,
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
    elseBlock: StatementsBlock
};

export type ParserOutput = StatementsBlock;