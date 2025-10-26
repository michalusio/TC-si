import { ParserOutput } from '../parsers/types/ast';
import { Comment, Instruction, InstructionOrBlock } from './instructions';
import { CompilationResult, compileNode, CompileUtilities } from './compilation';
import { optimize, OptLevel, StripLevel } from './optimizer';
import { RegisterState, VariableState } from './types';
import { logLine } from '../storage';

export * from './compilation';
export * from './representation';

type FileMetadata = {
    name: string,
    optimizationLevel: OptLevel,
    stripLevel: StripLevel
};

export function compile(ast: ParserOutput, libAst: ParserOutput, data: FileMetadata, utilities: CompileUtilities): CompilationResult {
    const regState: RegisterState = {
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

    const varState: VariableState = {
        false: {
            type: 'static',
            value: 0
        },
        true: {
            type: 'static',
            value: 1
        }
    };
    try {
        const compiled = compileNode({
            start: 0,
            end: 99999,
            value: {
                type: 'statements',
                statements: [
                    ...ast,
                    ...libAst,
                ]
            }
        }, regState, varState, utilities);
        const codeWithBlocks = [
            Comment(`Symphony assembly of file ${data.name}`),
            ...compiled
        ];
        let code = destructureBlocks(codeWithBlocks);
        code = removeComments(code, data.stripLevel);
        code = optimize(code, data.optimizationLevel, data.stripLevel);
        return {
            type: 'ok',
            value: code
        };
    } catch (e) {
        return {
            type: 'error',
            value: e instanceof Error ? e.message + '\n' + e.stack : (''+e)
        }
    }
}

const destructureBlocks = (stream: InstructionOrBlock[]): Instruction[] => {
    const result: Instruction[] = [];
    stream.forEach(i => {
        if (i.type === 'block') {
            result.push(...destructureBlocks(i.instructions));
        } else result.push(i);
    });
    return result;
}

const removeComments = (stream: Instruction[], stripLevel: StripLevel): Instruction[] => {
    if (stripLevel === 'S0') {
        return stream;
    }
    logLine(`Stripped comments`);
    return stream
        .filter(s => s.type !== 'comment')
        .filter(s => s.type !== 'newline');
}