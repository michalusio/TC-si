import { any, between, exhaust, expect, intP, many, map, opt, Parser, ref, regex, seq, spaces, spacesPlus, str, surely, wspaces } from "parser-combinators"
import { lab, rab, lbr, variableName, typeDefinition, functionName, lpr, unaryOperator, binaryOperator, lcb, blockComment, lineComment, BinaryOperators } from "./base";
import { ArrayRValue, BinaryRValue, CastedRValue, DotMethodRValue, FunctionRValue, IndexRValue, InterpolatedRValue, NumberRValue, RValue, StringRValue, TernaryRValue, UnaryRValue, VariableRValue } from "./rvalue";
import { recoverByAddingChars, rstr, token } from "./utils";
import { Token, VariableDeclaration, VariableModification } from "./ast";
import { log, precedence } from "../storage";

const variableKind = token(any(
    str('const'),
    str('let'),
    str('var')
));

export const stringLiteral = map(
    regex(/"(?:\.|(\\\")|[^\""\n])*"/, 'String literal'),
    (value) =>  (<StringRValue>{
        type: 'string',
        value
    })
);

const stringInterpolatedLiteral = map(
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
)

const numericBase2Literal = map(
    regex(/0b[01][_01]*/, 'Numeric literal'),
    (str) => (<NumberRValue>{
        type: 'number',
        value: parseInt(str.slice(2).replaceAll('_', ''), 2)
    })
);
const numericBase10Literal = map(
    expect(intP, 'Numeric literal'),
    (value) => (<NumberRValue>{
        type: 'number',
        value
    })
);
const numericBase16Literal = map(
    regex(/0x[0-9a-zA-Z]+/, 'Numeric literal'),
    (str) => (<NumberRValue>{
        type: 'number',
        value: parseInt(str, 16)
    })
);

export const anyNumericLiteral = any(
    numericBase16Literal,
    numericBase2Literal,
    numericBase10Literal
);

const variableLiteral = map(
    expect(variableName, 'Variable literal'),
    (value) => (<VariableRValue>{
        type: 'variable',
        value
    })
);
const arrayLiteral = map(
    seq(
        lbr,
        surely(exhaust(
            seq(
                wspaces,
                rValue(),
                opt(seq(
                    wspaces,
                    str(','),
                    opt(any(lineComment, blockComment))
                ))
            ),
            seq(opt(any(lineComment, blockComment)), wspaces, rstr(']', false))
        )),
        opt(any(lineComment, blockComment)),
        wspaces,
        rstr(']')
    ), ([_, values, __, ___]) =>  (<ArrayRValue>{
        type: 'array',
        values: values.map(v => v[1])
    })
);

export const functionCall = map(seq(
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
                        seq(spaces, rstr(')', false))
                    )
                )
            )
        ),
        seq(spaces, rstr(')'))
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
});

const cast = between(
    lab,
    typeDefinition(),
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

const parenthesisedRValue = between(
    seq(lpr, spaces),
    map(rValue(), r => r.value),
    seq(spaces, rstr(')'))
);

export function rValue(): Parser<Token<RValue>> {
    return (ctx) => map(
        seq(
            token(any(
                unaryRValue,
                castedRValue,
                stringLiteral,
                stringInterpolatedLiteral,
                numericBase16Literal,
                numericBase2Literal,
                numericBase10Literal,
                parenthesisedRValue,
                arrayLiteral,
                functionCall,
                variableLiteral
            )),
            many(between(
                lbr,
                recoverByAddingChars('0', rValue(), true, 'index'),
                rstr(']')
            )),
            opt(seq(spaces, blockComment)),
            any(
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
                    opt(
                        seq(
                            str('.'),
                            surely(functionCall)
                        )
                    ),
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
            )
        ),
        ([value, indexes, _, operation]) => {
            let actualValue: Token<RValue> = value;
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
                const op = operation as [[".", FunctionRValue] | null, [BinaryOperators, Token<RValue>] | null];
                const functionCall = op[0];
                if (functionCall) {
                    actualValue = <Token<RValue>>{
                        start: actualValue.start,
                        end: (functionCall[1].parameters[functionCall[1].parameters.length - 1]?.end ?? (actualValue.end + 1)) + 1,
                        value: <DotMethodRValue>{
                            type: 'dotMethod',
                            object: actualValue,
                            value: functionCall[1].value,
                            parameters: functionCall[1].parameters
                        }
                    };
                }

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
    )(ctx);
}

export const variableModification = map(
    expect(
        seq(
            token(variableLiteral),
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
        let actualName: Token<VariableRValue | IndexRValue> = name;
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
