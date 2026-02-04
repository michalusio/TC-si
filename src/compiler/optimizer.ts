import { logLine } from "../storage";
import { Instruction } from "./instructions";
import * as optimizationsRecord from './optimizations';

type Optimization = (instruction: Instruction, index: number, stream: Instruction[]) => boolean;
export type OptLevel = 'O0' | 'O1' | 'O2';

export const optimize = (instructions: Instruction[], optimizationLevel: OptLevel): Instruction[] => {
    if (optimizationLevel === 'O0') return instructions;

    const instr = [...instructions];
    const optimizations: Optimization[] = Object.values(optimizationsRecord)
        .filter(o => !o.name.startsWith('_'))
        .filter(o => optimizationLevel === 'O2' || !o.name.startsWith('O2'));
    
    let anyChanges = true;
    while (anyChanges) {
        anyChanges = false;
        for (const opt of optimizations) {
            for (let index = instr.length - 1; index >= 0; index--) {
                const instruction = instr[index];
                const result = opt(instruction, index, instr);
                anyChanges ||= result;
                if (result) {
                    logLine(`Applied ${opt.name} on line ${index}`);
                }
            }
            if (anyChanges) break;
        }
    }
    
    return instr;
}

