import type {
    Environment,
  EnvironmentFunction,
  EnvironmentOperator,
  EnvironmentType,
  EnvironmentVariable,
} from "./environment";
import { baseEnvironment } from "./storage";

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

const addDef = (
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

const addDot = (
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

const addUnary = (
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

const addBinary = (
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

const addConst = (name: string, description: string, varType: string) => {
  baseEnvironment.variables.set(name, {
    type: "built-in",
    kind: "const",
    data: description,
    varType,
  });
};

const addType = (name: string, description: string): string => {
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

const boolType = addEnum("Bool", "A boolean value", ["false", "true"]);
addUnary("!", "Negates the boolean", boolType, boolType);
addBinary("||", "ORs two booleans", boolType, [boolType, boolType]);
addBinary("&&", "ANDs two booleans", boolType, [boolType, boolType]);

addEnum(
  "TestResult",
  "Describes whether the test passes, fails, or wins the level",
  ["pass", "fail", "win"],
  boolType
);

const anyType = addType("@", "Any type");

const stringType = addType("String", "A string type");
addBinary("+", "Adds two strings together", stringType, [
  stringType,
  stringType,
]);
addBinary("==", "Checks if the first array is equal to the second", boolType, [
  stringType,
  stringType,
]);
addBinary(
  "!=",
  "Checks if the first array is not equal to the second",
  boolType,
  [stringType, stringType]
);

const intType = addType("Int", "A type allowing any integer to be passed in");

const addIntOperations = (iType: string) => {
  addUnary("~", "Inverts the bits of the integer", iType, iType);
  addUnary("-", "Negates the integer", iType, iType);

  addBinary("+", "Adds two integers together", iType, [iType, iType]);
  addBinary("-", "Subtracts two integers together", iType, [iType, iType]);
  addBinary("*", "Multiplies two integers together", iType, [iType, iType]);
  addBinary("/", "Divides two integers together", iType, [iType, iType]);
  addBinary(
    "%",
    "Calculates the modulo of the first integer by the second one",
    iType,
    [iType, iType]
  );
  addBinary("&", "ANDs bits of two integers together", iType, [iType, iType]);
  addBinary("|", "ORs bits of two integers together", iType, [iType, iType]);
  addBinary("^", "XORs bits of two integers together", iType, [iType, iType]);
  addBinary(
    ">>",
    "Shifts the first integer right by the second integers value",
    iType,
    [iType, iType]
  );
  addBinary(
    "<<",
    "Shifts the first integer left by the second integers value",
    iType,
    [iType, iType]
  );
  addBinary(
    "rol",
    "Rotates the first integer left by the second integers value",
    iType,
    [iType, iType]
  );
  addBinary(
    "ror",
    "Rotates the first integer right by the second integers value",
    iType,
    [iType, iType]
  );
  addBinary(
    "asr",
    "Arithmetically shifts the first integer right by the second integers value",
    iType,
    [iType, iType]
  );

  addBinary(
    ">",
    "Checks if the first integer is larger than the second",
    boolType,
    [iType, iType]
  );
  addBinary(
    "<",
    "Checks if the first integer is smaller than the second",
    boolType,
    [iType, iType]
  );
  addBinary(
    "<s",
    "Checks if the first integer is smaller (signed) than the second",
    boolType,
    [iType, iType]
  );
  addBinary(
    "<u",
    "Checks if the first integer is smaller (unsigned) than the second",
    boolType,
    [iType, iType]
  );
  addBinary(
    ">=",
    "Checks if the first integer is larger or equal to the second",
    boolType,
    [iType, iType]
  );
  addBinary(
    "<=",
    "Checks if the first integer is smaller or equal to the second",
    boolType,
    [iType, iType]
  );
  addBinary(
    "!=",
    "Checks if the first integer is not equal to the second",
    boolType,
    [iType, iType]
  );
  addBinary(
    "==",
    "Checks if the first integer is equal to the second",
    boolType,
    [iType, iType]
  );
};

const seedType = addType(
  "Seed",
  "A type used for seeding the random generator"
);
addDef("get_random_seed", "pub def get_random_seed() Seed {", seedType, []);
addDef("next", "pub dot next($s: Seed) Int {", intType, [seedType]);
addDef("random", "pub def random(max: Int) Int {", intType, [intType]);

const sintType = addType(
  "SInt",
  "A type allowing any signed integer to be passed in"
);
const uintType = addType(
  "UInt",
  "A type allowing any unsigned integer to be passed in"
);
for (let width = 1; width <= 2048; width++) {
  const s = addType("S" + width, `A signed integer of width ${width}`);
  addIntOperations(s);

  const u = addType("U" + width, `An unsigned integer of width ${width}`);
  addIntOperations(u);
}
addIntOperations(sintType);
addIntOperations(uintType);
addIntOperations(intType);

const arr = getArrayType.bind(null, [baseEnvironment]);
addDot("find", "pub dot find(array: [@Any], value: @Any) Int {", intType, [
  arr(anyType),
  anyType,
]);
addDot("len", "pub dot len(string: String) Int {", intType, [stringType]);
addDot("len", "pub dot len(array: [@Any]) Int {", intType, [arr(anyType)]);
addDot(
  "contains",
  "pub dot contains(array: [@Type], value: @Type) Bool {",
  boolType,
  [arr(anyType), anyType]
);
addDot("in", "pub dot in(value: @Type, array: [@Type]) Bool {", boolType, [
  anyType,
  arr(anyType),
]);
addDef("high", "pub dot high(a: [@Any]) Int {", intType, [arr(anyType)]);
addDef("sort", "pub def sort($arr: [@Any]) {", null, [arr(anyType)]);
addDef("quick_sort", "pub def quick_sort($arr: [@Any]) {", null, [
  arr(anyType),
]);
addDef("sample", "pub def sample(array: [@Any]) @Any {", anyType, [
  arr(anyType),
]);
addBinary("+", "Concatenates two arrays together", arr(anyType), [
  arr(anyType),
  arr(anyType),
]);
addBinary("==", "Checks if the first array is equal to the second", boolType, [
  arr(anyType),
  arr(anyType),
]);
addBinary(
  "!=",
  "Checks if the first array is not equal to the second",
  boolType,
  [arr(anyType), arr(anyType)]
);

addDef("_size", "pub def _size(data: @Any) Int {", intType, [anyType]);
addDef(
  "array",
  "pub def array(length: Int, value: @Any) [@Any] {",
  arr(anyType),
  [intType, anyType]
);
addDef("random", "pub def random(max: Int) Int {", intType, [intType]);
addDef("min", "pub def min(a: Int, b: Int) Int {", intType, [intType, intType]);
addDef("max", "pub def max(a: Int, b: Int) Int {", intType, [intType, intType]);
addDef("log10", "pub def log10(a: Int) Int {", intType, [intType]);
addDef("int", "pub def int(value: String) Int {", intType, [stringType]);
addDef("str", "pub def str(value: @Any) String {", stringType, [anyType]);
addDef("exit", "pub def exit() {", null, []);
addDef("exit", "pub def exit(code: Int) {", null, [intType]);
addDef("get_tick", "pub def get_tick() Int {", intType, []);
addDef("get_last_time", "pub def get_last_time() Int {", intType, []);
addDef(
  "get_register_value",
  "pub def get_register_value(register: Int) Int {",
  intType,
  [intType]
);
addDef("has_ram", "pub def has_ram() Bool {", boolType, []);
addDef("get_ram_value", "pub def get_ram_value(address: Int) Int {", intType, [
  intType,
]);
addDef("get_ram_size", "pub def get_ram_size() Int {", intType, []);
addDef("get_delay_score", "pub def get_delay_score() Int {", intType, []);
addDef(
  "get_component_count",
  "pub def get_component_count() Int {",
  intType,
  []
);
addDef(
  "get_program_address",
  "pub def get_program_address() Int {",
  intType,
  []
);
addDef("get_program_output", "pub def get_program_output() Int {", intType, []);
addDef(
  "get_level_memory",
  "pub def get_level_memory(id: String) Int {",
  intType,
  [stringType]
);
addDef(
  "set_custom_input_text",
  "pub def set_custom_input_text(text: String) {",
  null,
  [stringType]
);
addDef(
  "ui_set_hidden",
  "pub def ui_set_hidden(id: String, hidden: Bool) {",
  null,
  [stringType, boolType]
);
addDef("ui_set_text", "pub def ui_set_text(id: String, text: String) {", null, [
  stringType,
  stringType,
]);
addDef(
  "ui_set_position",
  "pub def ui_set_position(id: String, x: Int, y: Int) {",
  null,
  [stringType, intType, intType]
);
addDef("set_error", "pub def set_error(text: String) {", null, [stringType]);
addDef("output", "pub def output(text: String) {", null, [stringType]);
addDef("add_keyboard_value", "pub def add_keyboard_value(value: Int) {", null, [
  intType,
]);
addDef(
  "has_time_component",
  "pub def has_time_component() Bool {",
  boolType,
  []
);
addDef(
  "has_keyboard_component",
  "pub def has_keyboard_component() Bool {",
  boolType,
  []
);
addDef(
  "has_console_component",
  "pub def has_console_component() Bool {",
  boolType,
  []
);
addDef(
  "get_assembler_register_count",
  "pub def get_assembler_register_count() Int {",
  intType,
  []
);
addDef("get_console_offset", "pub def get_console_offset() Int {", intType, []);
addDef(
  "get_assembler_width",
  "pub def get_assembler_width() Int {",
  intType,
  []
);
addDef(
  "get_latency_ram_is_busy",
  "pub def get_latency_ram_is_busy() Bool {",
  boolType,
  []
);
addDef("set_address_text", "pub def set_address_text(text: String) {", null, [
  stringType,
]);
addDef("set_value_text", "pub def set_value_text(text: String) {", null, [
  stringType,
]);
addDef("get_cycle_count", "pub def get_cycle_count() Int {", intType, []);
addDef("get_probe_value", "pub def get_probe_value() Int {", intType, []);
addDef("get_gate_score", "pub def get_gate_score() Int {", intType, []);
addDef("print", "pub def print(input: @Any) {", null, [anyType]);

addConst(
  "Z_STATE",
  "Constant denoting the `Hi-Z` state of the wire.\n\nEquivalent to `0x8000_0000_0000_0000`.",
  intType
);
