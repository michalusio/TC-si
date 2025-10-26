import { Token } from "../parsers/types/ast";
import { AssignableRegister, Register, RegisterState, RegisterValueMarker, TempValueMarker, VariableState, VariableValueMarker } from "./types";

export const tempValueMarker = <T>(node: Token<T>): TempValueMarker => {
    return `temp-${node.start}-${node.end}`;
}

export const variableMarker = (varName: string): VariableValueMarker => {
    return `var-${varName}`;
}

export const findRegisterValue = (state: RegisterState, marker: RegisterValueMarker): Register => {
    if (marker === "0") return 'r0';
    for (const reg in state) {
        const register = reg as AssignableRegister;
        if (state[register].includes(marker)) return register;
    }
    throw `Could not find register for ${marker}, current state:\n${JSON.stringify(state, null, 2)}`;
}

export const reserveRegister = (state: RegisterState, register: AssignableRegister, marker: RegisterValueMarker) => {
    state[register] = [marker];
}

export const renameMarker = (state: RegisterState, fromMarker: RegisterValueMarker, toMarker: RegisterValueMarker) => {
    for (const reg in state) {
        const register = reg as AssignableRegister;
        state[register] = state[register].map(m => m === fromMarker ? toMarker : m);
    }
}

export const reserveRegisterValue = (state: RegisterState, varState: VariableState, marker: RegisterValueMarker): Register => {
    if (marker === '0') return 'r0';

    // If some register is already marked, return it
    for (const reg in state) {
        const register = reg as AssignableRegister;
        if (state[register].includes(marker)) return register;
    }

    // If there is an empty register, return it
    for (const reg in state) {
        const register = reg as AssignableRegister;
        if (state[register].includes('0')) {
            state[register] = [marker];
            return register;
        }
    }

    // Finally, if some register stores only a static value (not used as a temp), return it
    for (const reg in state) {
        const register = reg as AssignableRegister;
        if (state[register].length === 1 && state[register][0].startsWith('var-')) {
            const marker = state[register][0];
            const varName = marker.slice(4);
            if (varState[varName]?.type === 'static') {
                state[register] = [marker];
                return register;
            }
        }
    }
    
    throw `Could not reserve register for ${marker}`;
}

export const findVariableRegister = (state: RegisterState, varName: string): AssignableRegister | null => {
    const marker = variableMarker(varName);
    for (const reg in state) {
        const register = reg as AssignableRegister;
        if (state[register].includes(marker)) return register;
    }
    return null;
}

export const markRegister = (state: RegisterState, reg: AssignableRegister, marker: TempValueMarker) => {
    if (!state[reg].includes(marker)) {
        state[reg].push(marker);
    }
}

export const releaseRegister = (state: RegisterState, register: AssignableRegister) => {
    state[register] = ['0'];
}

export const releaseRegisterMarker = (state: RegisterState, marker: RegisterValueMarker) => {
    if (marker === '0') return;
    for (const reg in state) {
        const register = reg as AssignableRegister;
        state[register] = state[register].filter(m => m !== marker);
        if (state[register].length === 0) {
            state[register] = ['0'];
        }
    }
}

export const freeVariableRegisters = (state: RegisterState) => {
    for (const reg in state) {
        const register = reg as AssignableRegister;
        state[register] = state[register].filter(s => !s.startsWith('var-'));
        if (state[register].length === 0) {
            state[register] = ['0'];
        }
    }
}

export const combineRegisterState = (state: RegisterState, states: RegisterState[]) => {
    if (states.length === 0) return;
    for (const reg in state) {
        const register = reg as AssignableRegister;
        state[register] = Array.from(
            states
                .map(s => new Set(s[register]))
                .reduce((current, next) => {
                    current.forEach(c => {
                        if (!next.has(c)) {
                            current.delete(c);
                        }
                    });
                    return current;
                })
        );
    }
    for (const reg in state) {
        const register = reg as AssignableRegister;
        if (state[register].length === 0) {
            state[register] = ['0'];
        }
    }
}

export const offsetVariableState = (state: VariableState, offset: number) => {
    for (const v in state) {
        if (state[v].type !== 'static') {
            state[v].offset += offset;
        }
    }
}

export const copyVariableState = (state: VariableState): VariableState => {
    const result: VariableState = {};
    for (const v in state) {
        if (state[v].type === 'static') {
            result[v] = state[v];
        }
    }
    return result;
}