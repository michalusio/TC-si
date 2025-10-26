import type {
  Environment,
  EnvironmentFunction,
  EnvironmentOperator,
  EnvironmentType,
  EnvironmentVariable,
} from "./environment";
import { levenshtein } from "./levenshtein";
import { FunctionDefinition, Parameter, TokenRange, TypeDefinition } from "./parsers/types/ast";
import { baseEnvironment } from "./storage";

/**
 * Converts from [] notation to * notation
 */
export const typeStringToTypeToken = (value: string): string => {
  let numberOfArrays = 0;
  for (let index = 0; index < value.length; index++) {
    const char = value[index];
    if (char === '[') {
      numberOfArrays++;
    } else break;
  }
  return `${'*'.repeat(numberOfArrays)}${value.slice(numberOfArrays, value.length - numberOfArrays)}`;
}

/**
 * Converts from * notation to [] notation
 */
export const typeTokenToTypeString = (value: string): string => {
  let numberOfArrays = 0;
  for (let index = 0; index < value.length; index++) {
    const char = value[index];
    if (char === '*') {
      numberOfArrays++;
    } else break;
  }
  return `${'['.repeat(numberOfArrays)}${value.slice(numberOfArrays)}${']'.repeat(numberOfArrays)}`;
}

export const composeTypeDefinition = (definition: TypeDefinition): string => {
  if (Array.isArray(definition.definition.value)) {
    return `${definition.public ? 'pub ' : ''}type ${definition.name.value} <${definition.definition.value.join(', ')}>`;
  }
  return `${definition.public ? 'pub ' : ''}type ${definition.name.value} ${definition.definition.value}`;
}

export const composeFunctionDefinition = (definition: FunctionDefinition, params: string[]): string => {
  return `${definition.public ? 'pub ' : ''}${definition.kind} ${definition.name.value}(${definition.parameters.map((p, i) => `${p.name.value.front}${p.name.value.name}: ${typeTokenToTypeString(params[i])}`).join(', ')}) ${definition.returnType.value ?? ''}`.trim();
}

export const tryGetVariable = (
  inScope: boolean,
  environments: Environment[],
  name: string
): EnvironmentVariable | null => {
  for (let index = environments.length - 1; index >= 1; index--) {
    const type = environments[index].type;
    const variable = environments[index].variables.get(name);
    if (variable === undefined) {
      if (inScope && type === "function") {
        break;
      }
      continue;
    }
    return variable;
  }
  for (let index = environments.length - 1; index >= 0; index--) {
    const variable = environments[index].variables.get(name);
    if (variable === undefined) {
      continue;
    }
    if (variable.type === "built-in" || variable.kind === "const") {
      return variable;
    }
  }
  return null;
};

export const getCloseVariable = (
  environments: Environment[],
  name: string
): string | null => {
  for (let index = environments.length - 1; index >= 1; index--) {
    const variableKeys = Array.from(environments[index].variables.keys());
    const variable = variableKeys
      .filter(vk => levenshtein(vk, name) < 3)
      .sort((a, b) => levenshtein(a, name) - levenshtein(b, name))
      [0];
    if (variable === undefined) {
      continue;
    }
    return variable;
  }
  return null;
};

export const tryGetDotFunction = (
  environments: Environment[],
  name: string,
  params: string[]
): EnvironmentFunction | null => {
  for (let index = environments.length - 1; index >= 0; index--) {
    for (let func of environments[index].functions.filter(
      (f) => f.name === name && f.kind === "dot"
    )) {
      if (
        params.length === func.parameterTypes.length &&
        func.parameterTypes.every((toMatch, i) => {
          const type = params[i];
          return doesTypeMatch(type, toMatch);
        })
      ) {
        return func;
      }
    }
  }
  return null;
};

export const getCloseDot = (
  environments: Environment[],
  name: string,
  params: string[]
): string | null => {
  for (let index = environments.length - 1; index >= 0; index--) {
    for (let func of environments[index].functions.filter(
      (f) => levenshtein(f.name, name) < 3 && f.kind === "dot"
    ).sort((a, b) => levenshtein(a.name, name) - levenshtein(b.name, name))) {
      if (
        params.length === func.parameterTypes.length &&
        func.parameterTypes.every((toMatch, i) => {
          const type = params[i];
          return doesTypeMatch(type, toMatch);
        })
      ) {
        return func.name;
      }
    }
  }
  return null;
};

export const getDotFunctionsFor = (
  environments: Environment[],
  type: string
): [string, string | TokenRange][] => {
  const results: [string, string | TokenRange][] = [];
  for (let index = environments.length - 1; index >= 0; index--) {
    for (let func of environments[index].functions.filter(f => f.kind === "dot")) {
      if (func.parameterTypes[0] === type) {
        results.push([func.name, func.data]);
      }
    }
  }
  return results;
}

export const tryGetDefFunction = (
  environments: Environment[],
  name: string,
  params: string[]
): EnvironmentFunction | null => {
  for (let index = environments.length - 1; index >= 0; index--) {
    for (let func of environments[index].functions.filter(
      (f) => f.name === name && f.kind === "def"
    )) {
      if (
        params.length === func.parameterTypes.length &&
        func.parameterTypes.every((toMatch, i) => {
          const type = params[i];
          return doesTypeMatch(type, toMatch);
        })
      ) {
        return func;
      }
    }
  }
  return null;
};

export const getCloseDef = (
  environments: Environment[],
  name: string,
  params: string[]
): string | null => {
  for (let index = environments.length - 1; index >= 0; index--) {
    for (let func of environments[index].functions.filter(
      (f) => levenshtein(f.name, name) < 3 && f.kind === "def"
    ).sort((a, b) => levenshtein(a.name, name) - levenshtein(b.name, name))) {
      if (
        params.length === func.parameterTypes.length &&
        func.parameterTypes.every((toMatch, i) => {
          const type = params[i];
          return doesTypeMatch(type, toMatch);
        })
      ) {
        return func.name;
      }
    }
  }
  return null;
};

export const tryGetBinaryOperator = (
  environments: Environment[],
  name: string,
  params: string[]
): EnvironmentOperator | null => {
  for (let index = environments.length - 1; index >= 0; index--) {
    for (let func of environments[index].operators.filter(
      (f) => f.name === name && f.kind === "binary"
    )) {
      if (
        params.length === func.parameterTypes.length &&
        func.parameterTypes.every((toMatch, i) => {
          const type = params[i];
          return doesTypeMatch(type, toMatch);
        })
      ) {
        return func;
      }
    }
  }
  return null;
};

export const tryGetUnaryOperator = (
  environments: Environment[],
  name: string,
  params: string[]
): EnvironmentOperator | null => {
  for (let index = environments.length - 1; index >= 0; index--) {
    for (let func of environments[index].operators.filter(
      (f) => f.name === name && f.kind === "unary"
    )) {
      if (
        params.length === func.parameterTypes.length &&
        func.parameterTypes.every((toMatch, i) => {
          const type = params[i];
          return doesTypeMatch(type, toMatch);
        })
      ) {
        return func;
      }
    }
  }
  return null;
};

export const tryGetReturnType = (
  environments: Environment[]
): string | null => {
  for (let index = environments.length - 1; index >= 0; index--) {
    const env = environments[index];
    if (env.type === "function") {
      if (env.returnType) {
        return typeStringToTypeToken(env.returnType);
      } else return null;
    }
  }
  return null;
};

export const getArrayType = (
  environments: Environment[],
  typeName: string
): string => {
  const type = tryGetType(environments, typeName) ?? {
    type: "built-in",
    data: typeName,
  };
  const arrayTypeName = `*${typeName}`;
  const arrayType = environments[0].types.get(arrayTypeName);
  if (!arrayType) {
    const typeString =
      type.type === "user-defined" ? type.data.definition.value : type.data;
    const arrayType: EnvironmentType = {
      type: "built-in",
      data: `[${typeString}]`,
    };
    environments[0].types.set(arrayTypeName, arrayType);
  }
  return arrayTypeName;
};

export const getParamMapping = (parameters: string[], paramTypes: string[]): Partial<Record<string, string>> => {
  const result: Partial<Record<string, string>> = {};
  parameters.forEach((p, i) => {
    const arrayWraps = howBaseTypeMatchesForGeneric(p, paramTypes[i]);
    if (arrayWraps == null) return;
    if (arrayWraps[1].startsWith('@')) {
      result[arrayWraps[1]] = arrayWraps[2];
    }
  });
  return result;
}

export const applyParamMapping = (parameters: Parameter[], paramMap: Partial<Record<string, string>>): string[] => {
  return parameters.map(p => {
    const [ins, inner] = getInnerArrayType(typeStringToTypeToken(p.type.value));
    const mapped = paramMap[inner];
    if (!mapped) return p.type.value;
    return `${'['.repeat(ins)}${mapped}${']'.repeat(ins)}`;
  });
}

export const tryGetType = (
  environments: Environment[],
  name: string
): EnvironmentType | null => {
  if (name.startsWith("@")) return environments[0].types.get("@") ?? null;
  for (let index = environments.length - 1; index >= 0; index--) {
    const type = environments[index].types.get(name);
    if (type !== undefined) {
      return type;
    }
  }
  if (name.startsWith("*")) {
    return (
      environments[0].types.get(getArrayType(environments, name.slice(1))) ??
      null
    );
  }
  return null;
};

export const getCloseType = (
  environments: Environment[],
  name: string
): string | null => {
  if (name.startsWith("@")) return "@";
  if (name.startsWith("*")) {
    const found = getCloseType(environments, name.slice(1));
    return found
      ? '*' + found
      : null;
  }
  for (let index = environments.length - 1; index >= 0; index--) {
    const typeKeys = Array.from(environments[index].types.keys());
    const type = typeKeys
      .filter(vk => levenshtein(vk, name) < 3)
      .sort((a, b) => levenshtein(a, name) - levenshtein(b, name))
      [0];
    if (type !== undefined) {
      return type;
    }
  }
  return null;
}

export const transformGenericType = (
  func: EnvironmentOperator | EnvironmentFunction | null,
  types: string[]
): string => {
  if (!func?.returnType) return "?";
  if (!func.returnType.includes("@")) return func.returnType;
  for (let index = 0; index < func.parameterTypes.length; index++) {
    const matchCount = howBaseTypeMatches(
      func.parameterTypes[index],
      func.returnType
    );
    if (matchCount == null) continue;
    if (matchCount == 0) return types[index];
    if (matchCount > 0) {
      return "*".repeat(matchCount) + types[index];
    } else {
      return types[index].slice(-matchCount);
    }
  }
  return "?";
};

/**
 * Checks how type t1 matches to t2.
 * 
 * 0 - they are the same
 * 
 * +1, +2, ..., +N - t2 is t1 arrayed N times
 * 
 * -1, -2, ..., -N - t1 is t2 arrayed N times
 * 
 * null - they are a different type
 */
export const howBaseTypeMatches = (t1: string, t2: string): number | null => {
  if (t1 === t2) return 0;
  if (t1.startsWith("*")) {
    const r = howBaseTypeMatches(t1.slice(1), t2);
    return r != null ? r - 1 : r;
  }
  if (t2.startsWith("*")) {
    const r = howBaseTypeMatches(t1, t2.slice(1));
    return r != null ? r + 1 : r;
  }
  return null;
};

/**
 * Checks how type t1 matches to t2. t1 can be a generic type.
 * 
 * 0 - they are the same
 * 
 * +1, +2, ..., +N - t2 is t1 arrayed N times
 * 
 * -1, -2, ..., -N - t1 is t2 arrayed N times
 * 
 * null - they are a different type
 */
export const howBaseTypeMatchesForGeneric = (t1: string, t2: string): [number, string, string] | null => {
  if (t1 === t2) return [0, t1, t2];
  if (t1.startsWith("*")) {
    const r = howBaseTypeMatchesForGeneric(t1.slice(1), t2);
    return r != null ? [r[0] - 1, r[1], r[2]] : r;
  }
  if (t2.startsWith("*")) {
    const r = howBaseTypeMatchesForGeneric(t1, t2.slice(1));
    return r != null ? [r[0] + 1, r[1], r[2]] : r;
  }
  if (t1.startsWith('@')) {
    // t1 is a generic type, so anything in t2 goes.
    return [0, t1, t2];
  }
  return null;
};

export const getInnerArrayType = (t: string): [number, string] => {
  if (t.startsWith('*')) {
    const [a, b] = getInnerArrayType(t.slice(1));
    return [a + 1, b];
  }
  return [0, t];
}

export const getAfterIndexType = (
  type: string,
  environments: Environment[]
): string | null => {
  if (type.startsWith("*")) return type.slice(1);
  if (type === "String") return "Char";
  const typeInfo = tryGetType(environments, type);
  if (
    !typeInfo ||
    typeInfo.type === "built-in" ||
    Array.isArray(typeInfo.data.definition.value)
  )
    return null;
  return getAfterIndexType(typeInfo.data.definition.value, environments);
};

export const isIntegerType = (type: string): boolean => {
  return (
    type === "Int" || isUnsignedIntegerType(type) || isSignedIntegerType(type)
  );
};

export const getIntSigned = (type: string): boolean => {
  if (type.startsWith('S')) return true;
  return false;
};

export const getIntMaxValue = (type: string): bigint => {
  const typeValue = getIntBitSize(type);
  return (BigInt(1) << BigInt(typeValue)) - BigInt(1);
};

export const getIntBitSize = (type: string): number => {
  if (type === 'Int') return 2048;
  if (type === 'SInt') return 2048;
  if (type === 'UInt') return 2048;
  let typeValue = parseInt(type.slice(1), 10);
  if (getIntSigned(type)) {
    typeValue -= 1;
  }
  return typeValue;
};

/**
 * Gets the integer containing type, e.g. U9 -> 16, S8 -> 8, U2048 -> 2048
 */
export const getIntContainingType = (type: string): number => {
  const bitSize = getIntBitSize(type);
  if (bitSize <= 8) return 8;
  if (bitSize <= 16) return 16;
  if (bitSize <= 32) return 32;
  return Math.ceil(bitSize / 64.0);
}

/**
 * Checks whether an integer type can be assigned to another integer type
 */
export const isIntAssignableTo = (to: string, from: string): boolean => {
  if (to === 'Int') return true;
  if (to === 'UInt' && isUnsignedIntegerType(from)) return true;
  if (to === 'SInt' && isSignedIntegerType(from)) return true;
  const toBitSize = getIntBitSize(to);
  const fromBitSize = getIntBitSize(from);
  return toBitSize >= fromBitSize;
}

export const isUnsignedIntegerType = (type: string): boolean => {
  return type === "UInt" || /^U\d+$/.test(type);
};

export const isSignedIntegerType = (type: string): boolean => {
  return type === "SInt" || /^S\d+$/.test(type);
};

export const doesArrayTypeMatch = (type: string, toMatch: string): boolean => {
  if (!type.startsWith("*") || !toMatch.startsWith("*")) return false;
  return doesTypeMatch(type.slice(1), toMatch.slice(1));
};

export const doesTypeMatch = (type: string, toMatch: string): boolean => {
  if (type === toMatch) return true;
  if (toMatch.startsWith("@")) return true;
  if (toMatch === "UInt" && isUnsignedIntegerType(type)) {
    return true;
  }
  if ((toMatch === "Int" || toMatch === "SInt") && isSignedIntegerType(type)) {
    return true;
  }
  return doesArrayTypeMatch(type, toMatch);
};

export const filterOnlyConst = (environments: Environment[]): Environment[] => {
  return environments.map((e, i) => {
    const operators = i === 0 ? e.operators : [];
    const types = i === 0 ? e.types : new Map();
    const switchTypes = i === 0 ? e.switchTypes : new Map();
    const variables = new Map(
      Array.from(e.variables.entries()).filter((e) => e[1].kind === "const")
    );
    return e.type === "function"
      ? {
          type: "function",
          switchTypes,
          returnType: null,
          functions: [],
          operators,
          types,
          variables,
        }
      : {
          type: "scope",
          switchTypes,
          functions: [],
          operators,
          types,
          variables,
        };
  });
};

export const isEnumType = (
  type: string,
  environments: Environment[]
): string[] | null => {
  if (type === "Bool") return ["false", "true"];
  if (type === "TestResult") return ["pass", "fail", "win"];
  const typeData = tryGetType(environments, type);
  if (
    typeData?.type === "user-defined" &&
    Array.isArray(typeData.data.definition.value)
  ) {
    return typeData.data.definition.value;
  }
  return null;
};

export const addDef = (
  name: string,
  description: string,
  returnType: string | null,
  parameterTypes: string[]
) => {
  baseEnvironment.functions.push({
    type: "built-in",
    kind: "def",
    name,
    data: description,
    parameterTypes,
    returnType,
  });
};

export const addDot = (
  name: string,
  description: string,
  returnType: string | null,
  parameterTypes: string[]
) => {
  baseEnvironment.functions.push({
    type: "built-in",
    kind: "dot",
    name,
    data: description,
    parameterTypes,
    returnType,
  });
};

export const addUnary = (
  name: string,
  description: string,
  returnType: string,
  parameterType: string
) => {
  baseEnvironment.operators.push({
    type: "built-in",
    kind: "unary",
    name,
    data: description,
    parameterTypes: [parameterType],
    returnType,
  });
};

export const addBinary = (
  name: string,
  description: string,
  returnType: string,
  parameterTypes: [string, string]
) => {
  baseEnvironment.operators.push({
    type: "built-in",
    kind: "binary",
    name,
    data: description,
    parameterTypes,
    returnType,
  });
};

export const addConst = (name: string, description: string, varType: string) => {
  baseEnvironment.variables.set(name, {
    type: "built-in",
    kind: "const",
    data: description,
    varType,
  });
};

export const addType = (name: string, description: string): string => {
  const type: EnvironmentType = {
    type: "built-in",
    data: description,
  };
  baseEnvironment.types.set(name, type);
  return name;
};

export const addEnum = (
  name: string,
  description: string,
  values: string[],
  boolType?: string
): string => {
  const type = addType(name, description);
  values.forEach((v) => {
    addConst(v, `A \`${v}\` value of enum ${name}`, type);
  });
  addBinary(
    "==",
    `Checks if the first ${name} value is equal to the second`,
    boolType ?? type,
    [type, type]
  );
  addBinary(
    "!=",
    `Checks if the first ${name} value is not equal to the second`,
    boolType ?? type,
    [type, type]
  );
  return type;
};

export const anyType = addType("@", "Any type");

export const arr = getArrayType.bind(null, [baseEnvironment]);
