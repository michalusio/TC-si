import { AluInstruction, Immediate, JumpInstruction, MemInstruction, Register, LabelMarker, BlockType } from './types';
import { id } from './utils';

export type Block = ReturnType<typeof Block>;

export type InstructionOrBlock = Instruction | {
        readonly type: 'block',
        readonly id: string,
        readonly blockType: BlockType,
        readonly instructions: InstructionOrBlock[]
    };

export type Instruction =
    ReturnType<typeof Nop> |
    ReturnType<typeof Alu> |
    ReturnType<typeof Cmp> |
    ReturnType<typeof Mov> |
    ReturnType<typeof Neg> |
    ReturnType<typeof Not> |
    ReturnType<typeof Jump> |
    ReturnType<typeof JumpReg> |
    ReturnType<typeof Mem> |
    ReturnType<typeof Push> |
    ReturnType<typeof Pop> |
    ReturnType<typeof Call> |
    ReturnType<typeof Ret> |
    ReturnType<typeof Comment> |
    ReturnType<typeof NewLine> |
    ReturnType<typeof Label> |
    ReturnType<typeof In> |
    ReturnType<typeof Out>;

export const Alu = (instruction: AluInstruction, target: Register, argument1: Register, argument2: Register | Immediate) => ({ type: instruction, target, argument1, argument2 } as const);
export const JumpReg = (address: Register) => ({ type: 'jmp', address } as const);
export const Jump = (type: JumpInstruction, address: Immediate | LabelMarker) => ({ type, address } as const);
export const Mem = (type: MemInstruction, register: Register, address: Register | Immediate) => ({ type, register, address } as const);
export const Push = (register: Register) => ({ type: 'push', register } as const);
export const Pop = (register: Register) => ({ type: 'pop', register } as const);
export const Call = (label: LabelMarker) => ({ type: 'call', label } as const);
export const In = (target: Register) => ({ type: 'in', target } as const);
export const Out = (register: Register) => ({ type: 'out', register } as const);

export const Cmp = (register: Register, argument: Register | Immediate) => ({ type: 'cmp', register, argument } as const);
export const Mov = (target: Register, argument: Register | Immediate) => ({ type: 'mov', target, argument } as const);
export const Neg = (target: Register, argument: Register | Immediate) => ({ type: 'neg', target, argument } as const);
export const Not = (target: Register, argument: Register | Immediate) => ({ type: 'not', target, argument } as const);

export const Ret = () => ({ type: 'ret' } as const);
export const Nop = () => ({ type: 'nop' } as const);

export const Comment = (id: string) => ({ type: 'comment', id } as const);
export const NewLine = () => ({ type: 'newline' } as const);
export const Label = (id: string) => ({ type: 'label', id } as const);

export const Block = (type: BlockType, instructions: InstructionOrBlock[], blockId?: string) => {
    blockId ??= id();
    return {
        type: 'block' as const,
        id: blockId,
        blockType: type,
        instructions: [
            Label(`${type}-start-${blockId}`),
            ...instructions,
            Label(`${type}-end-${blockId}`)
        ]
    };
}

export const isALUInstruction = (instruction: Instruction | undefined): instruction is ReturnType<typeof Alu> => {
    return ['nand', 'or', 'and', 'nor', 'add', 'sub', 'xor', 'lsl', 'lsr', 'mul'].includes(instruction?.type ?? '');
}

export const isJumpInstruction = (instruction: Instruction | undefined): instruction is ReturnType<typeof Jump | typeof JumpReg> => {
    return ['jmp', 'je', 'jne', 'jl', 'jge', 'jle', 'jg', 'jb', 'jae', 'jbe', 'ja'].includes(instruction?.type ?? '');
}

export const swapJump = (i: Instruction): Instruction => {
    if (!isJumpInstruction(i)) return Nop();
    if (typeof i.address === 'string') return Nop();
    const type = (() => {
        switch (i.type) {
            case 'jae': return 'jbe';
            case 'jbe': return 'jae';

            case 'ja': return 'jb';
            case 'jb': return 'ja';

            case 'je': return 'je';
            case 'jne': return 'jne';

            case 'jg': return 'jl';
            case 'jl': return 'jg';

            case 'jge': return 'jle';
            case 'jle': return 'jge';

            case 'jmp': return 'jmp';
        }
    })();
    return {
        type,
        address: i.address
    };
}

export const isTargeting = (instruction: Instruction, reg: Register): boolean => {
    if (isALUInstruction(instruction)) {
        if (instruction.target === reg) return true;
    } else {
        switch (instruction.type) {
            case 'mov':
            case 'neg':
            case 'not':
            case 'in':
                return instruction.target === reg;
            case 'load_16':
            case 'load_8':
            case 'pop':
                return instruction.register === reg;
        }
    }
    return false;
}

export const getTargetingRegister = (instruction: Instruction): Register | null => {
    if (isALUInstruction(instruction)) {
        return instruction.target;
    } else switch (instruction.type) {
        case 'mov':
        case 'neg':
        case 'not':
        case 'in':
            return instruction.target;
        case 'load_16':
        case 'load_8':
        case 'pop':
            return instruction.register;
    }
    return null;
}

export const getUsedRegisters = (instruction: Instruction): Register[] => {
    if (isALUInstruction(instruction)) {
        return [
            instruction.argument1,
            ...(typeof instruction.argument2 === 'string' ? [instruction.argument2] : [])
        ];
    } else switch (instruction.type) {
        case 'mov':
        case 'neg':
        case 'not':
            return typeof instruction.argument === 'string' ? [instruction.argument] : [];
        case 'load_16':
        case 'load_8':
            return typeof instruction.address === 'string' ? [instruction.address] : [];
        case 'store_16':
        case 'store_8':
            return [
                instruction.register,
                ...(typeof instruction.address === 'string' ? [instruction.address] : [])
            ];
        case 'cmp':
            return [
                instruction.register,
                ...(typeof instruction.argument === 'string' ? [instruction.argument] : [])
            ];
        case 'out':
        case 'push':
            return [instruction.register];
        default:
            return [];
    }
}