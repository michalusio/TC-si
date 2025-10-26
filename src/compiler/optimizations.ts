import { logLine } from "../storage";
import { Instruction, swapJump, isALUInstruction, isJumpInstruction, isTargeting, Jump, Mov, Label, getTargetingRegister } from "./instructions";
import { StripLevel } from "./optimizer";
import { AluInstruction, Immediate, Register } from "./types";
import { id } from "./utils";

/**
 * If we have a MOV for the same register:
 * ```
 * MOV r2, r2
 * ```
 * We can remove it
 */
export const O1_optimizeMovToSameRegister = (instruction: Instruction, index: number, stream: Instruction[]): boolean => {
    if (instruction.type === 'mov') {
        if (instruction.target === instruction.argument) {
            stream.splice(index, 1);
            return true;
        }
    }
    return false;
}

/**
 * If we have an ALU operation targeting r0:
 * ```
 * MOV r0, r1
 * ADD r0, r2, r4
 * ```
 * We can remove it
 */
export const O1_optimizeTargetingZeroRegister = (instruction: Instruction, index: number, stream: Instruction[]): boolean => {
    if (isALUInstruction(instruction)) {
        if (instruction.target === 'r0') {
            stream.splice(index, 1);
            return true;
        }
    }
    if (instruction.type === 'mov' || instruction.type === 'neg' || instruction.type === 'not') {
        if (instruction.target === 'r0') {
            stream.splice(index, 1);
            return true;
        }
    }
    if (instruction.type === 'pop') {
        if (instruction.register === 'r0') {
            stream.splice(index, 1);
            return true;
        }
    }
    return false;
}

/**
 * If we have a condition jump sequence:
 * ```
 * cmp r1, r2
 * and r1, flags, 1
 * cmp r1, r0
 * je if-else-BJEx
 * ```
 * We can optimize the checks and the branch like this:
 * ```
 * cmp r1, r2
 * je if-else-BJEx
 * ```
 */
export const O1_optimizeConditionJumps = (instruction: Instruction, index: number, stream: Instruction[]): boolean => {
    if (instruction.type !== 'cmp') return false;
    const n_and = stream[index + 1];
    const second_cmp = stream[index + 2];
    const cond_jump = stream[index + 3];
    if (n_and?.type !== 'and' && n_and?.type !== 'nand') return false;
    if (second_cmp?.type !== 'cmp') return false;
    if (cond_jump?.type !== 'je') return false;
    if (second_cmp.argument !== n_and.target || second_cmp.register !== 'r0') return false;
    if (n_and.argument1 !== 'flags' || typeof n_and.argument2 === 'string') return false;

    const invert = instruction.register !== n_and.argument1;

    if (n_and.type === 'and') {
        if (n_and.argument2.value === 1) {
            stream.splice(index + 1, 2);
            stream[index + 1] = {
                type: 'jne',
                address: cond_jump.address
            }
            return true;
        } else if (n_and.argument2.value === 4) {
            stream.splice(index + 1, 2);
            stream[index + 1] = {
                type: invert ? 'jge' : 'jl',
                address: cond_jump.address
            }
            return true;
        }
    } else {
        if (n_and.argument2.value === 1) {
            stream.splice(index + 1, 2);
            return true;
        } else if (n_and.argument2.value === 4) {
            stream.splice(index + 1, 2);
            stream[index + 1] = {
                type: invert ? 'jl' : 'jge',
                address: cond_jump.address
            }
            return true;
        }
    }
    return false;
}

/**
 * If we have a label that is unused, we can remove it
 */
export const O1_optimizeUnusedLabels = (instruction: Instruction, index: number, stream: Instruction[]): boolean => {
    if (instruction.type === 'label') {
        const label = instruction.id;
        if (label.startsWith('function-') || label.startsWith('pub-function-')) {
            return false;
        }
        if (!isLabelUsed(stream, label)) {
            stream.splice(index, 1);
            return true;
        }
    }
    return false;
}

/**
 * If we have an ALU operation that doesn't change the target:
 * ```
 * ADD r1, r1, 0
 * ADD r1, r1, r0
 * MUL r1, r1, 1
 * OR r1 r1, 0
 * ```
 * We can remove it
 */
export const O1_optimizeNilpotentAlu = (instruction: Instruction, index: number, stream: Instruction[]): boolean => {
    switch (instruction.type) {
        case 'add':
        case 'sub':
        case 'lsl':
        case 'lsr':
        case 'or':
        case 'xor':
            if (instruction.target == instruction.argument1) {
                if (instruction.argument2 === 'r0' || (typeof instruction.argument2 !== 'string' && instruction.argument2.value === 0)) {
                    stream.splice(index, 1);
                    return true;
                }
            }
            break;
        case 'mul':
            if (instruction.target == instruction.argument1) {
                if (typeof instruction.argument2 !== 'string' && instruction.argument2.value === 1) {
                    stream.splice(index, 1);
                    return true;
                }
            }
            break;
    }
    return false;
}

/**
 * If we have an instruction taking r0 or 0 as the second argument:
 * ```
 * ADD r1, r2, 0
 * OR r3, r4, r0
 * ```
 * We can change them into a MOV:
 * ```
 * MOV r1, r2
 * MOV r3, r4
 * ```
 */
export const O1_optimizeZeroAlu = (instruction: Instruction, index: number, stream: Instruction[]): boolean => {
    switch (instruction.type) {
        case 'add':
        case 'sub':
        case 'or':
        case 'xor':
        case 'lsl':
        case 'lsr':
            if (instruction.argument2 === 'r0' || (typeof instruction.argument2 !== 'string' && instruction.argument2.value === 0)) {
                stream[index] = {
                    type: 'mov',
                    target: instruction.target,
                    argument: instruction.argument1
                }
                return true;
            }
            break;
    }
    return false;
}

/**
 * If we have a cmp instruction comparing r0 to a constant, then a jump:
 * ```
 * CMP r0, 1
 * JE label
 * ```
 * We can calculate the result and either remove the jump, or change it into a JMP
 */
export const O1_optimizeConstantJumps = (instruction: Instruction, index: number, stream: Instruction[]): boolean => {
    if (instruction.type !== 'cmp') return false;
    if (instruction.register !== 'r0') return false;
    if (typeof instruction.argument === 'string' && instruction.argument !== 'r0') return false;

    const next = stream[index + 1];
    if (!isJumpInstruction(next) || next.type === 'jmp') return false;

    const value = instruction.argument === 'r0'
        ? 0
        : instruction.argument.value;
    
    const flags = {
        equal: value === 0,
        less: 0 < value,
    };
    const check = (() => {
        switch (next.type) {
            case 'je':
                return () => flags.equal;
            case 'jge':
                return () => !flags.less;
            case 'jl':
                return () => flags.less;
            default:
                return false;
        }
    })();
    if (!check) {
        return false;
    }
    if (check()) {
        stream[index] = Jump('jmp', next.address);
        stream.splice(index + 1, 1);
    } else {
        stream.splice(index, 2);
    }
    return true;
}

/**
 * If there is an ALU instruction which has a mov next, then that mov should be sorted higher, if it doesn't break the dependency
 */
export const O1_sortMovs = (instruction: Instruction, index: number, stream: Instruction[]): boolean => {
    if (!isALUInstruction(instruction)) return false;
    const next = stream[index + 1];
    if (next?.type === 'mov' && next.target !== instruction.argument1 && next.target !== instruction.argument2) {
        stream[index] = next;
        stream[index + 1] = instruction;
        return true;
    }
    return false;
}

/**
 * Functions which are not called anywhere (except main) can be removed
 */
export const O1_optimizeUnusedFunctions = (instruction: Instruction, index: number, stream: Instruction[], stripLevel: StripLevel): boolean => {
    if (instruction.type !== 'label') return false;
    const id = instruction.id;
    switch (stripLevel) {
        case 'S0':
        case 'S1':
            if (!id.startsWith('function-start-')) return false;
            break;
        case 'S2':
            if (!id.startsWith('function-start-') && !id.startsWith('pub-function-start-')) return false;
            if (id === 'pub-function-start-main') return false;
            break;
    }

    if (!isLabelUsed(stream, id)) {
        const endId = id.replace('function-start-', 'function-end-');
        const endLabelIndex = stream.findIndex((instr, i) => i > index && instr.type === 'label' && instr.id === endId);
        stream.splice(index, endLabelIndex - index + 1);
        return true;
    }
    return false;
}

/**
 * If we have a jump instruction going to a label, but there's no label between them:
 * ```
 * JMP label
 * MOV r2, r3
 * ADD r4, r2, 12
 * label:
 * ```
 * We can remove the jump and the instructions
 */
export const O2_optimizeJumpForward = (instruction: Instruction, index: number, stream: Instruction[]): boolean => {
    if (!isJumpInstruction(instruction)) return false;
    if (typeof instruction.address === 'string' || instruction.address.type === 'immediate') return false;
    for (let i = index + 1; i < stream.length; i++) {
        const next = stream[index + 1];
        if (next?.type === 'label') {
            if (next.id === instruction.address.value) {
                stream.splice(index, i - index);
                return true;
            } else {
                return false;
            }
        }
    }
    return false;
}

/**
 * If we have a constant load and then operations using that register as the second argument:
 * ```
 * MOV r2, 0
 * OR r4, r3, r2
 * ```
 * We can replace the register with a value:
 * ```
 * OR r4, r3, 0
 * ```
 */
export const O2_optimizeConstantPropagation = (instruction: Instruction, index: number, stream: Instruction[]): boolean => {
    if (instruction.type !== 'mov') return false;
    if (typeof instruction.argument === 'string') return false;

    const toReplace: [Instruction, number][] = [];
    if (!follow(index, instruction)) return false;
    if (!toReplace.length) return false;

    let replaced = false;
    for (let [next, i] of toReplace) {
        if (isALUInstruction(next)) {
            if (next.argument2 === instruction.target) {
                const newI = {
                    ...next,
                    argument2: instruction.argument
                };
                stream[i] = newI;
                next = newI;
                replaced = true;
            }
            if (next.type !== 'sub' && next.type !== 'lsl' && next.type !== 'lsr' && next.argument1 === instruction.target) {
                if (typeof next.argument2 === 'string') {
                    const newI: typeof next = {
                        ...next,
                        argument1: next.argument2,
                        argument2: instruction.argument
                    };
                    stream[i] = newI;
                    next = newI;
                    replaced = true;
                } else {
                    const newI = Mov(next.target, {
                        type: 'immediate',
                        value: precalculate(next.type, next.argument2, instruction.argument)
                    });
                    stream[i] = newI;
                    next = newI;
                    replaced = true;
                }
            }
        } else if (next.type === 'store_16' || next.type === 'store_8' || next.type === 'load_16' || next.type === 'load_8') {
            if (next.address === instruction.target) {
                const newI = {
                    ...next,
                    address: instruction.argument
                };
                stream[i] = newI;
                replaced = true;
            }
        } else if (next.type === 'cmp') {
            if (next.argument === instruction.target) {
                const newI = {
                    ...next,
                    argument: instruction.argument
                };
                stream[i] = newI;
                replaced = true;
            } else if (next.register === instruction.target && typeof next.argument === 'string') {
                const nextest = stream[i + 1];
                if (isJumpInstruction(nextest)) {
                    const inverse = swapJump(nextest);
                    const newI = {
                        ...next,
                        register: next.argument,
                        argument: instruction.argument
                    };
                    stream[i] = newI;
                    stream[i + 1] = inverse;
                    replaced = true;
                }
                
            }
        } else if (next.type === 'mov' || next.type === 'neg' || next.type === 'not') {
            if (next.argument === instruction.target) {
                const newI = {
                    ...next,
                    argument: instruction.argument
                };
                stream[i] = newI;
                replaced = true;
            }
        }
    }
    if (instruction.target !== 'r1' || toReplace.every(i => i[0].type !== 'ret')) {
        stream.splice(index, 1);
        replaced = true;
    }
    return replaced;

    function follow(index: number, instruction: {
        readonly type: "mov";
        readonly target: Register;
        readonly argument: Register | Immediate;
    }): boolean {
        for (let i = index + 1; i < stream.length; i++) {
            const next = stream[i];
            if (isJumpInstruction(next)) {
                const nextest = stream[i + 1];
                if (nextest && isTargeting(nextest, instruction.target)) {
                    break;
                }
                return false;
            } else {
                // When encountering a label, we cannot replace anything as the register may come from another branch too
                if (next.type === 'label') return false;
                if (next.type === 'call') return false;

                // if the first argument of a SUB/LSL/LSR is the register, we cannot replace anything
                if ((next.type === 'sub' || next.type === 'lsl' || next.type === 'lsr') && next.argument1 === instruction.target) {
                    return false;
                }
                // if the second argument of a STORE_16/8 is the register, we cannot replace anything
                if ((next.type === 'store_16' || next.type === 'store_8') && next.register === instruction.target) {
                    return false;
                }
                // if the first argument is the register,
                // we can replace it only if there's a jump next to it that we can invert
                if (next.type === 'cmp' && next.register === instruction.target) {
                    if (typeof next.argument !== 'string') return false;
                    const nextest = stream[i + 1];
                    if (!isJumpInstruction(nextest)) return false;
                }
                // if the argument is the register, we cannot replace anything
                if (next.type === 'push' && next.register === instruction.target) {
                    return false;
                }
            }
            toReplace.push([next, i]);
            if (isTargeting(next, instruction.target)) {
                break;
            }
            if (next.type === 'ret') {
                break;
            }
        }
        return true;
    }
}

/**
 * If we have a register load and then operations using that register as the second argument:
 * ```
 * MOV r2, sp
 * OR r4, r3, r2
 * ```
 * We can replace the register with a loaded register:
 * ```
 * OR r4, r3, sp
 * ```
 */
export const O2_optimizeRegisterPropagation = (instruction: Instruction, index: number, stream: Instruction[]): boolean => {
    if (instruction.type !== 'mov') return false;
    if (typeof instruction.argument !== 'string') return false;
    if (instruction.argument === 'r0') {
        stream[index] = {
            ...instruction,
            argument: { type: 'immediate', value: 0 }
        }
        // The rest is done by constant propagation
        return true;
    }

    const toReplace: [Instruction, number][] = [];
    if (!follow(index, {
        type: instruction.type,
        target: instruction.target,
        argument: instruction.argument
     })) return false;
    if (!toReplace.length) return false;

    let replaced = false;
    for (let [next, i] of toReplace) {
        if (isALUInstruction(next)) {
            if (next.argument2 === instruction.target) {
                const newI = {
                    ...next,
                    argument2: instruction.argument
                };
                stream[i] = newI;
                next = newI;
                replaced = true;
            }
            if (next.argument1 === instruction.target) {
                const newI = {
                    ...next,
                    argument1: instruction.argument
                };
                stream[i] = newI;
                next = newI;
                replaced = true;
            }
        } else if (next.type === 'store_16' || next.type === 'store_8' || next.type === 'load_16' || next.type === 'load_8') {
            if (next.address === instruction.target) {
                const newI = {
                    ...next,
                    address: instruction.argument
                };
                stream[i] = newI;
                replaced = true;
            }
        } else if (next.type === 'cmp') {
            if (next.argument === instruction.target) {
                const newI = {
                    ...next,
                    argument: instruction.argument
                };
                stream[i] = newI;
                next = newI;
                replaced = true;
            }
            if (next.register === instruction.target) {
                const newI = {
                    ...next,
                    register: instruction.argument
                };
                stream[i] = newI;
                next = newI;
                replaced = true;
            }
        } else if (next.type === 'mov' || next.type === 'neg' || next.type === 'not') {
            if (next.argument === instruction.target) {
                const newI = {
                    ...next,
                    argument: instruction.argument
                };
                stream[i] = newI;
                replaced = true;
            }
        } else if (next.type === 'push') {
            if (next.register === instruction.target) {
                const newI = {
                    ...next,
                    register: instruction.argument
                };
                stream[i] = newI;
                replaced = true;
            }
        } else if (next.type === 'out') {
            if (next.register === instruction.target) {
                const newI = {
                    ...next,
                    register: instruction.argument
                };
                stream[i] = newI;
                replaced = true;
            }
        }
    }
    if (instruction.target !== 'r1' || toReplace.every(i => i[0].type !== 'ret')) {
        stream.splice(index, 1);
        replaced = true;
    }
    return replaced;

    function follow(index: number, instruction: {
        readonly type: "mov";
        readonly target: Register;
        readonly argument: Register;
    }): boolean {
        for (let i = index + 1; i < stream.length; i++) {
            const next = stream[i];
            if (isJumpInstruction(next)) {
                const nextest = stream[i + 1];
                if (nextest && isTargeting(nextest, instruction.target)) {
                    break;
                }
                return false;
            } else {
                // When encountering a label, we cannot replace anything as the register may come from another branch too
                if (next.type === 'label') return false;
                if (next.type === 'call') return false;

                if (isTargeting(next, instruction.argument)) {
                    return false;
                }
            }
            toReplace.push([next, i]);
            if (isTargeting(next, instruction.target)) {
                break;
            }
            if (next.type === 'ret') {
                break;
            }
        }
        return true;
    }
}

/**
 * If we have an ALU operation and a MOV immediately after it using the ALU's target:
 * ```
 * ADD r4, r2, 1
 * MOV r2, r4
 * ```
 * We can replace it with just the ADD retargeted
 */
export const O2_optimizeMovAfterAlu = (instruction: Instruction, index: number, stream: Instruction[]): boolean => {
    if (!isALUInstruction(instruction)) return false;
    const next = stream[index + 1];
    if (next?.type !== 'mov') return false;

    if (instruction.target === next.argument) {
        stream[index] = {
            ...instruction,
            target: next.target
        };
        stream.splice(index + 1, 1);
        return true;
    }
    return false;
}

/**
 * If we have a sequence:
 * ```
 * PUSH r1
 * ...
 * ...
 * POP r2
 * ```
 * We can replace it with:
 * ```
 * MOV r2, r1
 * ```
 * If the pushed register is not replaced by anything in the meantime
 */
export const O2_optimizePushAndPopToDifferentRegisters = (instruction: Instruction, index: number, stream: Instruction[]): boolean => {
    if (instruction.type !== 'push') return false;
    let level = 0;
    const overriden = new Set<Register>();
    for (let i = index + 1; i < stream.length; i++) {
        const next = stream[i];
        switch (next.type) {
            case 'push':
                level++;
                break;
            case 'call': return false;
            case 'pop':
                if (level === 0) {
                    if (overriden.has(next.register)) return false;
                    stream.splice(index, 1, Mov(next.register, instruction.register));
                    stream.splice(i, 1);
                    return true;
                } else {
                    level--;
                    overriden.add(next.register);
                }
                break;
            default: {
                const r = getTargetingRegister(next);
                if (r != null) {
                    overriden.add(r);
                }
                break;
            }
        }
    }
    return false;
}

/**
 * If we have a label between two idempotent operations:
 * ```
 * MOV r0, r1
 * label:
 * MOV r0, r1
 * ```
 * We can remove the topmost instruction
 */
export const O2_optimizeLabelBetweenIdempotentOperations = (instruction: Instruction, index: number, stream: Instruction[]): boolean => {
    if (instruction.type === 'label') {
        const previous = stream[index - 1];
        const next = stream[index + 1];
        if (previous && next) {
            if (previous.type === 'nop' || (previous.type === 'ret' && next.type === 'ret')) {
                stream.splice(index - 1, 1);
                return true;
            }
        }
    }
    return false;
}

/**
 * If we have instruction after a ret of jmp:
 * ```
 * RET
 * MOV r0, r1
 * ADD r1, r2, r3
 * ```
 * We can remove all the operations after RET, until we encounter a label or a comment
 */
export const O2_optimizeUnreachableOperations = (instruction: Instruction, index: number, stream: Instruction[]): boolean => {
    if (instruction.type === 'ret' || instruction.type === 'jmp') {
        const willModify = stream[index + 1] && stream[index + 1].type != 'label' && stream[index + 1].type != 'comment';
        while (stream[index + 1] && stream[index + 1].type != 'label' && stream[index + 1].type != 'comment') {
            stream.splice(index + 1, 1);
        }
        return willModify;
    }
    return false;
}

/**
 * If we have two ALU operations which can be joined together:
 * ```
 * ADD r1, r3, 2
 * ADD r1, r1, 5
 * ```
 * We can replace them:
 * ```
 * ADD r1, r3, 7
 * ```
 */
export const O2_optimizeRepeatedAlu = (instruction: Instruction, index: number, stream: Instruction[]): boolean => {
    const next = stream[index + 1];
    switch (instruction.type) {
        case 'add':
        case 'sub':
        {
            if (typeof instruction.argument2 === 'string') break;
            if (next?.type === 'add' || next?.type === 'sub') {
                if (next.target !== instruction.target) break;
                if (next.target !== next.argument1) break;
                if (typeof next.argument2 === 'string') break;

                let value = (instruction.type === 'add'
                    ? instruction.argument2.value
                    : -instruction.argument2.value
                ) + (next.type === 'add'
                    ? next.argument2.value
                    : -next.argument2.value
                );
                
                stream.splice(index + 1, 1);

                if (value > 0) {
                    stream[index] = {
                        type: 'add',
                        target: next.target,
                        argument1: instruction.argument1,
                        argument2: {
                            type: 'immediate',
                            value
                        }
                    }
                } else if (value < 0) {
                    stream[index] = {
                        type: 'sub',
                        target: next.target,
                        argument1: instruction.argument1,
                        argument2: {
                            type: 'immediate',
                            value: -value
                        }
                    }
                } else {
                    stream.splice(index, 1);
                }
                return true;
            }
            break;
        }
    }
    return false;
}

/**
 * If a function is small enough, then it might be inlined in places which use it
 */
export const O2_inlineFunctions = (instruction: Instruction, index: number, stream: Instruction[]): boolean => {
    if (instruction.type !== 'call') return false;

    const fn = getFunction(stream, instruction.label.value);
    if (fn) {
        const len = fn[1] - fn[0] - 1;
        // If the function is under 6 instructions, we can inline it
        if (len <= 6) {
            const retLabel = `inline-end-${id()}`;
            const code = stream.slice(fn[0] + 1, fn[1]);
            code.forEach((ins, codeIndex) => {
                if (ins.type === 'ret') {
                    code[codeIndex] = Jump('jmp', { type: 'label', value: retLabel });
                }
            });
            stream.splice(index, 1, ...[
                ...code,
                Label(retLabel)
            ]);
            return true;
        }
    }
    return false;
}

function precalculate(type: AluInstruction, value1: Immediate, value2: Immediate): number {
    switch (type) {
        case 'add':
            return (value1.value + value2.value) & 65535;
        case 'sub':
            return (value1.value - value2.value) & 65535;
        case 'and':
            return (value1.value & value2.value) & 65535;
        case 'lsl':
            return (value1.value << value2.value) & 65535;
        case 'lsr':
            return (value1.value >> value2.value) & 65535;
        case 'mul':
            return (value1.value * value2.value) & 65535;
        case 'nand':
            return (~(value1.value & value2.value)) & 65535;
        case 'nor':
            return (~(value1.value | value2.value)) & 65535;
        case 'or':
            return (value1.value | value2.value) & 65535;
        case 'xor':
            return (value1.value ^ value2.value) & 65535;
    }
}

function isLabelUsed(stream: Instruction[], label: string): boolean {
    return stream.some(s => {
        if (isJumpInstruction(s)) {
            if (typeof s.address !== 'string' && s.address.type === 'label' && s.address.value === label) return true;
        }
        if (s.type === 'call' && s.label.value === label) return true;
        return false;
    })
}

function getFunction(stream: Instruction[], name: string): [number, number] | null {
    let starter = '';
    let ender = '';
    if (name.startsWith('pub-function-start-')) {
        starter = 'pub-function-start-';
        ender = 'pub-function-end-';
        name = name.slice(starter.length);
    }
    if (name.startsWith('function-start-')) {
        starter = 'function-start-';
        ender = 'function-end-';
        name = name.slice(starter.length);
    }
    for (let index = 0; index < stream.length; index++) {
        const start = stream[index];
        if (start.type === 'label' && start.id === `${starter}${name}`) {
            for (let index2 = index + 1; index2 < stream.length; index2++) {
                const end = stream[index2];
                if (end.type === 'label' && end.id === `${ender}${name}`) {
                    return [index, index2];
                }
            }
            return null;
        }
    }
    return null;
}