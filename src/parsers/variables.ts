import { any, between, exhaust, expect, many, map, opt, Parser, regex, seq, spaces, spacesPlus, str, surely, wspaces, zeroOrMany } from "parser-combinators"
import { lab, rab, lbr, variableName, functionName, lpr, unaryOperator, binaryOperator, lcb, blockComment, lineComment, BinaryOperators, typeAliasDefinition, rpr, rbr } from "./base";
import { ArrayRValue, BinaryRValue, CastedRValue, DefaultRValue, DotMethodRValue, FunctionRValue, IndexRValue, InterpolatedRValue, NumberRValue, ParenthesisedRValue, RValue, StringRValue, TernaryRValue, UnaryRValue, VariableRValue } from "./types/rvalue";
import { lookaround, recoverByAddingChars, rstr, time, token } from "./utils";
import { Token, VariableDeclaration, VariableModification } from "./types/ast";
import { precedence } from "../storage";

const variableKind = token(any(
    str('const'),
    str('let'),
    str('var')
));

export const stringLiteral = time('strings', map(
    regex(/"(?:\.|(\\\")|[^\""\n])*"/, 'String literal'),
    (value) =>  (<StringRValue>{
        type: 'string',
        value
    })
));

const stringInterpolatedLiteral = time('string literals', map(
between(
    str('`'),
    exhaust(
        any(
            between(
                lcb,
                rValue(),
                rstr('}')
            ),
            regex(/[^\n\r{`]+/, 'String character')
        ),
        rstr('`', false)
    ),
    str('`')
),
    (value) => {
        let totalValue = '';
        const inserts: {
            index: number;
            value: Token<RValue>;
        }[] = []
        for (const v of value) {
            if (typeof v === 'string') {
                totalValue += v;
            } else {
                inserts.push({
                    index: totalValue.length,
                    value: v
                })
            }
        }
        return (<InterpolatedRValue> {
            type: 'interpolated',
            value: totalValue,
            inserts
        });
    }
))

const numericBase2Literal = map(
    regex(/0b[01][_01]*/, 'Numeric literal'),
    (str) => (<NumberRValue>{
        type: 'number',
        value: parseInt(str.slice(2).replaceAll('_', ''), 2)
    })
);
const numericBase10Literal = map(
    regex(/-?[0-9][_0-9]*/, 'Numeric literal'),
    (str) => (<NumberRValue>{
        type: 'number',
        value: parseInt(str.replaceAll('_', ''), 10)
    })
);
const numericBase16Literal = map(
    regex(/0x[0-9a-z][_0-9a-z]*/i, 'Numeric literal'),
    (str) => (<NumberRValue>{
        type: 'number',
        value: parseInt(str.replaceAll('_', ''), 16)
    })
);

export const anyNumericLiteral = time('numerics', any(
    numericBase16Literal,
    numericBase2Literal,
    numericBase10Literal
));

export const variableLiteral = map(
    expect(variableName, 'Variable literal'),
    (value) => (<VariableRValue>{
        type: 'variable',
        value
    })
);
const arrayLiteral = time('array literals', map(
    seq(
        lbr,
        wspaces,
        surely(exhaust(
            seq(
                between(
                    wspaces,
                    rValue(),
                    wspaces
                ),
                opt(str(',')),
                wspaces,
                opt(any(lineComment, blockComment))
            ),
            seq(wspaces, rbr)
        )),
        opt(any(lineComment, blockComment)),
        wspaces,
        rbr
    ), ([_, __, values, ___]) =>  (<ArrayRValue>{
        type: 'array',
        values: values.map(v => v[0])
    })
));

export const functionCall = time('function calls', map(seq(
    functionName,
    between(
        lpr,
        surely(
            opt(
                seq(
                    wspaces,
                    rValue(),
                    exhaust(
                        seq(
                            wspaces,
                            str(','),
                            wspaces,
                            rValue()
                        ),
                        seq(spaces, rpr)
                    )
                )
            )
        ),
        seq(spaces, rpr)
    )
), ([name, rest]) => {
    const parameters = rest == null
        ? []
        : [
            rest[1],
            ...rest[2].map(r => r[3])
        ]
    return <FunctionRValue>{
        type: 'function',
        value: name,
        parameters 
    };
}));

const cast = between(
    lab,
    typeAliasDefinition(),
    rab
);

const castedRValue = map(seq(
    cast,
    spaces,
    surely(rValue())
), ([cast, _, value]) => {
    return <CastedRValue>{
        type: 'cast',
        to: cast,
        value
    }
});

const defaultRValue = map(seq(
    str('_default(:'),
    typeAliasDefinition(),
    rpr
), ([_, typeValue, __]) => {
    return <DefaultRValue>{
        type: '_default',
        typeValue
    }
})

const unaryRValue = map(seq(
    unaryOperator,
    spaces,
    surely(rValue())
), ([operator, _, value]) => {
    return <UnaryRValue>{
        type: 'unary',
        operator,
        value
    }
});

const parenthesisedRValue = time('parentheses', map(between(
    seq(lpr, spaces),
    rValue(),
    seq(spaces, rstr(')'))
), (value) => (<ParenthesisedRValue>{
    type: 'parenthesis',
    value
})));

export function rValue(): Parser<Token<RValue>> {
    return (ctx) => time('rvalues', map(
        seq(
            time('primary rValues', token(any<RValue>(
                time('base rValues', any(castedRValue,
                    anyNumericLiteral,
                    stringLiteral,
                    stringInterpolatedLiteral,
                    unaryRValue,
                )),
                time('complex rValues', any(
                    parenthesisedRValue,
                    arrayLiteral,
                    defaultRValue,
                    functionCall,
                    variableLiteral
                ))
            ))),
            time('indexings', many(between(
                lbr,
                recoverByAddingChars('0', rValue(), true, 'index'),
                rstr(']')
            ))),
            opt(seq(spaces, blockComment)),
            time('operators', any(
                seq(
                    spaces,
                    str('?'),
                    surely(seq(
                        between(
                            spaces,
                            recoverByAddingChars('0', rValue(), true, 'on-true value'),
                            spaces
                        ),
                        str(':'),
                        spaces,
                        recoverByAddingChars('0', rValue(), true, 'on-false value')
                    ))
                ),
                seq(
                    many(seq(
                        str('.'),
                        surely(functionCall)
                    )),
                    opt(
                        seq(
                            between(
                                spaces,
                                binaryOperator,
                                spaces
                            ),
                            surely(recoverByAddingChars('0', rValue(), true, 'second operand'))
                        )
                    )
                )
            ))
        ),
        ([value, indexes, _, operation]) => {
            let actualValue: Token<RValue> = value;
            if (actualValue.value.type === 'cast' && actualValue.value.value.value.type === 'binary') {
                const binary = actualValue.value.value.value;
                actualValue = <Token<RValue>>{
                    start: actualValue.start,
                    end: actualValue.end,
                    value: <BinaryRValue>{
                        ...binary,
                        left: <Token<RValue>>{
                            start: actualValue.start,
                            end: binary.left.start,
                            value: <CastedRValue>{
                                type: 'cast',
                                to: actualValue.value.to,
                                value: binary.left
                            }
                        }
                    }
                };
            }
            indexes.forEach(index => {
                actualValue = <Token<RValue>>{
                    start: actualValue.start,
                    end: actualValue.end + 1,
                    value: <IndexRValue>{
                        type: 'index',
                        value: actualValue,
                        parameter: index 
                    }
                };
            });

            if (typeof operation[0] === 'string') {
                const op = operation as [string, "?", [Token<RValue>, ":", string, Token<RValue>]];
                const data = <Token<RValue>>{
                    start: actualValue.start,
                    end: op[2][3].end,
                    value: <TernaryRValue>{
                        type: 'ternary',
                        condition: actualValue,
                        ifTrue: op[2][0],
                        ifFalse: op[2][3]
                    }
                };
                return data;
            } else {
                const op = operation as [[".", FunctionRValue][], [BinaryOperators, Token<RValue>] | null];
                const functionCall = op[0];
                functionCall.forEach(([_, call]) => {
                    actualValue = <Token<RValue>>{
                        start: actualValue.start,
                        end: (call.parameters[call.parameters.length - 1]?.end ?? (actualValue.end + 1)) + 1,
                        value: <DotMethodRValue>{
                            type: 'dotMethod',
                            object: actualValue,
                            value: call.value,
                            parameters: call.parameters
                        }
                    };
                });

                const binaryOperator = op[1];
                if (binaryOperator) {
                    const right = binaryOperator[1];
                    const left = actualValue;
                    if (right.value.type === 'binary' && precedence[right.value.operator] < precedence[binaryOperator[0]]) {
                        actualValue = <Token<RValue>>{
                            start: actualValue.start,
                            end: right.end + 1,
                            value: <BinaryRValue>{
                                type: 'binary',
                                operator: right.value.operator,
                                left: <Token<RValue>>{
                                    start: actualValue.start,
                                    end: right.start + 1,
                                    value: <BinaryRValue>{
                                        type: 'binary',
                                        operator: binaryOperator[0],
                                        left,
                                        right: right.value.left
                                    }
                                },
                                right: right.value.right
                            }
                        }
                    } else if (right.value.type === 'ternary') {
                        actualValue = <Token<RValue>>{
                            start: actualValue.start,
                            end: right.end,
                            value: <TernaryRValue>{
                                type: 'ternary',
                                condition: <Token<RValue>>{
                                    start: left.start,
                                    end: right.value.condition.end,
                                    value: <BinaryRValue>{
                                        type: 'binary',
                                        operator: binaryOperator[0],
                                        left,
                                        right: right.value.condition
                                    }
                                },
                                ifTrue: right.value.ifTrue,
                                ifFalse: right.value.ifFalse
                            }
                        };
                    } else {
                        actualValue = <Token<RValue>>{
                            start: actualValue.start,
                            end: right.end + 1,
                            value: <BinaryRValue>{
                                type: 'binary',
                                operator: binaryOperator[0],
                                left,
                                right
                            }
                        };
                    }
                }

                return actualValue;
            }
        }
    ))(ctx);
}

export const variableModification = map(
    expect(
        seq(
            token(any(variableLiteral, between(lpr, castedRValue, rpr))),
            many(between(
                lbr,
                recoverByAddingChars('0', rValue(), true, 'value'),
                rstr(']')
            )),
            spaces,
            opt(binaryOperator),
            str('='),
            surely(seq(
                spaces,
                recoverByAddingChars('0', rValue(), true, 'value')
            ))
        ),
        'Variable modification statement'
    ),
    ([name, indexes, _, operator, __, [___, value]]) => {
        let actualName: Token<VariableRValue | CastedRValue | IndexRValue> = name;
        indexes.forEach(index => {
            actualName = <Token<IndexRValue>>{
                start: actualName.start,
                end: index.end + 1,
                value: <IndexRValue>{
                    type: 'index',
                    value: actualName,
                    parameter: index 
                }
            };
        });
        return <Token<VariableModification>>{
            start: actualName.start,
            end: value.end + 1,
            value: <VariableModification>{
                type: 'modification',
                name: actualName,
                operator: operator ?? undefined,
                value
            }
        };
    }
);

export const topmostVariableDeclaration = map(
    expect(
        seq(
            opt(str('pub ')),
            variableKind,
            spacesPlus,
            surely(
                seq(
                    recoverByAddingChars('variable', variableName, true, 'variable name'),
                    spaces,
                    rstr('='),
                    spaces,
                    recoverByAddingChars('0', rValue(), true, 'value')
                )
            )
        ),
        'Variable declaration statement'
    ),
    ([pub, kind, _, [name, __, ___, ____, value]]) => (<Token<VariableDeclaration>>{
        start: kind.start,
        end: value.end,
        value: <VariableDeclaration> {
            type: 'declaration',
            public: !!pub,
            kind,
            name,
            value
        }
    })
);

export const variableDeclaration = map(
    expect(
        seq(
            variableKind,
            spacesPlus,
            surely(
                seq(
                    recoverByAddingChars('variable', variableName, true, 'variable name'),
                    spaces,
                    rstr('='),
                    spaces,
                    recoverByAddingChars('0', rValue(), true, 'value')
                )
            )
        ),
        'Variable declaration statement'
    ),
    ([kind, _, [name, __, ___, ____, value]]) => (<Token<VariableDeclaration>>{
        start: kind.start,
        end: value.end,
        value: <VariableDeclaration> {
            type: 'declaration',
            public: false,
            kind,
            name,
            value
        }
    })
);
