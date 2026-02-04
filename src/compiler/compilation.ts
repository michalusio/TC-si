import { TextDocument } from "vscode";
import { getPositionInfo } from "../parser";
import { FunctionDefinition, Statement, StatementsBlock, VariableName } from "../parsers/types/ast";
import { RValue } from "../parsers/types/rvalue";
import { Alu, Block, Cmp, Instruction, Jump, Label, Comment, Mov, Neg, Not, Ret, Mem, Push, Call, Pop, InstructionOrBlock, NewLine } from "./instructions";
import { combineRegisterState, copyVariableState, findRegisterValue, findVariableRegister, markRegister, offsetVariableState, releaseRegisterMarker, renameMarker, reserveRegister, reserveRegisterValue, tempValueMarker, variableMarker } from "./registers";
import { AssignableRegister, RegisterState, TempValueMarker, VariableState } from "./types";
import { id } from './utils';
import { isIntegerType } from "../typeSetup";
import { rcDecrementStatements, rcIncrementStatements } from "./rc";
import { Token, TokenRange } from "parser-combinators";

export type CompilationResult = {
    type: 'ok',
    value: Instruction[]
} | {
    type: 'error',
    value: string
}

export type CompileUtilities = {
    document: TextDocument,
    topmost: boolean,
    malloc_token: Token<string>,
    increment_rc_token: Token<string>
    decrement_rc_token: Token<string>,
    getDefinition: (range: TokenRange) => FunctionDefinition | null;
    typeGetter: (range: TokenRange) => string | null;
    currentStartLabel?: string;
    currentEndLabel?: string;
};

export function compileNode(node: Token<Statement>, regState: RegisterState, varState: VariableState, utilities: CompileUtilities): InstructionOrBlock[] {
    if (isRValue(node)) {
        return compileRValueNode(node, regState, varState, utilities);
    } else {
        return compileStatementNode(node, regState, varState, utilities);
    }
}

export function isRValue(node: Token<Statement>): node is Token<RValue> {
    switch (node.value.type) {
        case "parenthesis":
        case "cast":
        case "unary":
        case "binary":
        case "ternary":
        case "string":
        case "interpolated":
        case "number":
        case "array":
        case "function":
        case "_default":
        case "dotMethod":
        case "index":
        case "variable":
            return true;
    }
    return false;
}

function compileStatementNode(token: Exclude<Token<Statement>, Token<RValue>>, regState: RegisterState, varState: VariableState, utilities: CompileUtilities): InstructionOrBlock[] {
    const node = token.value as Exclude<Statement, RValue>;
    switch (node.type) {
        case 'statements': {
            return [
                Block('block', compileStatements(node.statements, regState, varState, utilities))
            ];
        }        
        case 'while': {
            const conditionCode = compileNode(node.value, regState, varState, utilities);
            const conditionMarker = tempValueMarker(node.value);
            const conditionRegister = findRegisterValue(regState, conditionMarker);
            releaseRegisterMarker(regState, conditionMarker);

            const whileId = id();
            const start = `while-start-${whileId}`;
            const end = `while-end-${whileId}`;

            const statementsRegState = {...regState}
            const statementsResult = compileStatements(node.statements, statementsRegState, varState, {
                ...utilities,
                currentStartLabel: start,
                currentEndLabel: end
            });
            
            combineRegisterState(regState, [statementsRegState, regState]);
            
            return [
                Block('while', [
                    ...conditionCode,
                    Cmp('r0', conditionRegister),
                    Jump('je', { type: 'label', value: end }),
                    ...statementsResult,
                    Jump('jmp', { type: 'label', value: start })
                ], whileId)
            ]
        }
        case "function-declaration": {
            const id = node.definition.name.value;

            const functionRegState: RegisterState = {
                r1: ['0'],
                r2: ['0'],
                r3: ['0'],
                r4: ['0'],
                r5: ['0'],
                r6: ['0'],
                r7: ['0'],
                r8: ['0'],
                r9: ['0'],
                r10: ['0'],
                r11: ['0'],
                r12: ['0'],
                r13: ['0'],
            };

            const functionVarState: VariableState = copyVariableState(varState);
            node.definition.parameters.forEach((p, i) => {
                const reg = `r${i+1}` as AssignableRegister;
                const pName = p.name.value;
                const parameterName = pName.front + pName.name;
                functionRegState[reg] = [variableMarker(parameterName)];
                functionVarState[parameterName] = {
                    type: 'argument',
                    offset: (i + 1) * 2
                };
            });

            const statementsResult = compileStatements([
                ...node.statements,
                {
                    start: token.end,
                    end: token.end + 1,
                    value: {
                        type: 'return',
                        value: {
                            start: token.end,
                            end: token.end + 1,
                            value: null
                        }
                    }
                }
            ], functionRegState, functionVarState, {
                ...utilities,
                topmost: false
            });

            return [
                NewLine(),
                Block(node.definition.public ? 'pub-function' : 'function', statementsResult, id)
            ];
        }
        case 'return': {
            const statementsResult: InstructionOrBlock[] = [];
            if (node.value.value) {
                const token = node.value as Token<RValue>;
                statementsResult.push(...compileNode(token, regState, varState, utilities));
                const marker = tempValueMarker(token);
                const reg = findRegisterValue(regState, marker);
                regState['r1'] = regState[reg as AssignableRegister];
                if (reg !== 'r1') {
                    regState[reg as AssignableRegister] = ['0'];
                    statementsResult.push(Mov('r1', reg));
                }
                const variableInRegister = regState['r1'].find(m => m.startsWith('var-'))?.slice(4);
                if (variableInRegister) {
                    const varType = varState[variableInRegister].type;
                    if (varType === 'array_16' || varType === 'string') {
                        const [s1, s2] = rcIncrementStatements({
                            front: '',
                            name: variableInRegister
                        }, utilities.increment_rc_token);
                        statementsResult.push(...compileNode(s1, regState, varState, utilities));
                        statementsResult.push(...compileNode(s2, regState, varState, utilities));
                    }
                }
            }
            if (node.variablesToDeallocate) {
                node.variablesToDeallocate.forEach(v => {
                    const [s1, s2] = rcDecrementStatements(v, utilities.decrement_rc_token);
                    statementsResult.push(
                        ...compileNode(s1, regState, varState, utilities),
                        ...compileNode(s2, regState, varState, utilities)
                    );
                });
            }
            const variablesSize = getDeclaredVariableSize(varState);
            statementsResult.push(...deallocate(varState, variablesSize));
            statementsResult.push(Ret());
            return statementsResult;
        }
        case 'if': {
            const ifId = id();
            const end = `if-end-${ifId}`;
            const ifElse = `if-else-${ifId}`;

            const conditionCode = compileNode(node.value, regState, varState, utilities);
            const conditionMarker = tempValueMarker(node.value);
            const conditionRegister = findRegisterValue(regState, conditionMarker);
            releaseRegisterMarker(regState, conditionMarker);
            const ifRegState = {...regState};
            const ifBlockResults = compileStatements(node.ifBlock, ifRegState, varState, utilities);

            if (node.elseBlock.length === 0) {
                return [
                    Comment(`if-start-${ifId}`),
                    ...conditionCode,
                    Cmp('r0', conditionRegister),
                    Jump('je', { type: 'label', value: end }),
                    ...ifBlockResults,
                    Label(end)
                ];
            } else {
                const elseRegState = {...regState};
                const elseBlockResults = compileStatements(node.elseBlock, elseRegState, varState, utilities);

                combineRegisterState(regState, [ifRegState, elseRegState]);

                return [
                    Comment(`if-start-${ifId}`),
                    ...conditionCode,
                    Cmp('r0', conditionRegister),
                    Jump('je', { type: 'label', value: ifElse }),
                    ...ifBlockResults,
                    Jump('jmp', { type: 'label', value: end }),
                    Label(ifElse),
                    ...elseBlockResults,
                    Label(end)
                ];
            }
        }
        case 'declaration': {
            let newValueNode = node.value;
            const staticValue = tryGetStaticValue(node.value.value);
            if (staticValue != null) {
                if (utilities.topmost) {
                    // if we're at the top of the file, we can change it to a static variable
                    const varName = node.name.value.front + node.name.value.name;
                    varState[varName] = {
                        type: 'static',
                        value: staticValue
                    }
                    return [];
                } else {
                    // if not, we can use it as the precalculated value
                    newValueNode = {
                        start: node.value.start,
                        end: node.value.end,
                        value: {
                            type: 'number',
                            value: staticValue
                        }
                    };
                }
            }
            return [
                // Allocating the variable first
                ...allocateVariable(varState, node.name.value, utilities.topmost),
                // Treat the assignment of initial value as a modification
                ...compileStatementNode({
                    start: token.start,
                    end: token.end,
                    value: {
                        type: 'modification',
                        name: {
                            start: node.name.start,
                            end: node.name.end,
                            value: {
                                type: 'variable',
                                value: node.name
                            }
                        },
                        operator: undefined,
                        value: newValueNode
                    }
                }, regState, varState, utilities)
            ];
        }
        case 'modification': {
            switch (node.name.value.type) {
                case 'cast':
                    switch (node.name.value.value.value.type) {
                        case 'index':
                        case 'variable':
                            return compileStatementNode({
                                ...token,
                                value: {
                                    ...node,
                                    name: {
                                        start: node.name.value.value.start,
                                        end: node.name.value.value.end,
                                        value: node.name.value.value.value
                                    }
                                }
                            }, regState, varState, utilities);
                        default:
                            throw `Unsupported variable modification type: ${node.name.value.type}`;
                    }
                case 'index':
                    {
                        const pointerStatements = compileNode(node.name.value.value, regState, varState, utilities);
                        const pointerMarker = tempValueMarker(node.name.value.value);
                        const pointerReg = findRegisterValue(regState, pointerMarker);

                        const offsetStatements = compileNode(node.name.value.parameter, regState, varState, utilities);
                        const offsetMarker = tempValueMarker(node.name.value.parameter);
                        const offsetReg = findRegisterValue(regState, offsetMarker);
                        releaseRegisterMarker(regState, offsetMarker);

                        const rValue: Token<RValue> = node.operator
                            ? {
                                start: node.value.start - 1,
                                end: node.value.end,
                                value: {
                                    type: 'binary',
                                    operator: node.operator,
                                    left: {
                                        start: node.value.start - 1,
                                        end: node.value.start - 1,
                                        value: node.name.value
                                    },
                                    right: node.value
                                }
                            }
                            : node.value;

                        const statements = compileNode(rValue, regState, varState, utilities);
                        const rValueMarker = tempValueMarker(rValue);
                        const rValueRegister = findRegisterValue(regState, rValueMarker);
                        
                        releaseRegisterMarker(regState, pointerMarker);
                        releaseRegisterMarker(regState, rValueMarker);

                        return [
                            ...pointerStatements,
                            ...offsetStatements,
                            Alu('add', pointerReg, pointerReg, offsetReg),
                            Alu('add', pointerReg, pointerReg, offsetReg),
                            ...statements,
                            //Comment(`Storing variable ${varName}`),
                            //Alu('add', reg, 'sp', { type: 'immediate', value: spOffset.offset }),
                            Mem('store_16', rValueRegister, pointerReg),
                        ];
                    }
                case 'variable':
                    {
                        const varData = node.name.value.value.value;
                        const varName = varData.front + varData.name;

                        const spOffset = varState[varName];
                        if (spOffset == null) throw `Could not find stack position of variable ${varName}`;
                        if (spOffset.type !== 'declared' && spOffset.type !== 'topmost') throw `Cannot modify a not-declared variable ${varName}`;

                        const rValue: Token<RValue> = node.operator
                            ? {
                                start: node.value.start - 1,
                                end: node.value.end,
                                value: {
                                    type: 'binary',
                                    operator: node.operator,
                                    left: {
                                        start: node.value.start - 1,
                                        end: node.value.start - 1,
                                        value: {
                                            type: 'variable',
                                            value: node.name.value.value
                                        }
                                    },
                                    right: node.value
                                }
                            }
                            : node.value;

                        const existingVarRegister = findVariableRegister(regState, varName);
                        const statements = compileNode(rValue, regState, varState, utilities);
                        const rValueMarker = tempValueMarker(rValue);
                        const rValueRegister = findRegisterValue(regState, rValueMarker);
                        
                        const varMarker = variableMarker(varName);
                        const varReg = existingVarRegister ?? rValueRegister;

                        if (varReg === rValueRegister) {
                            releaseRegisterMarker(regState, varMarker);
                            renameMarker(regState, rValueMarker, varMarker);
                        } else {
                            releaseRegisterMarker(regState, rValueMarker);
                        }

                        return [
                            ...statements,
                            ...(utilities.topmost ? [
                                Comment(`Storing variable ${varName}`),
                                Alu('add', 'sp', 'sp', { type: 'immediate', value: spOffset.offset }),
                                Mem('store_16', rValueRegister, 'sp'),
                                Alu('sub', 'sp', 'sp', { type: 'immediate', value: spOffset.offset }),
                            ] : []),
                            ...(varReg === rValueRegister ? [] : [Mov(varReg, rValueRegister)])
                        ];
                    }
            }            
        }
        case '_reg_alloc_use': {
            return [];
        }
        case 'type-definition': {
            if (Array.isArray(node.definition.value)) {
                allocateEnum(varState, node.definition.value);
            }
            return [];
        }
        case 'asm': {
            if (node.architecture !== 'symphony') throw `Only Symphony is supported for asm compilation`;
            return [
                Comment('Custom asm block'),
                ...(JSON.parse(node.code) as InstructionOrBlock[]),
            ];
        }
        case 'break': {
            if (!utilities.currentEndLabel) {
                throw `Break used without a loop`;
            }
            return [Jump('jmp', { type: 'label', value: utilities.currentEndLabel })];
        }
        case 'continue': {
            if (!utilities.currentStartLabel) {
                throw `Continue used without a loop`;
            }
            return [Jump('jmp', { type: 'label', value: utilities.currentStartLabel })];
        }
        case 'switch': {
            throw `Switches are currently not supported`;
        }
        case 'comment': {
            return [
                Comment(node.value)
            ];
        }
        default: {
            const _: never = node;
            throw `Unsupported statement: ${JSON.stringify(node, null, 2)}`;
        }
    }
}

function compileRValueNode(node: Token<RValue>, regState: RegisterState, varState: VariableState, utilities: CompileUtilities): InstructionOrBlock[] {
    const nodeMarker = tempValueMarker(node);
    switch (node.value.type) {
        case 'number': {
            const statementsResult: Instruction[] = [];
            if (node.value.value > 65535 || node.value.value < -32768) {
                throw "Compiler supports only values that fit in U16 or S16";
            }
            const reg = reserveRegisterValue(regState, varState, nodeMarker);
            statementsResult.push(Mov(reg, { type: 'immediate', value: node.value.value }));
            return statementsResult;
        }
        case 'binary': {
            switch (node.value.operator) {
                case '+':
                case '-':
                case '&':
                case '|':
                case '^':
                case '*':
                case '<<':
                case '>>':
                case '==':
                case '!=':
                case '>':
                case '<':
                case '>=':
                case '<=':
                    break;
                default:
                    throw `Binary operator ${node.value.operator} currently not supported`;
            }
            const statementsResult: InstructionOrBlock[] = [];
            statementsResult.push(...compileNode(node.value.left, regState, varState, utilities));
            statementsResult.push(...compileNode(node.value.right, regState, varState, utilities));
            let mLeft = tempValueMarker(node.value.left);
            let mRight = tempValueMarker(node.value.right);
            let rLeft = findRegisterValue(regState, mLeft);
            let rRight = findRegisterValue(regState, mRight);
            releaseRegisterMarker(regState, mLeft);
            releaseRegisterMarker(regState, mRight);
            let rOut = reserveRegisterValue(regState, varState, nodeMarker);
            switch (node.value.operator) {
                case '+':
                    statementsResult.push(Alu('add', rOut, rLeft, rRight));
                    break;
                case '-':
                    statementsResult.push(Alu('sub', rOut, rLeft, rRight));
                    break;
                case '&':
                    statementsResult.push(Alu('and', rOut, rLeft, rRight));
                    break;
                case '|':
                    statementsResult.push(Alu('or', rOut, rLeft, rRight));
                    break;
                case '^':
                    statementsResult.push(Alu('xor', rOut, rLeft, rRight));
                    break;
                case '*':
                    statementsResult.push(Alu('mul', rOut, rLeft, rRight));
                    break;
                case '<<':
                    statementsResult.push(Alu('lsl', rOut, rLeft, rRight));
                    break;
                case '>>':
                    statementsResult.push(Alu('lsr', rOut, rLeft, rRight));
                    break;

                case '==':
                    statementsResult.push(Cmp(rLeft, rRight));
                    statementsResult.push(Alu('and', rOut, 'flags', { type: 'immediate', value: 1 }));
                    break;
                case '!=':
                    statementsResult.push(Cmp(rLeft, rRight));
                    statementsResult.push(Alu('nand', rOut, 'flags', { type: 'immediate', value: 1 }));
                    break;

                case '>':
                    statementsResult.push(Cmp(rRight, rLeft));
                    statementsResult.push(Alu('and', rOut, 'flags', { type: 'immediate', value: 4 }));
                    break;
                case '<=':
                    statementsResult.push(Cmp(rRight, rLeft));
                    statementsResult.push(Alu('nand', rOut, 'flags', { type: 'immediate', value: 4 }));
                    break;

                case '<':
                    statementsResult.push(Cmp(rLeft, rRight));
                    statementsResult.push(Alu('and', rOut, 'flags', { type: 'immediate', value: 4 }));
                    break;
                case '>=':
                    statementsResult.push(Cmp(rLeft, rRight));
                    statementsResult.push(Alu('nand', rOut, 'flags', { type: 'immediate', value: 4 }));
                    break;
                
            }
            return statementsResult;
        }
        case '_default': {
            const reg = reserveRegisterValue(regState, varState, nodeMarker);
            return [Mov(reg, { type: 'immediate', value: 0 })];
        }
        case 'cast': {
            const code = compileNode(node.value.value, regState, varState, utilities);
            const insideMarker = tempValueMarker(node.value.value);
            renameMarker(regState, insideMarker, nodeMarker);
            return code;
        }
        case 'parenthesis': {
            const code = compileNode(node.value.value, regState, varState, utilities);
            const insideMarker = tempValueMarker(node.value.value);
            renameMarker(regState, insideMarker, nodeMarker);
            return code;
        }
        case 'unary': {
            switch (node.value.operator) {
                case '-':
                case '~':
                case '!':
                    break;
                default:
                    throw `Unary operator ${node.value.operator} currently not supported`;
            }
            const statementsResult: InstructionOrBlock[] = [];
            statementsResult.push(...compileNode(node.value.value, regState, varState, utilities));
            let mIn = tempValueMarker(node.value.value);
            let rIn = findRegisterValue(regState, mIn);
            releaseRegisterMarker(regState, mIn);
            let rOut = reserveRegisterValue(regState, varState, nodeMarker);
            switch (node.value.operator) {
                case '-': {
                    statementsResult.push(Neg(rOut, rIn));
                    break;
                }
                case '~':
                case '!': {
                    statementsResult.push(Not(rOut, rIn));
                    break;
                }
            }
            return statementsResult;
        }
        case 'function': {
            const statementsResult: InstructionOrBlock[] = [
                Comment(`Calling function ${node.value.value.value}`)
            ];
            
            const position = utilities.document.positionAt(node.value.value.start + 1);
            let data = getPositionInfo(utilities.document, position);
            let functionDefinition: FunctionDefinition | null = null;
            if (data && typeof data.definition !== 'string') {
                functionDefinition = utilities.getDefinition(data.definition);
            }
            if (!functionDefinition) throw `Cannot find function ${node.value.value.value}`;

            const funcId = `${functionDefinition.public ? 'pub-function' : 'function'}-start-${node.value.value.value}`;
            const parameters = node.value.parameters;

            functionDefinition.parameters.forEach((_, i) => {
                statementsResult.push(...compileNode(parameters[i], regState, varState, utilities));
                const regIn = findRegisterValue(regState, tempValueMarker(parameters[i])) as AssignableRegister;
                const regParam = `r${i+1}` as AssignableRegister;
                if (regIn !== regParam) {
                    if (regState[regParam].includes('0')) {
                        regState[regParam] = regState[regIn];
                        regState[regIn] = ['0'];
                        statementsResult.push(Mov(regParam, regIn));
                    } else {
                        const freeReg = reserveRegisterValue(regState, varState, `temp-${i}00-${i}0` as TempValueMarker) as AssignableRegister;
                        regState[freeReg] = regState[regParam];
                        regState[regParam] = regState[regIn];
                        regState[regIn] = ['0'];
                        statementsResult.push(Mov(freeReg, regParam));
                        statementsResult.push(Mov(regParam, regIn));
                    }
                }
            });

            functionDefinition.parameters.forEach((_, i) => {
                releaseRegisterMarker(regState, tempValueMarker(parameters[i]));
            });

            const needsReturnRegister = functionDefinition.returnType.value != null;

            const pops: Instruction[] = [];
            for (let index = 1; index < 14; index++) {
                const reg = `r${index}` as AssignableRegister;
                if (regState[reg].includes('0')) continue;

                statementsResult.push(Push(reg));
                pops.unshift(Pop(reg));
            }

            statementsResult.push(Call({ type: 'label', value: funcId }));

            const returnRegister = reserveRegisterValue(regState, varState, nodeMarker) as AssignableRegister;
            if (needsReturnRegister) {
                statementsResult.push(Mov(returnRegister, 'r1'));
            }

            statementsResult.push(...pops);

            return statementsResult;
        }
        case 'variable': {
            const varNamePartial = node.value.value.value;
            const varName = varNamePartial.front + varNamePartial.name;

            const spOffset = varState[varName];
            if (spOffset == null) throw `Could not find stack position of variable ${varName}`;

            const varReg = findVariableRegister(regState, varName);
            if (varReg) {
                regState[varReg].push(nodeMarker);
                return [];
            } else {
                const statementsResult: Instruction[] = [];
                const marker = variableMarker(varName);
                const reg = reserveRegisterValue(regState, varState, marker);
                regState[reg as AssignableRegister].push(nodeMarker);
                if (spOffset.type === 'static') {
                    statementsResult.push(Mov(reg, { type: 'immediate', value: spOffset.value }));
                } else if (spOffset.type === 'argument' || spOffset.type === 'declared' || spOffset.type === 'topmost') {
                    statementsResult.push(Comment(`Loading variable ${varName}`));
                    statementsResult.push(Alu('add', reg, 'sp', { type: 'immediate', value: spOffset.offset }));
                    statementsResult.push(Mem('load_16', reg, reg));
                }
                return statementsResult;
            }
        }
        case 'array': {
            const name = `array-${id()}`;
            const allocation = allocateArray({
                front: '',
                name
            }, node.value.values.length, 2, regState, varState, utilities);

            const spOffset = varState[name];
            if (spOffset == null) throw `Could not find information about variable ${name}`;
            if (spOffset.type !== 'array_16') throw `Cannot initialize a non-array variable ${name}`;

            const varReg = findRegisterValue(regState, `var-${name}`);

            const statements = node.value.values.flatMap((v, i) => {
                const statements = compileNode(v, regState, varState, utilities);
                const rValueMarker = tempValueMarker(v);
                const rValueRegister = findRegisterValue(regState, rValueMarker);

                releaseRegisterMarker(regState, rValueMarker);

                return [
                    ...statements,
                    Alu('add', 'flags', varReg, { type: 'immediate', value: i * 2 }),
                    Mem('store_16', rValueRegister, 'flags')
                ]
            });

            markRegister(regState, varReg as AssignableRegister, nodeMarker);

            return [
                ...allocation,
                ...statements,
            ];
        }
        case 'index': {
            const indexStatements = compileRValueNode(node.value.parameter, regState, varState, utilities);
            const valueStatements = compileRValueNode(node.value.value, regState, varState, utilities);

            const valueType = utilities.typeGetter(node.value.value);
            const isString = valueType === 'String';

            const valueMarker = tempValueMarker(node.value.value);
            const indexMarker = tempValueMarker(node.value.parameter);

            const valueReg = findRegisterValue(regState, valueMarker);
            const indexReg = findRegisterValue(regState, indexMarker);

            releaseRegisterMarker(regState, valueMarker);
            releaseRegisterMarker(regState, indexMarker);
            const outputReg = reserveRegisterValue(regState, varState, nodeMarker);

            if (isString) {
                 return [
                    ...indexStatements,
                    Alu('add', indexReg, indexReg, { type: 'immediate', value: 2 }),
                    ...valueStatements,
                    Alu('add', valueReg, valueReg, indexReg),
                    Mem('load_8', outputReg, valueReg)
                ];
            } else {
                return [
                    ...indexStatements,
                    Alu('add', indexReg, indexReg, indexReg),
                    Alu('add', indexReg, indexReg, { type: 'immediate', value: 2 }),
                    ...valueStatements,
                    Alu('add', valueReg, valueReg, indexReg),
                    Mem('load_16', outputReg, valueReg)
                ];
            }
        }
        case "string": {
            const name = `string-${id()}`;
            const allocation = allocateArray({
                front: '',
                name
            }, node.value.value.length, 1, regState, varState, utilities);

            const spOffset = varState[name];
            if (spOffset == null) throw `Could not find information about variable ${name}`;
            if (spOffset.type !== 'string') throw `Cannot initialize a non-array variable ${name}`;

            const varReg = findRegisterValue(regState, `var-${name}`);
            const reg = reserveRegisterValue(regState, varState, nodeMarker);

            const statements = node.value.value.split('').flatMap((v, i) => {
                const value = v[0];
                if (!CP850TableMap.has(value)) {
                    throw `Character '${value}' is not available in Code Page 850`;
                }
                const cpValue = CP850TableMap.get(value)!;
                return [
                    Mov('flags', { type: 'immediate', value: cpValue }),
                    Alu('add', reg, varReg, { type: 'immediate', value: i }),
                    Mem('store_8', 'flags', reg)
                ]
            });

            releaseRegisterMarker(regState, nodeMarker);
            markRegister(regState, varReg as AssignableRegister, nodeMarker);

            return [
                ...allocation,
                ...statements
            ];
        }
        case 'dotMethod': {
            throw `Dot methods are currently not supported`
        }
        case 'interpolated': {
            throw `String interpolation is currently not supported`
        }
        case 'ternary': {
            throw `Ternaries are currently not supported`;
        }
        default: {
            const _: never = node.value;
            throw `Unsupported rvalue type: ${JSON.stringify(node.value, null, 2)}`;
        }
    }
}

const compileStatements = (statements: StatementsBlock, regState: RegisterState, varState: VariableState, utilities: CompileUtilities) => {
    const variablesSize = getDeclaredVariableSize(varState);
    const result: InstructionOrBlock[] = [];
    for (const s of statements) {
        result.push(...compileNode(s, regState, varState, utilities));
        if (isRValue(s)) {
            releaseRegisterMarker(regState, tempValueMarker(s))
        }
    }
    const newVariablesSize = getDeclaredVariableSize(varState);
    result.push(...deallocate(varState, newVariablesSize - variablesSize));
    return result;
}

const allocateVariable = (varState: VariableState, name: VariableName, topmost: boolean): Instruction[] => {
    offsetVariableState(varState, 2);
    const varName = name.front + name.name;
    varState[varName] = {
        type: topmost ? 'topmost' : 'declared',
        offset: 0
    };

    if (topmost) {
        return [
            Comment(`Allocating topmost variable ${varName}`),
            Alu('sub', 'sp', 'sp', { type: 'immediate', value: 2 }),
        ];
    } else {
        return [];
    }
}

const allocateArray = (name: VariableName, length: number, bytesPerElement: 1 | 2, regState: RegisterState, varState: VariableState, utilities: CompileUtilities): InstructionOrBlock[] => {
    const varName = name.front + name.name;
    varState[varName] = {
        type: bytesPerElement === 1 ? 'string' : 'array_16',
        size: length * bytesPerElement
    };

    const mallocCall: Token<RValue> = {
        start: -100,
        end: 0,
        value: {
            type: 'function',
            value: utilities.malloc_token,
            parameters: [{
                start: -Math.random(),
                end: -Math.random(),
                value: {
                    type: 'number',
                    value: length * bytesPerElement + 2
                }
            }]
        }
    };
    const malloc = compileRValueNode(mallocCall, regState, varState, utilities);

    const reg = findRegisterValue(regState, tempValueMarker(mallocCall));
    renameMarker(regState, tempValueMarker(mallocCall), variableMarker(varName));

    return [
        Comment(`Allocating ${varState[varName].type} ${varName} of length ${length}, ${bytesPerElement === 1 ? '1 byte' : '2 bytes'} each`),
        ...malloc,
        Alu('add', reg, reg, { type: 'immediate', value: 2 }),
        Mov('flags', { type: 'immediate', value: length }),
        Mem('store_16', 'flags', reg),
        Alu('add', reg, reg, { type: 'immediate', value: 2 })
    ];
}

const allocateEnum = (varState: VariableState, names: string[]) => {
    names.forEach((name, i) => {
        varState[name] = {
            type: 'static',
            value: i
        };
    });
}

const getDeclaredVariableSize = (varState: VariableState): number => {
    // const vars = Object.values(varState);
    // const declaredVars = vars.filter(v => /*v.type === 'declared' ||*/ v.type === 'string' || v.type === 'array_16');
    // return declaredVars
    //     .map(v => v.size)
    //     .reduce((a, b) => a + b, 0);
    return 0;
}

const deallocate = (varState: VariableState, size: number): Instruction[] => {
    for (const v in varState) {
        const type = varState[v].type;
        if (type !== 'static' && type !== 'array_16' && type !== 'string') {
            if (varState[v].offset < size) {
                delete varState[v];
            }
        }
    }
    offsetVariableState(varState, -size);
    if (size === 0) return [];
    return [
        Alu('add', 'sp', 'sp', { type: 'immediate', value: size })
    ];
}

const CP850Table = ' !"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~\bÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜø£Ø×ƒáíóúñÑªº¿®¬½¼¡«»░▒▓│┤ÁÂÀ©╣║╗╝¢¥┐└┴┬├─┼ãÃ╚╔╩╦╠═╬¤ðÐÊËÈıÍÎÙ┘┌█▄¦Ì▀ÓßÔÒõÕµþÞÚÛÙýÝ¯´\u2010±‗¾¶§÷¸°¨·¹³²■\u00a0';

export const CP850TableMap = new Map(CP850Table.split('').map((c, i) => [c, i + 32] as const));

const tryGetStaticValue = (rValue: RValue): number | null => {
    switch (rValue.type) {
        case '_default': return 0;
        case 'dotMethod':
        case 'function':
        case 'index':
        case 'interpolated':
        case 'string':
        case 'ternary':
        case 'variable':
        case 'array':
            return null;
        case 'number':
            return rValue.value;
        case 'cast': {
            if (isIntegerType(rValue.to.value)) {
                return tryGetStaticValue(rValue.value.value);
            } else {
                return null;
            }
        }
        case 'parenthesis':
            return tryGetStaticValue(rValue.value.value);
        case 'binary': {
            const left = tryGetStaticValue(rValue.left.value);
            const right = tryGetStaticValue(rValue.right.value);
            if (left == null || right == null) return null;
            switch (rValue.operator) {
                case '+':
                    return left + right;
                case '-':
                    return left - right;
                case '&':
                    return left & right;
                case '|':
                    return left | right;
                case '^':
                    return left ^ right;
                case '<<':
                    return left << right;
                case '>>':
                    return left >> right;
                case '*':
                    return left * right;
            }
            return null;
        }
        case 'unary': {
            const inner = tryGetStaticValue(rValue.value.value);
            if (inner == null) return null;
            switch (rValue.operator) {
                case '~':
                    return ~inner;
                case '-':
                    return -inner;
            }
            return null;
        }
    }
}