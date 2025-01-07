import { any, between, exhaust, expect, intP, map, opt, Parser, regex, seq, spaces, spacesPlus, str, surely, wspaces } from "parser-combinators"
import { lab, rab, lbr, rbr, variableName, typeDefinition, functionName, lpr, rpr, unaryOperator, binaryOperator, lcb, rcb } from "./base";
import { ArrayRValue, BinaryRValue, CastedRValue, DotMethodRValue, FunctionRValue, IndexRValue, InterpolatedRValue, NumberRValue, RValue, StringRValue, TernaryRValue, UnaryRValue, VariableRValue } from "./ast";
import { recoverByAddingChars, rstr } from "./utils";

const variableKind = any(
    str('const'),
    str('let'),
    str('var')
);

const stringLiteral = map(
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
            value: RValue;
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
                    str(',')
                ))
            ),
            seq(wspaces, rstr(']', false))
        )),
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
        surely(opt(seq(
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
        ))),
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

export const variableIndex = map(seq(
    variableName,
    between(
        lbr,
        recoverByAddingChars('0', rValue(), true, 'index'),
        rstr(']')
    )
), ([name, parameter]) => {
    return <IndexRValue>{
        type: 'index',
        value: name,
        parameter 
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
    rValue(),
    seq(spaces, rstr(')'))
);

export function rValue(): Parser<RValue> {
    return (ctx) => map(
        seq(
            any(
                parenthesisedRValue,
                unaryRValue,
                castedRValue,
                stringLiteral,
                stringInterpolatedLiteral,
                numericBase16Literal,
                numericBase2Literal,
                numericBase10Literal,
                arrayLiteral,
                functionCall,
                variableIndex,
                variableLiteral
            ),
            opt(
                any(
                    seq(
                        spaces,
                        str('?'),
                        surely(seq(
                            spaces,
                            recoverByAddingChars('0', rValue(), true, 'on-true value'),
                            spaces,
                            str(':'),
                            spaces,
                            recoverByAddingChars('0', rValue(), true, 'on-false value')
                        ))
                    ),
                    seq(
                        str('.'),
                        surely(functionCall)
                    ),
                    seq(
                        spaces,
                        binaryOperator,
                        spaces,
                        recoverByAddingChars('0', rValue(), true, 'second operand')
                    )
                )
            )
        ),
        ([value, operation]) =>
            operation
            ? (
                operation[0] === '.'
                ? (<DotMethodRValue>{
                    type: 'dotMethod',
                    object: value,
                    value: (operation[1] as FunctionRValue).value,
                    parameters: (operation[1] as FunctionRValue).parameters
                })
                : (
                    operation[1] === '?'
                    ? (<TernaryRValue>{
                        type: 'ternary',
                        condition: value,
                        ifTrue: operation[2][1],
                        ifFalse: operation[2][5]
                    })
                    : (<BinaryRValue>{
                        type: 'binary',
                        operator: operation[1],
                        left: value,
                        right: operation[3]
                    })
                )
            )
            : value
    )(ctx);
}

export const variableModification = expect(seq(
    any(variableIndex, variableName),
    surely(seq(
        spaces,
        opt(binaryOperator),
        rstr('='),
        spaces,
        recoverByAddingChars('0', rValue(), true, 'value'),
    ))
), 'Variable modification statement');

export const variableDeclaration = expect(seq(
    variableKind,
    spacesPlus,
    surely(seq(
        recoverByAddingChars('variable', any(variableIndex, variableName), true, 'variable name'),
        spaces,
        opt(binaryOperator),
        rstr('='),
        spaces,
        recoverByAddingChars('0', rValue(), true, 'value'),
    ))
), 'Variable declaration statement');
