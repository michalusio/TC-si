import { FunctionDefinition, FunctionKind, OperatorKind, TokenRange, TypeDefinition, VariableKind } from "./parsers/types/ast";

export type EnvironmentVariable = {
  type: 'user-defined';
  kind: VariableKind;
  data: TokenRange;
  varType: string | null;
} | {
  type: 'built-in';
  kind: VariableKind;
  data: string;
  varType: string;
};

export type EnvironmentFunction = {
  type: 'user-defined';
  kind: FunctionKind;
  name: string;
  data: TokenRange;
  assumptions: FunctionDefinition[];
  parameterTypes: string[];
  returnType: string | null;
} | {
  type: 'built-in';
  kind: FunctionKind;
  name: string;
  data: string;
  parameterTypes: string[];
  returnType: string | null;
};

export type EnvironmentOperator = {
  type: 'user-defined';
  kind: OperatorKind;
  name: string;
  data: TokenRange;
  assumptions: FunctionDefinition[];
  parameterTypes: string[];
  returnType: string;
} | {
  type: 'built-in';
  kind: OperatorKind;
  name: string;
  data: string;
  parameterTypes: string[];
  returnType: string;
};

export type EnvironmentType = {
  type: 'user-defined';
  data: TypeDefinition;
} | {
  type: 'built-in';
  data: string;
}

export type StaticValue =
  | { type: 'string', value: string }
  | { type: 'number', value: number }
  | { type: 'default' }
  | { type: 'variable', value: string }
  | { type: 'complicated' }
  ;

export function sameStaticValue(a: StaticValue, b: StaticValue): boolean {
  switch (a.type) {
    case 'default': return b.type === 'default';
    case 'complicated': return false;
    case 'variable': return b.type === 'variable' && a.value === b.value;
    case 'string': return b.type === 'string' && a.value === b.value;
    case 'number': return b.type === 'number' && a.value === b.value;
    default: {
      const x: never = a;
      throw x;
    }
  }
}

export type Environment = ({
  type: 'function';
  returnType: string | null;
} | {
  type: 'scope';
}) & {
  variables: Map<string, EnvironmentVariable>;
  functions: EnvironmentFunction[];
  operators: EnvironmentOperator[];
  types: Map<string, EnvironmentType>;
  switchTypes: Map<string, [string, StaticValue[]]>;
};