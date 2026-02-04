import { Token, TokenRange } from "parser-combinators";
import { Statement, StatementsBlock, VariableName } from "../parsers/types/ast";
import { id } from "./utils";

export const addRcHandling = (ast: StatementsBlock, typeGetter: (range: TokenRange) => string | null, decrement_rc_token: Token<string>): StatementsBlock => {
    ast.forEach(s => addRcHandlingForStatement(s, typeGetter, decrement_rc_token));
    const allocatedVariables: VariableName[] = [];
    ast.forEach(s => {
        if (s.value.type === 'declaration') {
            const type = typeGetter(s.value.name);
            if (type === 'String' || type?.startsWith('*')) {
                allocatedVariables.push(s.value.name.value);
            }
        }
    });

    const cleanup: Record<string, Token<Statement>[]> = {};
    allocatedVariables.forEach(v => {
        const name = v.front + v.name;
        cleanup[name] = rcDecrementStatements(v, decrement_rc_token);
    });
    addToEveryReturn(ast, allocatedVariables);
    ast.push(...Object.values(cleanup).flat());
    return ast;
}

const addRcHandlingForStatement = (s: Token<Statement>, typeGetter: (range: TokenRange) => string | null, decrement_rc_token: Token<string>): Token<Statement> => {
    switch (s.value.type) {
        case 'if': {
            addRcHandling(s.value.ifBlock, typeGetter, decrement_rc_token);
            addRcHandling(s.value.elseBlock, typeGetter, decrement_rc_token);
            break;
        }
        case 'function-declaration': {
            addRcHandling(s.value.statements, typeGetter, decrement_rc_token);
            break;
        }
        case 'statements': {
            addRcHandling(s.value.statements, typeGetter, decrement_rc_token);
            break;
        }
        case 'switch': {
            s.value.cases.forEach(c => addRcHandling(c.statements, typeGetter, decrement_rc_token));
            break;
        }
        case 'while': {
            addRcHandling(s.value.statements, typeGetter, decrement_rc_token);
            break;
        }
    }
    return s;
}

const addToEveryReturn = (ast: StatementsBlock, allocatedVariables: VariableName[]) => {
    for (let index = ast.length - 1; index >= 0; index--) {
        const s = ast[index].value;
        switch (s.type) {
            case 'function-declaration': {
                addToEveryReturn(s.statements, allocatedVariables);
                break;
            }
            case 'if': {
                addToEveryReturn(s.ifBlock, allocatedVariables);
                addToEveryReturn(s.elseBlock, allocatedVariables);
                break;
            }
            case 'statements': {
                addToEveryReturn(s.statements, allocatedVariables);
                break;
            }
            case 'switch': {
                s.cases.forEach(sc => addToEveryReturn(sc.statements, allocatedVariables));
                break;
            }
            case 'while': {
                addToEveryReturn(s.statements, allocatedVariables);
                break;
            }
            case 'return': {
                s.variablesToDeallocate ??= [];
                s.variablesToDeallocate.push(...allocatedVariables);
                break;
            }
        }
    }
}

export const rcDecrementStatements = (v: VariableName, decrement_rc_token: Token<string>): [Token<Statement>, Token<Statement>] => {
    const vid = id();
    return [
        {
            start: Math.random(),
            end: -Math.random(),
            value: {
                type: 'declaration',
                kind: {
                    start: Math.random(),
                    end: -Math.random(),
                    value: 'const'
                },
                name: {
                    start: Math.random(),
                    end: -Math.random(),
                    value: {
                        front: '',
                        name: vid
                    }
                },
                public: false,
                value: {
                    start: Math.random(),
                    end: -Math.random(),
                    value: {
                        type: "binary",
                        operator: '-',
                        left: {
                            start: Math.random(),
                            end: -Math.random(),
                            value: {
                                type: 'variable',
                                value: {
                                    start: Math.random(),
                                    end: -Math.random(),
                                    value: v
                                }
                            }
                        },
                        right: {
                            start: Math.random(),
                            end: -Math.random(),
                            value: {
                                type: 'number',
                                value: 4
                            }
                        }
                    }
                }
            }
        },
        {
            start: Math.random(),
            end: -Math.random(),
            value: {
                type: 'function',
                value: decrement_rc_token,
                parameters: [
                    {
                        start: Math.random(),
                        end: -Math.random(),
                        value: {
                            type: 'variable',
                            value: {
                                start: Math.random(),
                                end: -Math.random(),
                                value: {
                                    front: '',
                                    name: vid
                                }
                            }
                        }
                    }
                ]
            }
        }
    ];
}

export const rcIncrementStatements = (v: VariableName, increment_rc_token: Token<string>): [Token<Statement>, Token<Statement>] => {
    const vid = id();
    return [
        {
            start: Math.random(),
            end: -Math.random(),
            value: {
                type: 'declaration',
                kind: {
                    start: Math.random(),
                    end: -Math.random(),
                    value: 'const'
                },
                name: {
                    start: Math.random(),
                    end: -Math.random(),
                    value: {
                        front: '',
                        name: vid
                    }
                },
                public: false,
                value: {
                    start: Math.random(),
                    end: -Math.random(),
                    value: {
                        type: "binary",
                        operator: '-',
                        left: {
                            start: Math.random(),
                            end: -Math.random(),
                            value: {
                                type: 'variable',
                                value: {
                                    start: Math.random(),
                                    end: -Math.random(),
                                    value: v
                                }
                            }
                        },
                        right: {
                            start: Math.random(),
                            end: -Math.random(),
                            value: {
                                type: 'number',
                                value: 4
                            }
                        }
                    }
                }
            }
        },
        {
            start: Math.random(),
            end: -Math.random(),
            value: {
                type: 'function',
                value: increment_rc_token,
                parameters: [
                    {
                        start: Math.random(),
                        end: -Math.random(),
                        value: {
                            type: 'variable',
                            value: {
                                start: Math.random(),
                                end: -Math.random(),
                                value: {
                                    front: '',
                                    name: vid
                                }
                            }
                        }
                    }
                ]
            }
        }
    ];
}