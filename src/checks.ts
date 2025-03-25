import { DiagnosticSeverity, Range, TextDocument } from "vscode";
import { getRecoveryIssues } from "./parsers/base";
import { log, tokensData } from "./storage";
import { languageParser } from "./parser";
import { isFailure, ParseError, Parser } from "parser-combinators";
import {
  FunctionDefinition,
  ParserOutput,
  Statement,
  StatementsBlock,
  Token,
  VariableName,
} from "./parsers/types/ast";
import { SimplexDiagnostic } from './SimplexDiagnostic';
import { RValue } from "./parsers/types/rvalue";
import { StaticValue, Environment, sameStaticValue } from "./environment";
import { composeTypeDefinition, doesTypeMatch, filterOnlyConst, getAfterIndexType, getCloseDef, getCloseDot, getCloseType, getCloseVariable, getDotFunctionsFor, getIntSigned, getIntSize, isEnumType, isIntAssignableTo, isIntegerType, transformGenericType, tryGetBinaryOperator, tryGetDefFunction, tryGetDotFunction, tryGetReturnType, tryGetType, tryGetUnaryOperator, tryGetVariable, typeStringToTypeToken, typeTokenToTypeString } from "./typeSetup";
import { explicitReturn, typeCheck } from "./workspace";
import { clearTimings } from "./parsers/utils";

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
  clearTimings();

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
  logg(`Time spent parsing: ${Date.now() - startTime}ms`);

  return [parseResult, diags];
};

let logging = false;

const logg = (v: string) => logging && log.appendLine(v);

const newScope = (): Environment => ({
  type: 'scope',
  switchTypes: new Map(),
  functions: [],
  operators: [],
  types: new Map(),
  variables: new Map()
});

const newFunction = (returnType: string | null): Environment => ({
  type: 'function',
  switchTypes: new Map(),
  functions: [],
  operators: [],
  types: new Map(),
  variables: new Map(),
  returnType
});

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
            if (Array.isArray(scope.definition.value)) {
              scope.definition.value.forEach(v => {
                currentEnv.variables.set(v, {
                    type: 'built-in',
                    kind: 'const',
                    data: `A \`${v}\` value of enum ${scope.name.value}`,
                    varType: scope.name.value
                  });
              });
              currentEnv.operators.push({
                type: 'built-in',
                kind: 'binary',
                name: '==',
                data: `Checks if the first ${scope.name.value} value is equal to the second`,
                parameterTypes: [scope.name.value, scope.name.value],
                returnType: 'Bool'
              });
              currentEnv.operators.push({
                type: 'built-in',
                kind: 'binary',
                name: '!=',
                data: `Checks if the first ${scope.name.value} value is not equal to the second`,
                parameterTypes: [scope.name.value, scope.name.value],
                returnType: 'Bool'
              });
            } else {
              currentEnv.types.set(scope.name.value, {
                type: 'user-defined',
                data: scope
              });
            }
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
        diagnostics.push(...checkForSimplification(scope.value, document));
        if (scope.kind.value === 'const') {
          if (scope.name.value.name.search(/[a-z]/) >= 0) {
            diagnostics.push(new SimplexDiagnostic(
              new Range(
                document.positionAt(scope.name.start),
                document.positionAt(scope.name.end)
              ),
              `Constants have to use only uppercase letters`,
              DiagnosticSeverity.Error
            ));
          }
        } else {
          if (scope.name.value.name.substring(0, 1).search(/[A-Z]/) >= 0) {
            diagnostics.push(new SimplexDiagnostic(
              new Range(
                document.positionAt(scope.name.start),
                document.positionAt(scope.name.end)
              ),
              `Variables have to start with a lowercase letter`,
              DiagnosticSeverity.Error
            ));
          }
        }
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
          const varType = getType(
            scope.value,
            document,
            scope.kind.value === 'const'
              ? filterOnlyConst(environments)
              : environments,
            diagnostics
          );
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
        diagnostics.push(...checkForSimplification(scope.value, document));
        const left = getType(scope.name, document, environments, diagnostics);
        const right = getType(scope.value, document, environments, diagnostics);
        if (typeCheck() && left !== right) {
          if (!isIntegerType(left) || scope.value.value.type !== 'number') {
            if (isIntegerType(left) && isIntegerType(right)) {
              if (!isIntAssignableTo(left, right)) {
                diagnostics.push(new SimplexDiagnostic(
                  new Range(
                    document.positionAt(scope.value.start),
                    document.positionAt(scope.value.end)
                  ),
                  `Cannot assign a value of type ${typeTokenToTypeString(right)} to a variable of type ${typeTokenToTypeString(left)} - it will not fit!`
                ));
              }
            } else {
              diagnostics.push(new SimplexDiagnostic(
                new Range(
                  document.positionAt(scope.value.start),
                  document.positionAt(scope.value.end)
                ),
                `Cannot assign a value of type ${typeTokenToTypeString(right)} to a variable of type ${typeTokenToTypeString(left)}`
              ));
            }
          } else {
            const signed = getIntSigned(left)
            const size = getIntSize(left)

            if (!signed && scope.value.value.value < 0) {
              diagnostics.push(new SimplexDiagnostic(
                new Range(
                  document.positionAt(scope.value.start),
                  document.positionAt(scope.value.end)
                ),
                `A negative value cannot be assigned to ${typeTokenToTypeString(left)}`
              ));
            }
            if (size < BigInt(scope.value.value.value)) {
              diagnostics.push(new SimplexDiagnostic(
                new Range(
                  document.positionAt(scope.value.start),
                  document.positionAt(scope.value.end)
                ),
                `This value is too large to be assigned to ${typeTokenToTypeString(left)}`
              ));
            }
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
              const closeVariable = getCloseVariable(environments, scope.name.value.value.value.name);
              if (closeVariable) {
                return [
                  new SimplexDiagnostic(
                    new Range(
                      document.positionAt(scope.name.start),
                      document.positionAt(scope.name.end)
                    ),
                    `Cannot find name '${scope.name.value.value.value.name}' - did you mean '${closeVariable}'?`
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
        } else if (scope.name.value.type === 'cast') {
          const cast = scope.name.value;
          const newType = checkType(cast.to, document, environments, diagnostics);
          diagnostics.push(...processRValue(document, environments, cast.value.value));
          diagnostics.push(...checkForSimplification(cast.value, document));
          diagnostics.push(new SimplexDiagnostic(
            new Range(
              document.positionAt(scope.name.start),
              document.positionAt(scope.name.end)
            ),
            newType?.startsWith('*')
              ? `Cannot assign to a casted value - did you mean to assign to an element of it?`
              : `Cannot assign to a casted value`
          ));
        } else {
          const index = scope.name.value;
          diagnostics.push(...processRValue(document, environments, index.parameter.value));
          diagnostics.push(...checkForSimplification(index.parameter, document));
          diagnostics.push(...processRValue(document, environments, index.value.value));
          diagnostics.push(...checkForSimplification(index.value, document));
        }
        break;
      }
      case 'return': {
        if (scope.value.value) {
          diagnostics.push(...processRValue(document, environments, scope.value.value));
          diagnostics.push(...checkForSimplification(scope.value, document));
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
        const nextEnvironments: Environment[] = [...environments, newScope()];
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
        checkMethodConstraints(scope.definition, diagnostics, document);
        const nextEnvironments: Environment[] = [...environments, newFunction(scope.definition.returnType.value)];
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
        addAssumptions(document, nextEnvironments, scope.definition.assumptions, diagnostics);
        checkVariableExistence(
          document,
          scope.statements,
          nextEnvironments,
          diagnostics
        );
        if (explicitReturn() && scope.definition.returnType.value) {
          if (!doesReturn(document, scope.statements, nextEnvironments, diagnostics)) {
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
        break;
      }
      case "if": {
        diagnostics.push(...processRValue(document, environments, scope.value.value));
        diagnostics.push(...checkForSimplification(scope.value, document));
        const nextIfEnvironments: Environment[] = [...environments, newScope()];
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
          diagnostics.push(...checkForSimplification(elif.value, document));
          const nextElifEnvironments: Environment[] = [...environments, newScope()];
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
        const nextElseEnvironments: Environment[] = [...environments, newScope()];
        checkVariableExistence(
          document,
          scope.elseBlock,
          nextElseEnvironments,
          diagnostics
        );
        break;
      }
      case "switch": {
        const varType = getType(scope.value, document, environments, diagnostics);
        const caseValues: StaticValue[] = [];
        scope.cases.forEach((oneCase) => {
          if (oneCase.caseName.value === 'default') {
            if (typeCheck() && caseValues.some(v => v.type === 'default')) {
              diagnostics.push(new SimplexDiagnostic(
                new Range(
                  document.positionAt(oneCase.caseName.start),
                  document.positionAt(oneCase.caseName.end)
                ),
                `The switch block already has a default case`
              ));
            }
            caseValues.push({ type: 'default' });
          } else {
            const caseName = oneCase.caseName as Token<RValue>;
            const caseType = getType(caseName, document, environments, diagnostics);
            diagnostics.push(...processRValue(document, environments, caseName.value));
            diagnostics.push(...checkForSimplification(caseName, document));
            if (typeCheck()) {
              if (varType !== caseType) {
                if (!isIntegerType(varType) || caseName.value.type !== 'number') {
                  diagnostics.push(new SimplexDiagnostic(
                    new Range(
                      document.positionAt(caseName.start),
                      document.positionAt(caseName.end)
                    ),
                    `The switch block condition is of type ${typeTokenToTypeString(varType)} but the case value is of type ${typeTokenToTypeString(caseType)}`
                  ));
                }
              }
              if (varType === 'String' || isIntegerType(varType)) {
                const caseStaticValue: StaticValue = getStaticValue(caseName);
                if (caseValues.some(v => sameStaticValue(v, caseStaticValue))) {
                  diagnostics.push(new SimplexDiagnostic(
                    new Range(
                      document.positionAt(oneCase.caseName.start),
                      document.positionAt(oneCase.caseName.end)
                    ),
                    `This switch block already has this case specified`
                  ));
                }
                caseValues.push(caseStaticValue);
              }
            }
          }
          const nextCaseEnvironments: Environment[] = [...environments, newScope()];
          checkVariableExistence(
            document,
            oneCase.statements,
            nextCaseEnvironments,
            diagnostics
          );
        });
        diagnostics.push(...processRValue(document, environments, scope.value.value));
        diagnostics.push(...checkForSimplification(scope.value, document));
        environments[environments.length - 1]
          .switchTypes
          .set(`${scope.value.start}_${scope.value.end}`, [varType, caseValues]);
        break;
      }
      case "while": {
        diagnostics.push(...processRValue(document, environments, scope.value.value));
        diagnostics.push(...checkForSimplification(scope.value, document));
        const nextEnvironments: Environment[] = [...environments, newScope()];
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
      case 'break': {
        break;
      }
      case 'continue': {
        break;
      }
      default: {
        diagnostics.push(...processRValue(document, environments, scope));
        break;
      }
    }
  });
};

const addAssumptions = (document: TextDocument, environments: Environment[], assumptions: FunctionDefinition[], diagnostics: SimplexDiagnostic[]): void => {
  const env = environments[environments.length - 1];
  assumptions.forEach(a => {
    checkMethodConstraints(a, diagnostics, document);
    const paramTypes = a.parameters.map((parameter) => {
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
      return varType ?? '?';
    });

    const returnType = checkType(a.returnType, document, environments, diagnostics);
    if (typeCheck() && a.returnType.value && !returnType) {
      diagnostics.push(new SimplexDiagnostic(
        new Range(
          document.positionAt(a.returnType.start),
          document.positionAt(a.returnType.end)
        ),
        `Missing type: '${a.returnType.value}'`
      ));
    }

    if (a.type === 'function') {
      env.functions.push({
        type: 'user-defined',
        kind: a.kind,
        name: a.name.value,
        data: a.name,
        parameterTypes: paramTypes,
        returnType: returnType
      });
    } else {
      env.operators.push({
        type: 'user-defined',
        kind: a.kind,
        name: a.name.value,
        data: a.name,
        parameterTypes: paramTypes,
        returnType: returnType ?? '?'
      });
    }
    tokensData.push({
      definition: a.name,
      position: a.name,
      info: {
        range: a.name
      }
    });
  });
}

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
        const closeDot = getCloseDot(
          environments,
          rValue.value.value,
          [rValue.object, ...rValue.parameters].map(p => getType(p, document, environments, results))
        );
        if (closeDot) {
          results.push(
            new SimplexDiagnostic(
              new Range(
                document.positionAt(rValue.value.start),
                document.positionAt(rValue.value.end)
              ),
              `Cannot find name '${rValue.value.value}' - did you mean '${closeDot}'?`
            )
          );
        } else {
          results.push(
            new SimplexDiagnostic(
              new Range(
                document.positionAt(rValue.value.start),
                document.positionAt(rValue.value.end)
              ),
              `Cannot find name '${rValue.value.value}'`
            )
          );
        }
      } else {
        tokensData.push({
          definition: kind.data,
          position: {
            start: rValue.value.start,
            end: rValue.parameters.reduce((c, n) => Math.max(c, n.end), rValue.value.end + 1) + 1
          },
          info: {
            dotFunctionSuggestions: getDotFunctionsFor(environments, kind.returnType ?? '?')
          }
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
          position: {
            start: rValue.value.start,
            end: rValue.parameters.reduce((c, n) => Math.max(c, n.end), rValue.value.end + 1) + 1
          },
          info: {
            type: kind.returnType ?? undefined,
            dotFunctionSuggestions: getDotFunctionsFor(environments, kind.returnType ?? '?')
          }
        });
      }
      break;
    }
    case "parenthesis": {
      results.push(...processRValue(document, environments, rValue.value.value));
      break;
    }
    case '_default': {
      getType({
        start: rValue.typeValue.start,
        end: rValue.typeValue.end,
        value: rValue
      }, document, environments, results);
      const kind = tryGetDefFunction(
        environments,
        rValue.type,
        ['@']
      );
      if (kind !== null) {
        tokensData.push({
          definition: kind.data,
          position: {
            start: rValue.typeValue.start - 9,
            end: rValue.typeValue.end + 1
          },
          info: {
            type: kind.returnType ?? undefined,
            dotFunctionSuggestions: getDotFunctionsFor(environments, kind.returnType ?? '?')
          }
        });
      }
      break;
    }
    default: {
      const x: never = rValue;
      throw x;
    }
  }
  return results;
};

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
      const closeVariable = getCloseVariable(environments, nameToken.value.name);
      if (closeVariable) {
        return [
          new SimplexDiagnostic(
            new Range(
              document.positionAt(nameToken.start),
              document.positionAt(nameToken.end)
            ),
            `Cannot find name '${nameToken.value.name}' - did you mean '${closeVariable}'?`
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
    }
  } else {
    tokensData.push({
      definition: kind.data,
      position: nameToken,
      info: {
        type: kind.varType ?? '?',
        dotFunctionSuggestions: getDotFunctionsFor(environments, kind.varType ?? '?')
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
    const closeType = getCloseType(environments, typeName);
    if (closeType) {
      diagnostics.push(new SimplexDiagnostic(
        new Range(
          document.positionAt(typeToken.start),
          document.positionAt(typeToken.end)
        ),
        `Cannot find type: '${typeToken.value}' - did you mean '${closeType}'?`
      ));
    } else {
      diagnostics.push(new SimplexDiagnostic(
        new Range(
          document.positionAt(typeToken.start),
          document.positionAt(typeToken.end)
        ),
        `Cannot find type: '${typeToken.value}'`
      ));
    }
  } else {
    tokensData.push({
      definition: envType.type === 'built-in'
        ? ';' + envType.data
        : composeTypeDefinition(envType.data),
      position: typeToken,
      info: {
        type: envType?.type,
      }
    });
  }
  return typeName;
}

const doesReturn = (document: TextDocument, statements: StatementsBlock, environments: Environment[], diagnostics: SimplexDiagnostic[]): boolean => {
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
        if (doesReturn(document, statement.ifBlock, environments, diagnostics)
          && doesReturn(document, statement.elseBlock, environments, diagnostics)
          && statement.elifBlocks.every(b => doesReturn(document, b.statements, environments, diagnostics))) {
          return true;
        }
        break;
      }
      case 'switch': {
        if (statement.cases.every(c => doesReturn(document, c.statements, environments, diagnostics))) {
          if (statement.cases.some(c => c.caseName.value === 'default')) {
            return true;
          }
          const currentEnv = environments[environments.length - 1];
          const switchData = currentEnv.switchTypes.get(`${statement.value.start}_${statement.value.end}`);
          if (switchData) {
            const enumData = isEnumType(switchData[0], environments);
            if (enumData) {
              if (switchData[1].every(s => s === undefined)) {
                if (new Set(switchData[1]).size === enumData.length) {
                  return true;
                } else {
                  diagnostics.push(new SimplexDiagnostic(
                    new Range(
                      document.positionAt(statement.value.start),
                      document.positionAt(statement.value.end)
                    ),
                    `The switch block over an enum does not check all the cases. Did you miss a default case?`,
                    DiagnosticSeverity.Warning
                  ));
                }
              }
            }
          }
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
      tokensData.push({
        definition: rValue.value.toString(),
        position: value,
        info: {
          type: 'Int',
          dotFunctionSuggestions: getDotFunctionsFor(environments, 'Int')
        }
      });
      return 'Int';
    case 'string':
    case 'interpolated':
      logg(`String: String`);
      tokensData.push({
        definition: rValue.value.toString(),
        position: value,
        info: {
          type: 'String',
          dotFunctionSuggestions: getDotFunctionsFor(environments, 'String')
        }
      });
      return 'String';
    case 'parenthesis': {
      const type = getType(rValue.value, document, environments, diagnostics);
      logg(`Parenthesis: ${type}`);
      tokensData.push({
        definition: "",
        position: value,
        info: {
          type: type,
          dotFunctionSuggestions: getDotFunctionsFor(environments, type)
        }
      });
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
        const closeFunc = getCloseDef(environments, rValue.value.value, paramTypes);
        if (closeFunc) {
          diagnostics.push(
            new SimplexDiagnostic(
              new Range(
                document.positionAt(rValue.value.start),
                document.positionAt(rValue.value.end)
              ),
              `Cannot find function '${rValue.value.value}(${paramTypes.map(typeTokenToTypeString).join(", ")})' - did you mean '${closeFunc}(${paramTypes.map(typeTokenToTypeString).join(", ")})'?`
            )
          );
        } else {
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
      getType(rValue.value, document, environments, diagnostics);
      const newType = typeStringToTypeToken(rValue.to.value);

      if (isIntegerType(newType) && rValue.value.value.type === 'number') {
        const signed = getIntSigned(newType)
        const size = getIntSize(newType)

        if (!signed && rValue.value.value.value < 0) {
          diagnostics.push(new SimplexDiagnostic(
            new Range(
              document.positionAt(rValue.value.start),
              document.positionAt(rValue.value.end)
            ),
            `A negative value cannot be casted to ${typeTokenToTypeString(newType)}`
          ));
        }
        if (size < BigInt(rValue.value.value.value)) {
          diagnostics.push(new SimplexDiagnostic(
            new Range(
              document.positionAt(rValue.value.start),
              document.positionAt(rValue.value.end)
            ),
            `This value is too large to be casted to ${typeTokenToTypeString(newType)}`
          ));
        }
      }
      logg(`Cast: ${newType}`);
      return newType;
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
      logg(`Variable: ${variableData?.varType ?? '?'}`);
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
    case '_default': {
      const type = checkType(rValue.typeValue, document, environments, diagnostics);
      if (typeCheck() && (!type || type.endsWith('?'))) {
        diagnostics.push(new SimplexDiagnostic(
          new Range(
            document.positionAt(rValue.typeValue.start),
            document.positionAt(rValue.typeValue.end)
          ),
          `Unknown type`
        ));
      }
      logg(`Type: ${type ?? '?'}`);
      tokensData.push({
        definition: "",
        position: value,
        info: {
          type: type ?? '?',
          dotFunctionSuggestions: getDotFunctionsFor(environments, type ?? '?')
        }
      });
      return type ?? '?';
    }
    default: {
      const x: never = rValue;
      throw x;
    }
  }
}

function checkMethodConstraints(definition: FunctionDefinition, diagnostics: SimplexDiagnostic[], document: TextDocument) {
  if (definition.type === 'function') {
    if (definition.kind === 'dot') {
      if (definition.parameters.length === 0) {
        diagnostics.push(new SimplexDiagnostic(
          new Range(
            document.positionAt(definition.name.end),
            document.positionAt(definition.returnType.start)
          ),
          `Dot function should have at least one parameter`
        ));
      }
    }
  } else {
    if (definition.kind === 'binary') {
      if (definition.parameters.length > 2) {
        definition.parameters.slice(2).forEach(param => {
          diagnostics.push(new SimplexDiagnostic(
            new Range(
              document.positionAt(param.name.start),
              document.positionAt(param.type.end)
            ),
            `Binary operators should have two parameters`
          ));
        });
      } else if (definition.parameters.length < 2) {
        diagnostics.push(new SimplexDiagnostic(
          new Range(
            document.positionAt(definition.name.end),
            document.positionAt(definition.returnType.start)
          ),
          `Binary operators should have two parameters`
        ));
      }
    } else {
      if (definition.parameters.length > 1) {
        definition.parameters.slice(1).forEach(param => {
          diagnostics.push(new SimplexDiagnostic(
            new Range(
              document.positionAt(param.name.start),
              document.positionAt(param.type.end)
            ),
            `Unary operators should have one parameter`
          ));
        });
      } else if (definition.parameters.length < 1) {
        diagnostics.push(new SimplexDiagnostic(
          new Range(
            document.positionAt(definition.name.end),
            document.positionAt(definition.returnType.start)
          ),
          `Unary operators should have one parameter`
        ));
      }
    }
    if (!definition.name.value.startsWith('=') && definition.name.value.endsWith('=')) {
      if (definition.returnType.value) {
        diagnostics.push(new SimplexDiagnostic(
          new Range(
            document.positionAt(definition.returnType.start),
            document.positionAt(definition.returnType.end)
          ),
          `Assignment operators should not return anything`
        ));
      }
      if (definition.parameters.length > 0) {
        if (definition.parameters[0].name.value.front !== '$') {
          diagnostics.push(new SimplexDiagnostic(
            new Range(
              document.positionAt(definition.parameters[0].name.start),
              document.positionAt(definition.parameters[0].name.end)
            ),
            `The first parameter of an assignment operator should be mutable`
          ));
        }
      }
    } else {
      if (!definition.returnType.value) {
        diagnostics.push(new SimplexDiagnostic(
          new Range(
            document.positionAt(definition.returnType.start),
            document.positionAt(definition.returnType.end)
          ),
          `Missing return type`
        ));
      }
    }
  }
}

const getStaticValue = (rvalue: Token<RValue>): StaticValue => {
  const complicated: StaticValue = { type: 'complicated' };
  switch (rvalue.value.type) {
    case "_default": {
      if (isIntegerType(rvalue.value.typeValue.value)) {
        return { type: 'number', value: 0 };
      }
      if (rvalue.value.typeValue.value === 'String') {
        return { type: 'string', value: "" };
      }
      return complicated;
    }
    case 'number': return { type: 'number', value: rvalue.value.value };
    case 'string': return { type: 'string', value: rvalue.value.value };

    case 'parenthesis':
      return getStaticValue(rvalue.value.value);
    case 'variable':
      return { type: 'variable', value: rvalue.value.value.value.front + rvalue.value.value.value.name };

    case 'unary': {
      const internal = getStaticValue(rvalue.value.value);
      if (internal.type !== 'number') {
        return complicated;
      }
      switch (rvalue.value.operator) {
        case '-': return { type: 'number', value: -internal.value };
        case '~': return { type: 'number', value: ~internal.value };
      }
      return complicated;
    }
    case 'binary': {
      const internalLeft = getStaticValue(rvalue.value.left);
      const internalRight = getStaticValue(rvalue.value.right);
      switch (internalLeft.type) {
        case 'number': {
          if (internalRight.type === 'number') {
            switch (rvalue.value.operator) {
              case '+': return { type: 'number', value: internalLeft.value + internalRight.value };
              case '-': return { type: 'number', value: internalLeft.value - internalRight.value };
              case '*': return { type: 'number', value: internalLeft.value * internalRight.value };
              case '/': return { type: 'number', value: internalLeft.value / internalRight.value };
              case '%': return { type: 'number', value: internalLeft.value % internalRight.value };
              case '&': return { type: 'number', value: internalLeft.value & internalRight.value };
              case '|': return { type: 'number', value: internalLeft.value | internalRight.value };
              case '^': return { type: 'number', value: internalLeft.value ^ internalRight.value };
              case '<<': return { type: 'number', value: internalLeft.value << internalRight.value };
              case '>>': return { type: 'number', value: internalLeft.value >> internalRight.value };
            }
          }
          return complicated;
        }
        case 'string': {
          if (internalRight.type === 'string') {
            if (rvalue.value.operator === '+') {
              return { type: 'string', value: internalLeft.value + internalRight.value };
            }
          }
          return complicated;
        }
        default: return complicated;
      }
    }

    case 'cast':
    case 'dotMethod':
    case 'array':
    case 'index':
    case 'function':
    case 'interpolated':
    case 'ternary':
      return complicated;

    default: {
      const x: never = rvalue.value;
      throw x;
    }
  }
}

const checkForSimplification = (rValue: Token<RValue | null>, document: TextDocument): SimplexDiagnostic[] => {
  if (rValue.value == null) return [];
  const rv = rValue as Token<RValue>;
  switch (rv.value.type) {
    case 'number':
    case 'string':
      return [];
    default: {
      const staticValue = getStaticValue(rv);
      if (staticValue.type === 'number') {
        return [
          new SimplexDiagnostic(
            new Range(
              document.positionAt(rv.start),
              document.positionAt(rv.end)
            ),
            `This value could be replaced with ${staticValue.value}`,
            DiagnosticSeverity.Hint
          )
        ]
      } else if (staticValue.type === 'string') {
        return [
          new SimplexDiagnostic(
            new Range(
              document.positionAt(rv.start),
              document.positionAt(rv.end)
            ),
            `This value could be replaced with "${staticValue.value}"`,
            DiagnosticSeverity.Hint
          )
        ]
      }
      return [];
    }
  }
}