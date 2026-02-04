import { FunctionDeclaration, ParserOutput, StatementsBlock } from '../parsers/types/ast';
import { Comment, Instruction, InstructionOrBlock } from './instructions';
import { CompilationResult, compileNode, CompileUtilities } from './compilation';
import { optimize, OptLevel } from './optimizer';
import { RegisterState, VariableState } from './types';
import { logLine } from '../storage';
import { addRcHandling } from './rc';
import { Token } from 'parser-combinators';

export * from './compilation';
export * from './representation';

type FileMetadata = {
    name: string,
    librariesEndLineOffset: number,
    optimizationLevel: OptLevel,
    stripDebugSymbols: boolean
};

export function compile(ast: ParserOutput, data: FileMetadata, utilities: Omit<CompileUtilities, 'malloc_token' | 'increment_rc_token' | 'decrement_rc_token'>): CompilationResult {
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
        ast = stripPublicModifiers(ast, data.librariesEndLineOffset);

        const declarationTokens = ast
            .filter((s): s is Token<FunctionDeclaration> => s.value.type === 'function-declaration')
            .map(s => s.value.definition.name);

        const decrement_rc_token = declarationTokens.find(s => s.value === 'decrement_rc');
        if (!decrement_rc_token) {
            throw `Cannot find function "decrement_rc" in the system library`;
        }

        const increment_rc_token = declarationTokens.find(s => s.value === 'increment_rc');
        if (!increment_rc_token) {
            throw `Cannot find function "increment_rc" in the system library`;
        }

        const malloc_token = declarationTokens.find(s => s.value === 'malloc');
        if (!malloc_token) {
            throw `Cannot find function "malloc" in the system library`;
        }

        ast = addRcHandling(ast, utilities.typeGetter, decrement_rc_token);

        const compiled = compileNode({
            start: 0,
            end: 99999,
            value: {
                type: 'statements',
                statements: ast
            }
        }, regState, varState, {
            ...utilities,
            malloc_token,
            increment_rc_token,
            decrement_rc_token
        });
        const codeWithBlocks = [
            Comment(`Symphony assembly of file ${data.name}`),
            ...compiled
        ];
        let code = destructureBlocks(codeWithBlocks);
        if (data.stripDebugSymbols) {
            code = removeComments(code);
        }
        code = optimize(code, data.optimizationLevel);
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

const removeComments = (stream: Instruction[]): Instruction[] => {
    logLine(`Stripped comments`);
    return stream
        .filter(s => s.type !== 'comment')
        .filter(s => s.type !== 'newline');
}

const stripPublicModifiers = (ast: StatementsBlock, librariesEndLineOffset: number): StatementsBlock => {
    return ast.map(s => {
        if (s.value.type === 'function-declaration') {
            return {
                ...s,
                value: {
                    ...s.value,
                    definition: {
                        ...s.value.definition,
                        public: s.start < librariesEndLineOffset ? false : s.value.definition.public
                    }
                }
            }
        } else {
            return s;
        }
    });
}
