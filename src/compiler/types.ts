export type Register = 'r0' | 'r1' | 'r2' | 'r3' | 'r4' | 'r5' | 'r6' | 'r7' | 'r8' | 'r9' | 'r10' | 'r11' | 'r12' | 'r13' | 'sp' | 'flags';
export type Immediate = { type: 'immediate', value: number };
export type LabelMarker = { type: 'label', value: string };

export type AssignableRegister = Exclude<Register, 'r0' | 'sp' | 'flags'>;
export type RegisterState = Record<AssignableRegister, RegisterValueMarker[]>;
export type RegisterValueMarker = TempValueMarker | VariableValueMarker | ZeroValueMarker;
export type ZeroValueMarker = '0';
export type TempValueMarker = `temp-${number}-${number}`;
export type VariableValueMarker = `var-${string}`;

export type AluInstruction = 'nand' | 'or' | 'and' | 'nor' | 'add' | 'sub' | 'xor' | 'lsl' | 'lsr' | 'mul';
export type JumpInstruction = 'jmp' | 'je' | 'jne' | 'jl' | 'jge' | 'jle' | 'jg' | 'jb' | 'jae' | 'jbe' | 'ja';
export type MemInstruction = 'load_8' | 'store_8' | 'load_16' | 'store_16';
export type BlockType = 'pub-function' | 'function' | 'if' | 'while' | 'switch' | 'block';

export type Variable = {
    type: 'argument',
    offset: number
} | {
    type: 'declared',
    offset: number,
} | {
    type: 'static',
    value: number
} | {
    type: 'array_8',
    offset: number,
    size: number
} | {
    type: 'array_16',
    offset: number,
    size: number
}
export type VariableState = Record<string, Variable>;