import { CompilationResult } from "./compilation";
import { Instruction } from "./instructions";
import { Immediate, LabelMarker, Register } from "./types";

export const getTextRepresentation = (compilation: CompilationResult): string => {
    if (compilation.type === 'error') return compilation.value;

    let result = renderInstructions(compilation.value);
    return result;
}

export const renderInstructions = (instructions: Instruction[]): string => {
    let result = '';
    instructions.forEach(i => {
        result += renderTab(i);
        result += renderInstruction(i);
        result += '\n';
    });
    return result;
}

const render = (value: Register | Immediate | LabelMarker): string => {
    if (typeof value === 'string') return value;
    if (value.type === 'immediate') return value.value.toFixed(0);
    return value.value;
}

const renderTab = (i: Instruction): string => {
    switch (i.type) {
        case 'label':
        case 'comment':
        case 'newline':
            return '';
        default: return '\t';
    }
}

export const renderInstruction = (i: Instruction): string => {
    switch (i.type) {
        case 'newline': return '';
        case 'label': return `${i.id}:`;
        case 'nop': return 'nop';
        case 'ret': return 'ret';
        case 'cmp': return `cmp ${render(i.register)}, ${render(i.argument)}`;
        case 'call': return `call ${render(i.label)}`;
        case 'comment': return `// ${i.id}`;
        case 'pop': return `pop ${render(i.register)}`;
        case 'push': return `push ${render(i.register)}`;
        case 'mov':
        case 'neg':
        case 'not':
            return `${i.type} ${render(i.target)}, ${render(i.argument)}`;
        case 'in':
            return `${i.type} ${render(i.target)}`;
        case 'out':
            return `${i.type} ${render(i.register)}`;
        case 'add':
        case 'sub':
        case 'and':
        case 'or':
        case 'nand':
        case 'nor':
        case 'xor':
        case 'mul':
        case 'lsl':
        case 'lsr':
            return `${i.type} ${render(i.target)}, ${render(i.argument1)}, ${render(i.argument2)}`;
        case 'load_16':
        case 'load_8':
            return `${i.type} ${render(i.register)}, [${render(i.address)}]`;
        case 'store_16':
        case 'store_8':
            return `${i.type} [${render(i.address)}], ${render(i.register)}`;
        case 'ja':
        case 'jae':
        case 'jb':
        case 'jbe':
        case 'je':
        case 'jg':
        case 'jge':
        case 'jl':
        case 'jle':
        case 'jmp':
        case 'jne':
            return `${i.type} ${render(i.address)}`;
    }
}