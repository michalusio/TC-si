import { any, between, exhaust, intP, map, Parser, regex, seq, spaces, spacesPlus, str, Token, wspaces } from "parser-combinators";
import { Alu, In, Jump, JumpReg, Mem, Out } from "../compiler/instructions";
import { AluInstruction, Immediate, JumpInstruction, LabelMarker, Register } from "../compiler/types";
import { rstr } from "./utils";
import { DiagnosticSeverity, Range, TextDocument } from "vscode";
import { Statement, StatementsBlock } from "./types/ast";
import { SimplexDiagnostic } from "../SimplexDiagnostic";
import { CP850TableMap, isRValue } from "../compiler";
import { RValue } from "./types/rvalue";
import { getInnerArrayType, getIntBitSize, isIntegerType, typeStringToTypeToken } from "../typeSetup";
import { lineComment } from "./base";

const register = any<Register>(
    regex(/r(?:(?:10)|(?:11)|(?:12)|(?:13)|[0-9])/i, 'register') as Parser<Register>,
    regex(/flags/i, 'flags') as Parser<Register>,
    regex(/sp/i, 'sp') as Parser<Register>
);

const immediate: Parser<Immediate> = map(intP, i => ({ type: 'immediate', value: i }));

const aluInstruction = map(any(
    regex(/add/i, 'add'),
    regex(/sub/i, 'sub'),
    regex(/lsl/i, 'lsl'), 
    regex(/lsr/i, 'lsr'),
    regex(/and/i, 'and'),
    regex(/or/i, 'or'),
    regex(/nand/i, 'nand'),
    regex(/nor/i, 'nor'),
    regex(/xor/i, 'xor'),
    regex(/mul/i, 'mul')
), a => a.toLowerCase()) as Parser<AluInstruction>;

const alu = map(
    seq(
        aluInstruction,
        spacesPlus,
        register,
        seq(spaces, str(','), spaces),
        register,
        seq(spaces, str(','), spaces),
        any(register, immediate)
    ),
    ([type, _, target, __, argument1, ___, argument2]) => Alu(type, target, argument1, argument2)
);

const label = map(regex(/[a-z0-9]/i, 'label'), ([label]) => (<LabelMarker>{ type: 'label', value: label }));

const labelMarker = map(
    seq(
        label,
        str(':')
    ),
    ([label, _]) => label
)

const jmpInstruction = map(any(
    regex(/je/i, 'je'),
    regex(/jne/i, 'jne'),
    regex(/jl/i, 'jl'),
    regex(/jge/i, 'jge'),
    regex(/jle/i, 'jle'),
    regex(/jg/i, 'jg'),
    regex(/jb/i, 'jb'),
    regex(/jae/i, 'jae'),
    regex(/jbe/i, 'jbe'),
    regex(/ja/i, 'ja'),
), j => j.toLowerCase()) as Parser<Exclude<JumpInstruction, 'jmp'>>;

const jumps = map(
    any(
        seq(
            jmpInstruction,
            spacesPlus,
            any(immediate, label)
        ),
        seq(
            map(regex(/jmp/i, 'jmp'), j => j.toLowerCase()) as Parser<'jmp'>,
            spacesPlus,
            register
        ),
    ),
    ([type, _, value]) => type === 'jmp' ? JumpReg(value) : Jump(type, value)
)

const io = map(
    seq(
        any(
            map(regex(/in/i, 'in'), i => i.toLowerCase()) as Parser<'in'>,
            map(regex(/out/i, 'out'), i => i.toLowerCase()) as Parser<'out'>
        ),
        spacesPlus,
        register
    ),
    ([type, _, reg]) => type === 'in' ? In(reg) : Out(reg) 
)

const stores = map(
    seq(
        map(any(
            regex(/store_16/i, 'store_16'),
            regex(/store_8/i, 'store_8')
        ), s => s.toLowerCase()) as Parser<'store_16' | 'store_8'>,
        spacesPlus,
        between(
            seq(str('['), spaces),
            register,
            seq(spaces, str(']'))
        ),
        seq(spaces, str(','), spaces),
        register
    ),
    ([type, _, address, __, value]) => Mem(type, value, address)
);

const loads = map(
    seq(
        map(any(
            regex(/load_16/i, 'load_16'),
            regex(/load_8/i, 'load_8')
        ), s => s.toLowerCase()) as Parser<'load_16' | 'load_8'>,
        spacesPlus,
        register,
        seq(spaces, str(','), spaces),
        between(
            seq(str('['), spaces),
            register,
            seq(spaces, str(']'))
        )
    ),
    ([type, _, address, __, register]) => Mem(type, register, address)
);

export const symphonyParser = between(
    spaces,
    exhaust(
        between(
            wspaces,
            any(
                alu,
                labelMarker,
                jumps,
                io,
                stores,
                loads,
                map(lineComment, comment => ({ type: 'comment', id: comment} as const))
            ),
            wspaces
        ),
        seq(wspaces, rstr('}'))
    ),
    spaces
);

export const checkSymphonyDiagnostics = (document: TextDocument, parseResult: StatementsBlock, diags: SimplexDiagnostic[]) => {
    parseResult.forEach(node => checkSymphonyNode(node, document, diags));
}

const checkSymphonyNode = (node: Token<Statement>, document: TextDocument, diags: SimplexDiagnostic[]) => {
    if (isRValue(node)) {
        checkSymphonyRValueNode(node, document, diags);
    } else {
        checkSymphonyStatementNode(node, document, diags);
    }
}

const checkSymphonyStatementNode = (token: Exclude<Token<Statement>, Token<RValue>>, document: TextDocument, diags: SimplexDiagnostic[]) => {
    const node = token.value as Exclude<Statement, RValue>;
    switch (node.type) {
        case '_reg_alloc_use': {
            diags.push(new SimplexDiagnostic(
                new Range(
                    document.positionAt(token.start),
                    document.positionAt(token.end)
                ),
                "_reg_alloc_use is not needed for Symphony compilation",
                DiagnosticSeverity.Information
            ));
            break;
        }
        case 'asm': {
            if (node.architecture !== 'symphony') {
                diags.push(new SimplexDiagnostic(
                    new Range(
                        document.positionAt(token.start),
                        document.positionAt(token.end)
                    ),
                    `Only Symphony is supported for asm compilation`
                ));
            }
            break;
        }
        case 'break': {
            break;
        }
        case 'continue': {
            break;
        }
        case 'statements': {
            node.statements.forEach(s => checkSymphonyNode(s, document, diags));
            break;
        }
        case 'return': {
            if (node.value.value) {
                checkSymphonyRValueNode(node.value as Token<RValue>, document, diags);
            }
            break;
        }
        case 'type-definition': {
            if (typeof node.definition.value === 'string') {
                checkSymphonyType(node.definition as Token<string>, document, diags);
            }
            break;
        }
        case 'declaration': {
            checkSymphonyRValueNode(node.value, document, diags);
            break;
        }
        case 'modification': {
            checkSymphonyRValueNode(node.value, document, diags);
            let left = node.name.value;
            switch (left.type) {
                case 'variable': {
                    break;
                }
                case 'cast': {
                    checkSymphonyType(left.to, document, diags);
                    checkSymphonyRValueNode(left.value, document, diags);
                    break;
                }
                case 'index': {
                    checkSymphonyRValueNode(left.parameter, document, diags);
                    checkSymphonyRValueNode(left.value, document, diags);
                    break;
                }
            }
            break;
        }
        case 'while': {
            checkSymphonyRValueNode(node.value, document, diags);
            node.statements.forEach(s => checkSymphonyNode(s, document, diags));
            break;
        }
        case 'if': {
            checkSymphonyRValueNode(node.value, document, diags);
            node.ifBlock.forEach(s => checkSymphonyNode(s, document, diags));
            node.elseBlock.forEach(s => checkSymphonyNode(s, document, diags));
            break;
        }
        case 'function-declaration': {
            node.definition.parameters.forEach(p => checkSymphonyType(p.type, document, diags));
            node.statements.forEach(s => checkSymphonyNode(s, document, diags));
            if (node.definition.returnType.value) {
                checkSymphonyType(node.definition.returnType as Token<string>, document, diags);
            }
            break;
        }
        case 'switch': {
            checkSymphonyRValueNode(node.value, document, diags);
            node.cases.forEach(c => {
                c.statements.forEach(s => checkSymphonyNode(s, document, diags));
                if (c.caseName.value !== 'default') {
                    checkSymphonyRValueNode(c.caseName as Token<RValue>, document, diags);
                }
            });
            break;
        }
    }
}

const checkSymphonyRValueNode = (node: Token<RValue>, document: TextDocument, diags: SimplexDiagnostic[]) => {
    switch (node.value.type) {
        case 'string': {
            node.value.value.split('').forEach((c, i) => {
                if (!CP850TableMap.has(c)) {
                    diags.push(new SimplexDiagnostic(
                        new Range(
                            document.positionAt(node.start + i + 1),
                            document.positionAt(node.start + i + 2)
                        ),
                        `Character '${c}' is not available in Code Page 850`
                    ));
                }
            });
            break;
        }
        case 'number': {
            if (node.value.value > 65535 || node.value.value < -32768) {
                diags.push(new SimplexDiagnostic(
                    new Range(
                        document.positionAt(node.start),
                        document.positionAt(node.end)
                    ),
                    "Compiler supports only values that fit in U16 or S16"
                ));
            }
            break;
        }
        case 'array': {
            node.value.values.forEach(n => checkSymphonyRValueNode(n, document, diags));
            break;
        }
        case 'binary': {
            checkSymphonyRValueNode(node.value.left, document, diags);
            checkSymphonyRValueNode(node.value.right, document, diags);
            break;
        }
        case 'cast': {
            checkSymphonyType(node.value.to, document, diags);
            checkSymphonyRValueNode(node.value.value, document, diags);
            break;
        }
        case '_default': {
            break;
        }
        case 'variable': {
            break;
        }
        case 'unary': {
            checkSymphonyRValueNode(node.value.value, document, diags);
            break;
        }
        case 'ternary': {
            checkSymphonyRValueNode(node.value.condition, document, diags);
            checkSymphonyRValueNode(node.value.ifFalse, document, diags);
            checkSymphonyRValueNode(node.value.ifTrue, document, diags);
            break;
        }
        case 'parenthesis': {
            checkSymphonyRValueNode(node.value.value, document, diags);
            break;
        }
        case 'interpolated': {
            node.value.value.split('').forEach((c, i) => {
                if (!CP850TableMap.has(c)) {
                    diags.push(new SimplexDiagnostic(
                        new Range(
                            document.positionAt(node.start + i + 1),
                            document.positionAt(node.start + i + 2)
                        ),
                        `Character '${c}' is not available in Code Page 850`
                    ));
                }
            });
            node.value.inserts.forEach(n => {
                checkSymphonyRValueNode(n.value, document, diags);
            });
            break;
        }
        case 'index': {
            checkSymphonyRValueNode(node.value.parameter, document, diags);
            checkSymphonyRValueNode(node.value.value, document, diags);
            break;            
        }
        case 'function': {
            node.value.parameters.forEach(p => {
                checkSymphonyRValueNode(p, document, diags);
            });
            break;
        }
        case 'dotMethod': {
            checkSymphonyRValueNode(node.value.object, document, diags);
            node.value.parameters.forEach(p => {
                checkSymphonyRValueNode(p, document, diags);
            });
            break;
        }
    }
}

const checkSymphonyType = (type: Token<string>, document: TextDocument, diags: SimplexDiagnostic[]) => {
    const arrayConverted = typeStringToTypeToken(type.value);
    const [_, t] = getInnerArrayType(arrayConverted);
    if (isIntegerType(t)) {
        if (getIntBitSize(t) > 16) {
            diags.push(new SimplexDiagnostic(
                new Range(
                    document.positionAt(type.start),
                    document.positionAt(type.end)
                ),
                "Integer bit sizes over 16 are not supported"
            ));
        }
    }
}