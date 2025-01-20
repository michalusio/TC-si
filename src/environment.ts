import { FunctionKind, OperatorKind, TokenRange, TypeDefinition, VariableKind } from "./parsers/ast";

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
  switchTypes: Map<string, [string, (string | null)[]]>;
};