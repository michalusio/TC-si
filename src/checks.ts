import { DiagnosticSeverity, Range, TextDocument } from "vscode";
import { getRecoveryIssues } from "./parsers/base";
import { log, tokensData } from "./storage";
import { languageParser } from "./parser";
import { isFailure, ParseError, Parser } from "parser-combinators";
import {
  FunctionKind,
  OperatorKind,
  ParserOutput,
  Statement,
  StatementsBlock,
  Token,
  TokenRange,
  TypeDefinition,
  VariableKind,
  VariableName,
} from "./parsers/ast";
import { SimplexDiagnostic } from './SimplexDiagnostic';
import { IndexRValue, RValue } from "./parsers/rvalue";
import { workspace } from 'vscode';

const useParser = <T>(
  text: string,
  parser: Parser<T>,
  path: string = ""
): T => {
  const res = parser({ text, path, index: 0 });
  if (isFailure(res)) {
    throw new ParseError(
      `Parse error, expected ${[...res.history].pop()} at char ${
        res.ctx.index
      }`,
      res.ctx.text,
      res.ctx.index,
      res.history
    );
  }
  if (res.ctx.index !== res.ctx.text.length) {
    throw new ParseError(
      `Parse error at index ${res.ctx.index}`,
      res.ctx.text,
      res.ctx.index,
      []
    );
  }
  return res.value;
};

export const performParsing = (
  document: TextDocument
): [ParserOutput | null, SimplexDiagnostic[]] => {
  const fullText = document.getText();
  const diags: SimplexDiagnostic[] = [];
  const startTime = Date.now();

  let parseResult: ParserOutput | null = null;
  try {
    parseResult = useParser(fullText, languageParser);
  } catch (p: unknown) {
    if (p instanceof ParseError) {
      const position = document.positionAt(p.index);
      diags.push(
        new SimplexDiagnostic(
          document.getWordRangeAtPosition(position) ??
            new Range(position, position),
          p.message,
          DiagnosticSeverity.Error
        )
      );
    } else if (p instanceof Error) {
      log.appendLine(p.stack ?? p.message);
    } else log.appendLine("Error: " + p);
  }

  const issues = getRecoveryIssues();
  for (const issue of issues) {
    if (issue.type === "skipped") {
      diags.push(
        new SimplexDiagnostic(
          new Range(
            document.positionAt(issue.index),
            document.positionAt(issue.index + issue.text.length)
          ),
          `Unknown characters found: \`${issue.text}\``,
          issue.kind === "warning"
            ? DiagnosticSeverity.Warning
            : DiagnosticSeverity.Error
        )
      );
    } else {
      diags.push(
        new SimplexDiagnostic(
          new Range(
            document.positionAt(issue.index),
            document.positionAt(issue.index)
          ),
          `Missing ${issue.text}`,
          issue.kind === "warning"
            ? DiagnosticSeverity.Warning
            : DiagnosticSeverity.Error
        )
      );
    }
  }
  log.appendLine(`Time spent parsing: ${Date.now() - startTime}ms`);

  return [parseResult, diags];
};

const typeCheck = () => workspace.getConfiguration('tcsi').get('showTypeCheckingErrors') as boolean;
const explicitReturn = () => workspace.getConfiguration('tcsi').get('warnOnMissingExplicitReturn') as boolean;

if (typeCheck() == null) {
  try {
    workspace.getConfiguration('tcsi').update('showTypeCheckingErrors', true);
  } catch (e) {}
}

let logging = false;

const logg = (v: string) => logging && log.appendLine(v);

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

export type Environment = {
  type: 'function';
  returnType: string | null;
  variables: Map<string, EnvironmentVariable>;
  functions: EnvironmentFunction[];
  operators: EnvironmentOperator[];
  types: Map<string, EnvironmentType>;
} | {
  type: 'scope';
  variables: Map<string, EnvironmentVariable>;
  functions: EnvironmentFunction[];
  operators: EnvironmentOperator[];
  types: Map<string, EnvironmentType>;
};

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

export const checkVariableExistence = (
  document: TextDocument,
  result: Statement[],
  environments: Environment[],
  diagnostics: SimplexDiagnostic[]
) => {
  result.forEach(scope => {
    switch (scope.type) {
      case 'type-definition': {
        const kind = tryGetType(environments, scope.name.value);
          if (kind !== null) {
            diagnostics.push(new SimplexDiagnostic(
              new Range(
                document.positionAt(scope.name.start),
                document.positionAt(scope.name.end)
              ),
              `You should not redeclare types: '${scope.name.value}'`,
              DiagnosticSeverity.Warning
            ));
          } else {
            const currentEnv = environments[environments.length - 1];
            currentEnv.types.set(scope.name.value, {
              type: 'user-defined',
              data: scope
            });
            tokensData.push({
              definition: scope.definition,
              position: scope.name,
              info: {
                range: scope.definition
              }
            });
          }
        break;
      }
    }
  })
  result.forEach(scope => {
    switch (scope.type) {
      case 'function-declaration': {
        if (scope.definition.type === 'function') {
          const paramTypes = scope.definition.parameters
              .map(param => checkType(param.type, document, environments, diagnostics) ?? '?');
          const kind = scope.definition.kind === 'def'
            ? tryGetDefFunction(environments, scope.definition.name.value, paramTypes)
            : tryGetDotFunction(environments, scope.definition.name.value, paramTypes);
          if (kind !== null) {
            diagnostics.push(new SimplexDiagnostic(
              new Range(
                document.positionAt(scope.definition.name.start),
                document.positionAt(scope.definition.name.end)
              ),
              `You should not redeclare functions: '${scope.definition.name.value}'`,
              DiagnosticSeverity.Warning
            ));
          } else {
            const currentEnv = environments[environments.length - 1];
            
            const returnType = checkType(scope.definition.returnType, document, environments, diagnostics);
            currentEnv.functions.push({
              type: 'user-defined',
              kind: scope.definition.kind,
              name: scope.definition.name.value,
              data: scope.definition.name,
              parameterTypes: paramTypes,
              returnType
            });
            tokensData.push({
              definition: scope.definition.name,
              position: scope.definition.name,
              info: {
                range: scope.definition.name
              }
            });
          }
        } else {
          const paramTypes = scope.definition.parameters
              .map(param => checkType(param.type, document, environments, diagnostics) ?? '?');
          const kind = scope.definition.kind === 'binary'
            ? tryGetBinaryOperator(environments, scope.definition.name.value, paramTypes)
            : tryGetUnaryOperator(environments, scope.definition.name.value, paramTypes);
          if (kind !== null) {
            diagnostics.push(new SimplexDiagnostic(
              new Range(
                document.positionAt(scope.definition.name.start),
                document.positionAt(scope.definition.name.end)
              ),
              `You should not redeclare operators: '${scope.definition.name.value}'`,
              DiagnosticSeverity.Warning
            ));
          } else {
            const currentEnv = environments[environments.length - 1];
            const returnType = checkType(scope.definition.returnType, document, environments, diagnostics);
            currentEnv.operators.push({
              type: 'user-defined',
              kind: scope.definition.kind,
              name: scope.definition.name.value,
              data: scope.definition.name,
              parameterTypes: paramTypes,
              returnType: returnType ?? '?'
            });
            tokensData.push({
              definition: scope.definition.name,
              position: scope.definition.name,
              info: {
                range: scope.definition.name
              }
            });
          }
        }
        break;
      }
    }
  })
  result.forEach(scope => {
    switch (scope.type) {
      case 'declaration': {
        diagnostics.push(...processRValue(document, environments, scope.value.value));
        const variable = tryGetVariable(true, environments, scope.name.value.name);
        if (variable !== null) {
          diagnostics.push(new SimplexDiagnostic(
            new Range(
              document.positionAt(scope.name.start),
              document.positionAt(scope.name.end)
            ),
            `You should not redeclare variables: '${scope.name.value.name}'`,
            DiagnosticSeverity.Warning
          ));
        } else {
          const varType = getType(scope.value, document, environments, diagnostics);
          environments[environments.length - 1]
            .variables
            .set(scope.name.value.name, {
              type: 'user-defined',
              kind: scope.kind.value,
              data: scope.name,
              varType
            });
          tokensData.push({
            definition: scope.name,
            position: scope.name,
            info: {
              range: {
                start: scope.kind.start,
                end: scope.name.end
              },
              type: varType
            }
          });
        }
        break;
      }
      case 'modification': {
        diagnostics.push(...processRValue(document, environments, scope.value.value));
        const left = getType(scope.name, document, environments, diagnostics);
        const right = getType(scope.value, document, environments, diagnostics);
        if (typeCheck() && left !== right) {
          if (!isIntegerType(left) || scope.value.value.type !== 'number') {
            diagnostics.push(new SimplexDiagnostic(
              new Range(
                document.positionAt(scope.value.start),
                document.positionAt(scope.value.end)
              ),
              `Cannot assign a value of type ${typeTokenToTypeString(right)} to a variable of type ${typeTokenToTypeString(left)}`
            ));
          }
        }
        if (scope.name.value.type === 'variable') {
          const variable = tryGetVariable(!scope.name.value.value.value.front.includes('.'), environments, scope.name.value.value.value.name);
          if (variable === null) {
            const variableSecondTry = tryGetVariable(false, environments, scope.name.value.value.value.name);
            if (variableSecondTry != null) {
              return [
                new SimplexDiagnostic(
                  new Range(
                    document.positionAt(scope.name.start),
                    document.positionAt(scope.name.end)
                  ),
                  `Cannot find name '${scope.name.value.value.value.name}' - maybe you should access it using '.'?`
                )
              ];
            } else {
              return [
                new SimplexDiagnostic(
                  new Range(
                    document.positionAt(scope.name.start),
                    document.positionAt(scope.name.end)
                  ),
                  `Cannot find name '${scope.name.value.value.value.name}'`
                )
              ];
            }
          } else {
            tokensData.push({
              definition: variable.data,
              position: scope.name,
              info: {}
            });
            if (variable.kind !== "var") {
              diagnostics.push(new SimplexDiagnostic(
                new Range(
                  document.positionAt(scope.name.start),
                  document.positionAt(scope.name.end)
                ),
                `Cannot assign to '${scope.name.value.value.value.name}' because it is a constant`
              ));
            }
          }
        } else {
          const index = scope.name.value as IndexRValue;
          diagnostics.push(...processRValue(document, environments, index.parameter.value));
          diagnostics.push(...processRValue(document, environments, index.value.value));
        }
        break;
      }
      case 'return': {
        if (scope.value.value) {
          diagnostics.push(...processRValue(document, environments, scope.value.value));
          const varType = getType(scope.value as Token<RValue>, document, environments, diagnostics);
          const funcType = tryGetReturnType(environments);
          if (typeCheck() && varType !== funcType) {
            diagnostics.push(new SimplexDiagnostic(
              new Range(
                document.positionAt(scope.value.start),
                document.positionAt(scope.value.end)
              ),
              funcType
                ? `Returned type is not the function's declared return type - was ${typeTokenToTypeString(varType)} - should be ${typeTokenToTypeString(funcType)}`
                : `Returned ${typeTokenToTypeString(varType)}, but the function was declared to not return anything`
            ));
          }
        }
        break;
      }
      case 'statements': {
        const nextEnvironments: Environment[] = [
          ...environments,
          {
            type: 'scope',
            functions: [],
            operators: [],
            types: new Map(),
            variables: new Map()
          }
        ];
        checkVariableExistence(
          document,
          scope.statements,
          nextEnvironments,
          diagnostics
        );
        break;
      }
      case '_reg_alloc_use': {
        diagnostics.push(...checkVariable(scope.value, document, environments));
        break;
      }
      case "function-declaration": {
        if (scope.definition.type === 'function') {
          if (scope.definition.kind === 'dot') {
            if (scope.definition.parameters.length === 0) {
              diagnostics.push(new SimplexDiagnostic(
                new Range(
                  document.positionAt(scope.definition.name.end),
                  document.positionAt(scope.definition.returnType.start)
                ),
                `Dot function should have at least one parameter`
              ));
            }
          }
          if (explicitReturn() && scope.definition.returnType.value) {
            if (!doesReturn(document, scope.statements, diagnostics)) {
              diagnostics.push(new SimplexDiagnostic(
                new Range(
                  document.positionAt(scope.definition.returnType.start),
                  document.positionAt(scope.definition.returnType.end)
                ),
                `A function with return type has to return a value`,
                DiagnosticSeverity.Warning
              ));
            }
          }
        } else {
          if (scope.definition.kind === 'binary') {
            if (scope.definition.parameters.length > 2) {
              scope.definition.parameters.slice(2).forEach(param => {
                diagnostics.push(new SimplexDiagnostic(
                  new Range(
                    document.positionAt(param.name.start),
                    document.positionAt(param.type.end)
                  ),
                  `Binary operators should have two parameters`
                ));
              });
            } else if (scope.definition.parameters.length < 2) {
              diagnostics.push(new SimplexDiagnostic(
                new Range(
                  document.positionAt(scope.definition.name.end),
                  document.positionAt(scope.definition.returnType.start)
                ),
                `Binary operators should have two parameters`
              ));
            }
          } else {
            if (scope.definition.parameters.length > 1) {
              scope.definition.parameters.slice(1).forEach(param => {
                diagnostics.push(new SimplexDiagnostic(
                  new Range(
                    document.positionAt(param.name.start),
                    document.positionAt(param.type.end)
                  ),
                  `Unary operators should have one parameter`
                ));
              });
            } else if (scope.definition.parameters.length < 1) {
              diagnostics.push(new SimplexDiagnostic(
                new Range(
                  document.positionAt(scope.definition.name.end),
                  document.positionAt(scope.definition.returnType.start)
                ),
                `Unary operators should have one parameter`
              ));
            }
          }
          if (!scope.definition.name.value.startsWith('=') && scope.definition.name.value.endsWith('=')) {
            if (scope.definition.returnType.value) {
              diagnostics.push(new SimplexDiagnostic(
                new Range(
                  document.positionAt(scope.definition.returnType.start),
                  document.positionAt(scope.definition.returnType.end)
                ),
                `Assignment operators should not return anything`
              ));
            }
            if (scope.definition.parameters.length > 0) {
              if (scope.definition.parameters[0].name.value.front !== '$') {
                diagnostics.push(new SimplexDiagnostic(
                  new Range(
                    document.positionAt(scope.definition.parameters[0].name.start),
                    document.positionAt(scope.definition.parameters[0].name.end)
                  ),
                  `The first parameter of an assignment operator should be mutable`
                ));
              }
            }
          } else {
            if (!scope.definition.returnType.value) {
              diagnostics.push(new SimplexDiagnostic(
                new Range(
                  document.positionAt(scope.definition.returnType.start),
                  document.positionAt(scope.definition.returnType.end)
                ),
                `Missing return type`
              ));
            }
          }
        }
        const nextEnvironments: Environment[] = [...environments, {
          type: 'function',
          functions: [],
          operators: [],
          types: new Map(),
          variables: new Map(),
          returnType: scope.definition.returnType.value
        }];
        scope.definition.parameters.forEach((parameter) => {
          const env = nextEnvironments[nextEnvironments.length - 1];
          const variableName = parameter.name.value;
          const varType = checkType(parameter.type, document, environments, diagnostics);
          if (typeCheck() && !varType) {
            diagnostics.push(new SimplexDiagnostic(
              new Range(
                document.positionAt(parameter.type.start),
                document.positionAt(parameter.type.end)
              ),
              `Missing type: '${parameter.type.value}'`
            ));
          }
          if (variableName.front === "$") {
            env.variables.set(variableName.name, {
              type: 'user-defined',
              kind: 'var',
              data: parameter.name,
              varType
            });
            tokensData.push({
              definition: parameter.name,
              position: parameter.name,
              info: {
                range: {
                  start: parameter.name.start,
                  end: parameter.type.end
                },
                type: varType ?? undefined
              }
            });
          } else {
            env.variables.set(variableName.name, {
              type: 'user-defined',
              kind: 'const',
              data: parameter.name,
              varType
            });
            tokensData.push({
              definition: parameter.name,
              position: parameter.name,
              info: {
                range: {
                  start: parameter.name.start,
                  end: parameter.type.end
                },
                type: varType ?? undefined
              }
            });
          }
        });
        checkVariableExistence(
          document,
          scope.statements,
          nextEnvironments,
          diagnostics
        );
        break;
      }
      case "if": {
        diagnostics.push(...processRValue(document, environments, scope.value.value));
        const nextIfEnvironments: Environment[] = [...environments, {
          type: 'scope',
          functions: [],
          operators: [],
          types: new Map(),
          variables: new Map()
        }];
        checkVariableExistence(
          document,
          scope.ifBlock,
          nextIfEnvironments,
          diagnostics
        );
        const varType = getType(scope.value, document, environments, diagnostics);
        if (typeCheck() && varType !== 'Bool') {
          diagnostics.push(new SimplexDiagnostic(
            new Range(
              document.positionAt(scope.value.start),
              document.positionAt(scope.value.end)
            ),
            `An if block condition has to be a boolean type - was ${typeTokenToTypeString(varType)}`
          ));
        }
        scope.elifBlocks.forEach((elif) => {
          diagnostics.push(...processRValue(document, environments, elif.value.value));
          const nextElifEnvironments: Environment[] = [
            ...environments,
            {
              type: 'scope',
              functions: [],
              operators: [],
              types: new Map(),
              variables: new Map()
            }
          ];
          checkVariableExistence(
            document,
            elif.statements,
            nextElifEnvironments,
            diagnostics
          );
          const varType = getType(elif.value, document, environments, diagnostics);
          if (typeCheck() && varType !== 'Bool') {
            diagnostics.push(new SimplexDiagnostic(
              new Range(
                document.positionAt(scope.value.start),
                document.positionAt(scope.value.end)
              ),
              `An elif block condition has to be a boolean type - was ${typeTokenToTypeString(varType)}`
            ));
          }
        });
        const nextElseEnvironments: Environment[] = [
          ...environments,
          {
            type: 'scope',
            functions: [],
            operators: [],
            types: new Map(),
            variables: new Map()
          }
        ];
        checkVariableExistence(
          document,
          scope.elseBlock,
          nextElseEnvironments,
          diagnostics
        );
        break;
      }
      case "switch": {
        scope.cases.forEach((oneCase) => {
          if (typeof oneCase.caseName !== 'string') {
            if (!("type" in oneCase.caseName)) {
              diagnostics.push(...checkVariable(oneCase.caseName, document, environments));
            }
          }
          const nextCaseEnvironments: Environment[] = [
            ...environments,
            {
              type: 'scope',
              functions: [],
              operators: [],
              types: new Map(),
              variables: new Map()
            }
          ];
          checkVariableExistence(
            document,
            oneCase.statements,
            nextCaseEnvironments,
            diagnostics
          );
        });
        break;
      }
      case "while": {
        diagnostics.push(...processRValue(document, environments, scope.value.value));
        const nextEnvironments: Environment[] = [...environments, {
          type: 'scope',
          functions: [],
          operators: [],
          types: new Map(),
          variables: new Map()
        }];
        checkVariableExistence(
          document,
          scope.statements,
          nextEnvironments,
          diagnostics
        );
        const varType = getType(scope.value, document, environments, diagnostics);
        if (typeCheck() && varType !== 'Bool') {
          diagnostics.push(new SimplexDiagnostic(
            new Range(
              document.positionAt(scope.value.start),
              document.positionAt(scope.value.end)
            ),
            `A while block condition has to be a boolean type - was ${typeTokenToTypeString(varType)}`
          ));
        }
        break;
      }
      case 'type-definition': {
        break;
      }
      default: {
        diagnostics.push(...processRValue(document, environments, scope));
        break;
      }
    }
  });
};

const processRValue = (
  document: TextDocument,
  environments: Environment[],
  rValue: RValue
): SimplexDiagnostic[] => {
  const results: SimplexDiagnostic[] = [];
  switch (rValue.type) {
    case 'number':
    case 'string': {
      // Nothing to do here
      break;
    }
    case 'interpolated': {
      rValue.inserts.forEach(i => {
        results.push(...processRValue(document, environments, i.value.value));
      });
      break;
    }
    case 'variable': {
      results.push(...checkVariable(rValue.value, document, environments));
      break;
    }
    case 'cast': {
      results.push(...processRValue(document, environments, rValue.value.value));
      break;
    }
    case 'array': {
      rValue.values.forEach(v => {
        results.push(...processRValue(document, environments, v.value));
      });
      break;
    }
    case 'index': {
      results.push(...processRValue(document, environments, rValue.value.value));
      results.push(...processRValue(document, environments, rValue.parameter.value));
      break;
    }
    case 'unary': {
      results.push(...processRValue(document, environments, rValue.value.value));
      break;
    }
    case 'binary': {
      results.push(...processRValue(document, environments, rValue.left.value));
      results.push(...processRValue(document, environments, rValue.right.value));
      break;
    }
    case 'ternary': {
      results.push(...processRValue(document, environments, rValue.condition.value));
      results.push(...processRValue(document, environments, rValue.ifTrue.value));
      results.push(...processRValue(document, environments, rValue.ifFalse.value));
      break;
    }
    case 'dotMethod': {
      results.push(...processRValue(document, environments, rValue.object.value));
      rValue.parameters.forEach(p => {
        results.push(...processRValue(document, environments, p.value));
      });
      const kind = tryGetDotFunction(
        environments,
        rValue.value.value,
        [rValue.object, ...rValue.parameters].map(p => getType(p, document, environments, results))
      );
      if (kind === null) {
        results.push(
          new SimplexDiagnostic(
            new Range(
              document.positionAt(rValue.value.start),
              document.positionAt(rValue.value.end)
            ),
            `Cannot find name '${rValue.value.value}'`
          )
        );
      } else {
        tokensData.push({
          definition: kind.data,
          position: rValue.value,
          info: {}
        });
      }
      break;
    }
    case 'function': {
      rValue.parameters.forEach(p => {
        results.push(...processRValue(document, environments, p.value));
      });
      getType({
        start: rValue.value.start,
        end: (rValue.parameters[rValue.parameters.length - 1]?.end ?? (rValue.value.end + 1)) + 1,
        value: rValue
      }, document, environments, results);
      const kind = tryGetDefFunction(
        environments,
        rValue.value.value,
        rValue.parameters.map(p => getType(p, document, environments, results))
      );
      if (kind !== null) {
        tokensData.push({
          definition: kind.data,
          position: rValue.value,
          info: {
            type: kind.returnType ?? undefined
          }
        });
      }
      break;
    }
    case "parenthesis": {
      results.push(...processRValue(document, environments, rValue.value.value));
      break;
    }
    default: {
      const x: never = rValue;
      throw x;
    }
  }
  return results;
};

const tryGetVariable = (
  inScope: boolean,
  environments: Environment[],
  name: string
): EnvironmentVariable | null => {
  for (let index = environments.length - 1; index >= 1; index--) {
    const type = environments[index].type;
    const variable = environments[index].variables.get(name);
    if (variable === undefined) {
      if (inScope && type === 'function') {
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
    if (variable.type === 'built-in' || variable.kind === 'const') {
      return variable;
    }
  }
  return null;
};

const tryGetDotFunction = (
  environments: Environment[],
  name: string,
  params: string[]
): EnvironmentFunction | null => {
  for (let index = environments.length - 1; index >= 0; index--) {
    for (let func of environments[index].functions.filter(f => f.name === name && f.kind === 'dot')) {
      if (params.length === func.parameterTypes.length && func.parameterTypes.every((toMatch, i) => {
        const type = params[i];
        return doesTypeMatch(type, toMatch);
      })) {
        return func;
      }
    }
  }
  return null;
};

const tryGetDefFunction = (
  environments: Environment[],
  name: string,
  params: string[]
): EnvironmentFunction | null => {
  for (let index = environments.length - 1; index >= 0; index--) {
    for (let func of environments[index].functions.filter(f => f.name === name && f.kind === 'def')) {
      if (params.length === func.parameterTypes.length && func.parameterTypes.every((toMatch, i) => {
        const type = params[i];
        return doesTypeMatch(type, toMatch);
      })) {
        return func;
      }
    }
  }
  return null;
};

const tryGetBinaryOperator = (
  environments: Environment[],
  name: string,
  params: string[]
): EnvironmentOperator | null => {
  for (let index = environments.length - 1; index >= 0; index--) {
    for (let func of environments[index].operators.filter(f => f.name === name && f.kind === 'binary')) {
      if (params.length === func.parameterTypes.length && func.parameterTypes.every((toMatch, i) => {
        const type = params[i];
        return doesTypeMatch(type, toMatch);
      })) {
        return func;
      }
    }
  }
  return null;
};

const tryGetUnaryOperator = (
  environments: Environment[],
  name: string,
  params: string[]
): EnvironmentOperator | null => {
  for (let index = environments.length - 1; index >= 0; index--) {
    for (let func of environments[index].operators.filter(f => f.name === name && f.kind === 'unary')) {
      if (params.length === func.parameterTypes.length && func.parameterTypes.every((toMatch, i) => {
        const type = params[i];
        return doesTypeMatch(type, toMatch);
      })) {
        return func;
      }
    }
  }
  return null;
};

const tryGetType = (
  environments: Environment[],
  name: string
): EnvironmentType | null => {
  if (name.startsWith('@')) return environments[0].types.get('@') ?? null;
  for (let index = environments.length - 1; index >= 0; index--) {
    const type = environments[index].types.get(name);
    if (type !== undefined) {
      return type;
    }
  }
  if (name.startsWith('*')) {
    return environments[0].types.get(getArrayType(environments, name.slice(1))) ?? null;
  }
  return null;
};

const tryGetReturnType = (environments: Environment[]): string | null => {
  for (let index = environments.length - 1; index >= 0; index--) {
    const env = environments[index];
    if (env.type === 'function') {
      if (env.returnType) {
        return typeStringToTypeToken(env.returnType);
      } else return null;
    }
  }
  return null;
}

export const getArrayType = (environments: Environment[], typeName: string): string => {
  const type = tryGetType(environments, typeName) ?? {
    type: 'built-in',
    data: typeName
  };
  const arrayTypeName = `*${typeName}`;
  const arrayType = environments[0].types.get(arrayTypeName);
  if (!arrayType) {
    const typeString = type.type === 'user-defined'
      ? type.data.definition.value
      : type.data;
    const arrayType: EnvironmentType = {
      type: 'built-in',
      data: `[${typeString}]`
    };
    environments[0].types.set(arrayTypeName, arrayType);
  }
  return arrayTypeName;
}

const checkVariable = (nameToken: Token<VariableName>, document: TextDocument, environments: Environment[]) : SimplexDiagnostic[] => {
  const kind = tryGetVariable(
    !nameToken.value.front.includes('.'),
    environments,
    nameToken.value.name
  );
  if (kind === null) {
    const secondKind = tryGetVariable(false, environments, nameToken.value.name);
    if (secondKind != null) {
      return [
        new SimplexDiagnostic(
          new Range(
            document.positionAt(nameToken.start),
            document.positionAt(nameToken.end)
          ),
          `Cannot find name '${nameToken.value.name}' - maybe you should access it using '.'?`
        )
      ];
    } else {
      return [
        new SimplexDiagnostic(
          new Range(
            document.positionAt(nameToken.start),
            document.positionAt(nameToken.end)
          ),
          `Cannot find name '${nameToken.value.name}'`
        )
      ];
    }
  } else {
    tokensData.push({
      definition: kind.data,
      position: nameToken,
      info: {
        type: kind.varType ?? '?'
      }
    });
  }
  return [];
}

const checkType = (typeToken: Token<string | null>, document: TextDocument, environments: Environment[], diagnostics: SimplexDiagnostic[]): string | null => {
  if (!typeToken.value) return null;
  const typeName = typeStringToTypeToken(typeToken.value);
  const envType = tryGetType(environments, typeName);
  if (!envType) {
    diagnostics.push(new SimplexDiagnostic(
      new Range(
        document.positionAt(typeToken.start),
        document.positionAt(typeToken.end)
      ),
      `Cannot find type: '${typeToken.value}'`
    ));
  }
  return typeName;
}

const doesReturn = (document: TextDocument, statements: StatementsBlock, diagnostics: SimplexDiagnostic[]): boolean => {
  for (let index = statements.length - 1; index >= 0; index--) {
    const statement = statements[index];
    switch (statement.type) {
      case 'return': {
        if (statement.value.value) {
          return true;
        } else {
          diagnostics.push(new SimplexDiagnostic(
            new Range(
              document.positionAt(statement.value.start),
              document.positionAt(statement.value.end)
            ),
            `A return in a function with specified return type must return a value`,
            DiagnosticSeverity.Warning
          ));
        }
        break;
      }
      case 'if': {
        if (doesReturn(document, statement.ifBlock, diagnostics)
          && doesReturn(document, statement.elseBlock, diagnostics)
          && statement.elifBlocks.every(b => doesReturn(document, b.statements, diagnostics))) {
          return true;
        }
        break;
      }
      case 'switch': {
        if (statement.cases.some(c => c.caseName === 'default')
          && statement.cases.every(c => doesReturn(document, c.statements, diagnostics))) {
          return true;
        }
      }
    }
  }
  return false;
}

const getType = (value: Token<RValue>, document: TextDocument, environments: Environment[], diagnostics: SimplexDiagnostic[]): string => {
  const rValue = value.value;
  switch (rValue.type) {
    case 'number':
      logg(`Number: Int`);
      return 'Int';
    case 'string':
    case 'interpolated':
      logg(`String: String`);
      return 'String';
    case 'parenthesis': {
      const type = getType(rValue.value, document, environments, diagnostics);
      logg(`Parenthesis: ${type}`);
      return type;
    }
    case 'unary': {
      const type = getType(rValue.value, document, environments, diagnostics);
      const operator = tryGetUnaryOperator(environments, rValue.operator, [type]);
      if (typeCheck() && !operator) {
        diagnostics.push(new SimplexDiagnostic(
          new Range(
            document.positionAt(rValue.value.start - 1),
            document.positionAt(rValue.value.start)
          ),
          `Cannot find unary operator ${rValue.operator} for type ${typeTokenToTypeString(type)}`
        ));
      }
      logg(`Unary: ${operator?.returnType ?? '?'}`);
      return transformGenericType(operator, [type]);
    }
    case 'binary': {
      const leftType = getType(rValue.left, document, environments, diagnostics);
      const rightType = getType(rValue.right, document, environments, diagnostics);
      let operator = tryGetBinaryOperator(environments, rValue.operator, [leftType, rightType]);
      if (!operator && isIntegerType(leftType) && rValue.right.value.type === 'number') {
        operator = tryGetBinaryOperator(environments, rValue.operator, [leftType, leftType]);
      }
      if (!operator && isIntegerType(rightType) && rValue.left.value.type === 'number') {
        operator = tryGetBinaryOperator(environments, rValue.operator, [rightType, rightType]);
      }
      if (typeCheck() && !operator) {
        diagnostics.push(new SimplexDiagnostic(
          new Range(
            document.positionAt(rValue.left.end),
            document.positionAt(rValue.right.start)
          ),
          `Cannot find binary operator ${rValue.operator} for types ${typeTokenToTypeString(leftType)} and ${typeTokenToTypeString(rightType)}`
        ));
      }
      logg(`Binary: ${operator?.returnType ?? '?'}`);
      return transformGenericType(operator, [leftType, rightType]);
    }
    case 'ternary': {
      const conditionType = getType(rValue.condition, document, environments, diagnostics);
      const ifTrueType = getType(rValue.ifTrue, document, environments, diagnostics);
      const ifFalseType = getType(rValue.ifFalse, document, environments, diagnostics);
      if (typeCheck() && conditionType !== 'Bool') {
        diagnostics.push(new SimplexDiagnostic(
          new Range(
            document.positionAt(rValue.condition.start),
            document.positionAt(rValue.condition.end)
          ),
          `A ternary condition has to be a boolean type - was ${typeTokenToTypeString(conditionType)}`
        ));
      }
      if (typeCheck() && ifTrueType !== ifFalseType) {
        diagnostics.push(new SimplexDiagnostic(
          new Range(
            document.positionAt(rValue.ifFalse.start),
            document.positionAt(rValue.ifFalse.end)
          ),
          `Both ternary branches must have the same type - was ${typeTokenToTypeString(ifTrueType)} and ${typeTokenToTypeString(ifFalseType)}`
        ));
      }
      logg(`Ternary: ${ifTrueType}`);
      return ifTrueType;
    }
    case 'dotMethod': {
      const paramTypes = [
        getType(rValue.object, document, environments, diagnostics),
        ...rValue.parameters.map(param => getType(param, document, environments, diagnostics))
      ];
      const dotFunction = tryGetDotFunction(environments, rValue.value.value, paramTypes);
      dotFunction?.parameterTypes.forEach((type, index) => {
        const actualType = paramTypes[index];
        const pos = index === 0
          ? rValue.object
          : rValue.parameters[index - 1];
        if (!actualType) {
          if (typeCheck()) {
            diagnostics.push(new SimplexDiagnostic(
              new Range(
                document.positionAt(pos.start),
                document.positionAt(pos.end)
              ),
              `Too many parameters - Function takes ${dotFunction.parameterTypes.length - 1} parameters`
            ));
          }
        } else {
          if (typeCheck() && !doesTypeMatch(actualType, type)) {
            diagnostics.push(new SimplexDiagnostic(
              new Range(
                document.positionAt(pos.start),
                document.positionAt(pos.end)
              ),
              `Invalid function parameter type - was ${typeTokenToTypeString(actualType)} - should be ${typeTokenToTypeString(type)}`
            ));
          }
        }
      });
      logg(`Dot Method: ${dotFunction?.returnType ?? '?'}`);
      return transformGenericType(dotFunction, paramTypes);
    }
    case 'function': {
      const paramTypes = rValue.parameters.map(param => getType(param, document, environments, diagnostics));
      const func = tryGetDefFunction(environments, rValue.value.value, paramTypes);
      if (typeCheck() && !func) {
        diagnostics.push(
          new SimplexDiagnostic(
            new Range(
              document.positionAt(rValue.value.start),
              document.positionAt(rValue.value.end)
            ),
            `Cannot find function '${rValue.value.value}(${paramTypes.map(typeTokenToTypeString).join(", ")})'`
          )
        );
      }
      func?.parameterTypes.forEach((type, index) => {
        const actualType = paramTypes[index];
        const pos = rValue.parameters[index];
        if (!actualType) {
          if (typeCheck()) {
            diagnostics.push(new SimplexDiagnostic(
              new Range(
                document.positionAt(pos.start),
                document.positionAt(pos.end)
              ),
              `Too many parameters - Function takes ${func.parameterTypes.length} parameters`
            ));
          }
        } else {
          if (typeCheck() && !doesTypeMatch(actualType, type)) {
            diagnostics.push(new SimplexDiagnostic(
              new Range(
                document.positionAt(pos.start),
                document.positionAt(pos.end)
              ),
              `Invalid function parameter type - was ${typeTokenToTypeString(actualType)} - should be ${typeTokenToTypeString(type)}`
            ));
          }
        }
      });
      logg(`Def Method: ${func?.returnType ?? '?'}`);
      return transformGenericType(func, paramTypes);
    }
    case 'cast': {
      // Should I do anything with the inner type?
      getType(rValue.value, document, environments, diagnostics);
      logg(`Cast: ${rValue.to.value}`);
      return typeStringToTypeToken(rValue.to.value);
    }
    case 'array': {
      const valuesTypes = rValue.values.map(v => [v, getType(v, document, environments, diagnostics)] as const);
      const type = valuesTypes[0];
      if (typeCheck() && !type) {
        diagnostics.push(new SimplexDiagnostic(
          new Range(
            document.positionAt(value.start),
            document.positionAt(value.end)
          ),
          `Cannot infer the array type because it has no values`
        ));
      }
      const typeName = type?.[1] ?? '?';
      if (valuesTypes.some(([token, t]) => {
          if (t !== typeName) {
            if (typeCheck()) {
              diagnostics.push(new SimplexDiagnostic(
                new Range(
                  document.positionAt(token.start),
                  document.positionAt(token.end)
                ),
                `Array type inferred as ${typeTokenToTypeString(typeName)}, but encountered value of type ${typeTokenToTypeString(t)}`
              ));
            }
            return true;
          }
          return false;
        })) {
        logg(`Array: *?`);
        return '*?';
      }
      logg(`Array: *${typeName}`);
      return `*${typeName}`;
    }
    case 'variable': {
      const variableData = tryGetVariable(false, environments, rValue.value.value.name);
      if (typeCheck() && (!variableData?.varType || variableData.varType.endsWith('?'))) {
        diagnostics.push(new SimplexDiagnostic(
          new Range(
            document.positionAt(rValue.value.start),
            document.positionAt(rValue.value.end)
          ),
          `Unknown variable type`
        ));
      }
      logg(`Variable: *${variableData?.varType ?? '?'}`);
      return variableData?.varType ?? '?';
    }
    case 'index': {
      const parameterType = getType(rValue.parameter, document, environments, diagnostics);
      const variableType = getType(rValue.value, document, environments, diagnostics);
      if (typeCheck() && !isIntegerType(parameterType)) {
        diagnostics.push(new SimplexDiagnostic(
          new Range(
            document.positionAt(rValue.parameter.start),
            document.positionAt(rValue.parameter.end)
          ),
          `An index parameter has to be an integer type - was ${typeTokenToTypeString(parameterType)}`
        ));
      }
      const afterIndexType = getAfterIndexType(variableType, environments);
      if (typeCheck() && !afterIndexType) {
        diagnostics.push(new SimplexDiagnostic(
          new Range(
            document.positionAt(rValue.value.start),
            document.positionAt(rValue.value.end)
          ),
          `An indexed value has to be an array type - was ${typeTokenToTypeString(variableType)}`
        ));
      }
      logg(`Index: ${afterIndexType ?? '?'}`);
      return afterIndexType ?? '?';
    }
    default: {
      const x: never = rValue;
      throw x;
    }
  }
}

const transformGenericType = (func: EnvironmentOperator | EnvironmentFunction | null, types: string[]): string => {
  if (!func?.returnType) return '?';
  if (!func.returnType.includes('@')) return func.returnType;
  for (let index = 0; index < func.parameterTypes.length; index++) {
    const matchCount = howBaseTypeMatches(func.parameterTypes[index], func.returnType);
    if (matchCount == null) continue;
    if (matchCount == 0) return types[index];
    if (matchCount > 0) {
      return '*'.repeat(matchCount) + types[index];
    } else {
      return types[index].slice(-matchCount);
    }
  }
  return '?';
}

const howBaseTypeMatches = (t1: string, t2: string): number | null => {
  if (t1 === t2) return 0;
  if (t1.startsWith('*')) {
    const r = howBaseTypeMatches(t1.slice(1), t2);
    return r != null ? (r - 1) : r;
  }
  if (t2.startsWith('*')) {
    const r = howBaseTypeMatches(t1, t2.slice(1));
    return r != null ? (r + 1) : r;
  }
  return null;
}

const getAfterIndexType = (type: string, environments: Environment[]): string | null => {
  if (type.startsWith('*')) return type.slice(1);
  if (type === 'String') return 'Char';
  const typeInfo = tryGetType(environments, type);
  if (!typeInfo || typeInfo.type === 'built-in') return null;
  return getAfterIndexType(typeInfo.data.definition.value, environments);
}

const isIntegerType = (type: string): boolean => {
  return type === 'Int' || isUnsignedIntegerType(type) || isSignedIntegerType(type);
}

const isUnsignedIntegerType = (type: string): boolean => {
  return type === 'UInt' || /^U\d+$/.test(type);
}

const isSignedIntegerType = (type: string): boolean => {
  return type === 'SInt' || /^S\d+$/.test(type);
}

const doesArrayTypeMatch = (type: string, toMatch: string): boolean => {
  if (!type.startsWith('*') || !toMatch.startsWith('*')) return false;
  return doesTypeMatch(type.slice(1), toMatch.slice(1));
}

const doesTypeMatch = (type: string, toMatch: string): boolean => {
  if (type === toMatch) return true;
  if (toMatch.startsWith('@')) return true;
  if (toMatch === 'UInt' && isUnsignedIntegerType(type)) {
    return true;
  }
  if ((toMatch === 'Int' || toMatch === 'SInt') && isSignedIntegerType(type)) {
    return true;
  }
  return doesArrayTypeMatch(type, toMatch);
}