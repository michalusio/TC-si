import { any, between, exhaust, expect, expectErase, intP, many, map, opt, Parser, ref, regex, seq, spaces, spacesPlus, str, surely, wspaces } from "parser-combinators"
import { lab, rab, lbr, rbr, variableName, typeDefinition, functionName, lpr, rpr, unaryOperator, binaryOperator, newline } from "./base";
import { ArrayRValue, BinaryRValue, CastedRValue, FunctionRValue, IndexRValue, NumberRValue, RValue, StringRValue, UnaryRValue, VariableRValue } from "./ast";

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
            seq(wspaces, rbr)
        )),
        wspaces,
        rbr
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
                rpr
            )
        ))),
        rpr
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
                rbr
            )
        ))),
        rbr
    )
), ([name, rest]) => {
    const parameters = rest == null
        ? []
        : [
            rest[1],
            ...rest[2].map(r => r[3])
        ]
    return <IndexRValue>{
        type: 'index',
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
})

function rValue(): Parser<RValue> {
    return (ctx) => map(
        seq(
            any(
                unaryRValue,
                castedRValue,
                stringLiteral,
                numericBase16Literal,
                numericBase2Literal,
                numericBase10Literal,
                arrayLiteral,
                functionCall,
                variableIndex,
                variableLiteral
            ),
            opt(
                seq(
                    spaces,
                    binaryOperator,
                    spaces,
                    rValue()
                )
            )
        ),
        ([value, operation]) =>
            operation
            ? (<BinaryRValue>{
                type: 'binary',
                operator: operation[1],
                left: value,
                right: operation[3]
            })
            : value
    )(ctx);
}

export const variableModification = expect(seq(
    any(variableIndex, variableName),
    surely(seq(
        spacesPlus,
        str('='),
        spacesPlus,
        rValue(),
        newline
    ))
), 'Variable modification statement');

export const variableDeclaration = expect(seq(
    variableKind,
    spacesPlus,
    surely(variableModification)
), 'Variable declaration statement');
