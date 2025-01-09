import { Diagnostic, DiagnosticSeverity, Range, TextDocument } from "vscode";
import { getRecoveryIssues } from "./parsers/base";
import { diagnostics, log, tokensData } from "./storage";
import { languageParser } from "./parser";
import { isFailure, ParseError, Parser } from "parser-combinators";
import {
  FunctionDeclaration,
  FunctionKind,
  IfStatement,
  ParserOutput,
  Statement,
  SwitchStatement,
  TokenRange,
  TypeDefinition,
  VariableDeclaration,
  VariableKind,
  VariableModification,
  WhileStatement,
} from "./parsers/ast";
import { IndexRValue, RValue } from "./parsers/rvalue";

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
): [ParserOutput | null, Diagnostic[]] => {
  const fullText = document.getText();
  const diags: Diagnostic[] = [];
  const startTime = Date.now();

  let parseResult: ParserOutput | null = null;
  try {
    parseResult = useParser(fullText, languageParser);
  } catch (p: unknown) {
    if (p instanceof ParseError) {
      const position = document.positionAt(p.index);
      diags.push(
        new Diagnostic(
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
        new Diagnostic(
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
        new Diagnostic(
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

export type Environment = Map<string, ['user-defined', VariableKind | FunctionKind, TokenRange] | ['built-in', VariableKind | FunctionKind, string]>;

export const checkVariableExistence = (
  document: TextDocument,
  result: (Statement | FunctionDeclaration | TypeDefinition)[],
  environments: Environment[],
  diagnostics: Diagnostic[]
) => {
  result.forEach(scope => {
    switch (scope.type) {
      case 'declaration': {
        diagnostics.push(...processRValue(document, environments, scope.value));
        const kind = tryGetVariable(environments, scope.name.value.name);
        if (kind !== null) {
          diagnostics.push(new Diagnostic(
            new Range(
              document.positionAt(scope.name.start),
              document.positionAt(scope.name.end)
            ),
            `You should not redeclare variables: '${scope.name.value.name}'`,
            DiagnosticSeverity.Warning
          ));
        } else {
          environments[environments.length - 1].set(scope.name.value.name, [
            'user-defined',
            scope.kind.value,
            scope.name,
          ]);
          tokensData.push({
            definition: scope.name,
            position: scope.name,
            info: {
              range: {
                start: scope.kind.start,
                end: scope.name.end
              }
            }
          });
        }
        break;
      }
      case 'modification': {
        diagnostics.push(...processRValue(document, environments, scope.value));
        if (scope.name.type === 'variable') {
          const kind = tryGetVariable(environments, scope.name.value.value.name);
          if (kind === null) {
            diagnostics.push(new Diagnostic(
              new Range(
                document.positionAt(scope.name.value.start),
                document.positionAt(scope.name.value.end)
              ),
              `Cannot find name '${scope.name.value.value.name}'`
            ));
          } else {
            tokensData.push({
              definition: kind[2],
              position: scope.name.value,
            });
            if (kind[1] !== "var") {
              diagnostics.push(new Diagnostic(
                new Range(
                  document.positionAt(scope.name.value.start),
                  document.positionAt(scope.name.value.end)
                ),
                `Cannot assign to '${scope.name.value.value.name}' because it is a constant`
              ));
            }
          }
        } else {
          const index = scope.name as IndexRValue;
          diagnostics.push(...processRValue(document, environments, index.parameter));
          diagnostics.push(...processRValue(document, environments, index.value));
        }
        break;
      }
      case "function": {
        const kind = tryGetDefFunction(
          environments,
          scope.value.value
        );
        if (kind === null) {
          diagnostics.push(
            new Diagnostic(
              new Range(
                document.positionAt(scope.value.start),
                document.positionAt(scope.value.end)
              ),
              `Cannot find name '${scope.value.value}'`
            )
          );
        } else {
          tokensData.push({
            definition: kind[1],
            position: scope.value
          });
        }
        diagnostics.push(...processRValue(document, environments, scope));
        break;
      }
      case 'return': {
        if (scope.value) {
          diagnostics.push(...processRValue(document, environments, scope.value));
        }
        break;
      }
      case 'statements': {
        const nextEnvironments: Environment[] = [
          ...environments,
          new Map(),
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
        const kind = tryGetVariable(
          environments,
          scope.value.value.name
        );
        if (kind === null) {
          diagnostics.push(
            new Diagnostic(
              new Range(
                document.positionAt(scope.value.start),
                document.positionAt(scope.value.end)
              ),
              `Cannot find name '${scope.value.value.name}'`
            )
          );
        } else {
          tokensData.push({
            definition: kind[2],
            position: scope.value
          });
        }
        break;
      }
      case "function-declaration": {
        if (scope.definition.type === 'function') {
          const kind = scope.definition.kind === 'def'
            ? tryGetDefFunction(environments, scope.definition.name.value)
            : tryGetDotFunction(environments, scope.definition.name.value);
          if (scope.definition.kind === 'dot') {
            if (scope.definition.parameters.length === 0) {
              diagnostics.push(new Diagnostic(
                new Range(
                  document.positionAt(scope.definition.name.end),
                  document.positionAt(scope.definition.returnType.start)
                ),
                `Dot function should have at least one parameter`,
                DiagnosticSeverity.Error
              ));
            }
          }
          if (kind !== null) {
            diagnostics.push(new Diagnostic(
              new Range(
                document.positionAt(scope.definition.name.start),
                document.positionAt(scope.definition.name.end)
              ),
              `You should not redeclare functions: '${scope.definition.name.value}'`,
              DiagnosticSeverity.Warning
            ));
          } else {
            const currentEnv = environments[environments.length - 1];
            currentEnv.set(scope.definition.name.value, ['user-defined', scope.definition.kind, scope.definition.name]);
            tokensData.push({
              definition: scope.definition.name,
              position: scope.definition.name,
              info: {
                range: scope.definition.name
              }
            });
          }
        } else {
          if (scope.definition.kind === 'binary') {
            if (scope.definition.parameters.length > 2) {
              scope.definition.parameters.slice(2).forEach(param => {
                diagnostics.push(new Diagnostic(
                  new Range(
                    document.positionAt(param.name.start),
                    document.positionAt(param.type.end)
                  ),
                  `Binary operators should have two parameters`,
                  DiagnosticSeverity.Error
                ));
              });
            } else if (scope.definition.parameters.length < 2) {
              diagnostics.push(new Diagnostic(
                new Range(
                  document.positionAt(scope.definition.name.end),
                  document.positionAt(scope.definition.returnType.start)
                ),
                `Binary operators should have two parameters`,
                DiagnosticSeverity.Error
              ));
            }
          } else {
            if (scope.definition.parameters.length > 1) {
              scope.definition.parameters.slice(1).forEach(param => {
                diagnostics.push(new Diagnostic(
                  new Range(
                    document.positionAt(param.name.start),
                    document.positionAt(param.type.end)
                  ),
                  `Unary operators should have one parameter`,
                  DiagnosticSeverity.Error
                ));
              });
            } else if (scope.definition.parameters.length < 1) {
              diagnostics.push(new Diagnostic(
                new Range(
                  document.positionAt(scope.definition.name.end),
                  document.positionAt(scope.definition.returnType.start)
                ),
                `Unary operators should have one parameter`,
                DiagnosticSeverity.Error
              ));
            }
          }
          if (!scope.definition.name.value.startsWith('=') && scope.definition.name.value.endsWith('=')) {
            if (scope.definition.returnType.value) {
              diagnostics.push(new Diagnostic(
                new Range(
                  document.positionAt(scope.definition.returnType.start),
                  document.positionAt(scope.definition.returnType.end)
                ),
                `Assignment operators should not return anything`,
                DiagnosticSeverity.Error
              ));
            }
            if (scope.definition.parameters.length > 0) {
              if (scope.definition.parameters[0].name.value.front !== '$') {
                diagnostics.push(new Diagnostic(
                  new Range(
                    document.positionAt(scope.definition.parameters[0].name.start),
                    document.positionAt(scope.definition.parameters[0].name.end)
                  ),
                  `The first parameter of an assignment operator should be mutable`,
                  DiagnosticSeverity.Error
                ));
              }
            }
          } else {
            if (!scope.definition.returnType.value) {
              diagnostics.push(new Diagnostic(
                new Range(
                  document.positionAt(scope.definition.returnType.start),
                  document.positionAt(scope.definition.returnType.end)
                ),
                `Missing return type`,
                DiagnosticSeverity.Error
              ));
            }
          }
        }
        const nextEnvironments: Environment[] = [...environments, new Map()];
        scope.definition.parameters.forEach((parameter) => {
          const env = nextEnvironments[nextEnvironments.length - 1];
          const variableName = parameter.name.value;
          if (variableName.front === "$") {
            env.set(variableName.name, ['user-defined', "var", parameter.name]);
            tokensData.push({
              definition: parameter.name,
              position: parameter.name,
              info: {
                range: {
                  start: parameter.name.start,
                  end: parameter.type.end
                }
              }
            });
          } else {
            env.set(variableName.name, ['user-defined', "const", parameter.name]);
            tokensData.push({
              definition: parameter.name,
              position: parameter.name,
              info: {
                range: {
                  start: parameter.name.start,
                  end: parameter.type.end
                }
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
        diagnostics.push(...processRValue(document, environments, scope.value));
        const nextIfEnvironments: Environment[] = [...environments, new Map()];
        checkVariableExistence(
          document,
          scope.ifBlock,
          nextIfEnvironments,
          diagnostics
        );
        scope.elifBlocks.forEach((elif) => {
          diagnostics.push(...processRValue(document, environments, elif.value));
          const nextElifEnvironments: Environment[] = [
            ...environments,
            new Map(),
          ];
          checkVariableExistence(
            document,
            elif.statements,
            nextElifEnvironments,
            diagnostics
          );
        });
        const nextElseEnvironments: Environment[] = [
          ...environments,
          new Map(),
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
              const kind = tryGetVariable(
                environments,
                oneCase.caseName.value.name
              );
              if (kind === null) {
                diagnostics.push(
                  new Diagnostic(
                    new Range(
                      document.positionAt(oneCase.caseName.start),
                      document.positionAt(oneCase.caseName.end)
                    ),
                    `Cannot find name '${oneCase.caseName.value.name}'`
                  )
                );
              } else {
                tokensData.push({
                  definition: kind[2],
                  position: oneCase.caseName
                });
              }
            }
          }
          const nextCaseEnvironments: Environment[] = [
            ...environments,
            new Map(),
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
        diagnostics.push(...processRValue(document, environments, scope.value));
        const nextEnvironments: Environment[] = [...environments, new Map()];
        checkVariableExistence(
          document,
          scope.statements,
          nextEnvironments,
          diagnostics
        );
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
): Diagnostic[] => {
  const results: Diagnostic[] = [];
  switch (rValue.type) {
    case 'number':
    case 'string': {
      // Nothing to do here
      break;
    }
    case 'interpolated': {
      rValue.inserts.forEach(i => {
        results.push(...processRValue(document, environments, i.value));
      });
      break;
    }
    case 'variable': {
      const kind = tryGetVariable(environments, rValue.value.value.name);
      if (kind === null) {
        results.push(new Diagnostic(
          new Range(
            document.positionAt(rValue.value.start),
            document.positionAt(rValue.value.end)
          ),
          `Cannot find name '${rValue.value.value.name}'`
        ));
      } else {
        tokensData.push({
          definition: kind[2],
          position: rValue.value,
        });
      }
      break;
    }
    case 'cast': {
      results.push(...processRValue(document, environments, rValue.value));
      break;
    }
    case 'array': {
      rValue.values.forEach(v => {
        results.push(...processRValue(document, environments, v));
      });
      break;
    }
    case 'index': {
      results.push(...processRValue(document, environments, rValue.value));
      results.push(...processRValue(document, environments, rValue.parameter));
      break;
    }
    case 'unary': {
      results.push(...processRValue(document, environments, rValue.value));
      break;
    }
    case 'binary': {
      results.push(...processRValue(document, environments, rValue.left));
      results.push(...processRValue(document, environments, rValue.right));
      break;
    }
    case 'ternary': {
      results.push(...processRValue(document, environments, rValue.condition));
      results.push(...processRValue(document, environments, rValue.ifTrue));
      results.push(...processRValue(document, environments, rValue.ifFalse));
      break;
    }
    case 'dotMethod': {
      results.push(...processRValue(document, environments, rValue.object));
      rValue.parameters.forEach(p => {
        results.push(...processRValue(document, environments, p));
      });
      const kind = tryGetDotFunction(
        environments,
        rValue.value.value
      );
      if (kind === null) {
        results.push(
          new Diagnostic(
            new Range(
              document.positionAt(rValue.value.start),
              document.positionAt(rValue.value.end)
            ),
            `Cannot find name '${rValue.value.value}'`
          )
        );
      } else {
        tokensData.push({
          definition: kind[1],
          position: rValue.value
        });
      }
      break;
    }
    case 'function': {
      rValue.parameters.forEach(p => {
        results.push(...processRValue(document, environments, p));
      });
      const kind = tryGetDefFunction(
        environments,
        rValue.value.value
      );
      if (kind === null) {
        results.push(
          new Diagnostic(
            new Range(
              document.positionAt(rValue.value.start),
              document.positionAt(rValue.value.end)
            ),
            `Cannot find name '${rValue.value.value}'`
          )
        );
      } else {
        tokensData.push({
          definition: kind[1],
          position: rValue.value
        });
      }
      break;
    }
  }
  return results;
};

const tryGetVariable = (
  environments: Environment[],
  name: string
): ['user-defined', VariableKind, TokenRange] | ['built-in', VariableKind, string] | null => {
  for (let index = environments.length - 1; index >= 0; index--) {
    const kind = environments[index].get(name);
    if (kind !== undefined && kind[1] !== 'def' && kind[1] !== 'dot') {
      return kind as ['user-defined', VariableKind, TokenRange] | ['built-in', VariableKind, string];
    }
  }
  return null;
};

const tryGetDotFunction = (
  environments: Environment[],
  name: string
): ['user-defined', TokenRange] | ['built-in', string] | null => {
  for (let index = environments.length - 1; index >= 0; index--) {
    const kind = environments[index].get(name);
    if (kind !== undefined && kind[1] === 'dot') {
      return [kind[0], kind[2]] as ['user-defined', TokenRange] | ['built-in', string];
    }
  }
  return null;
};

const tryGetDefFunction = (
  environments: Environment[],
  name: string
): ['user-defined', TokenRange] | ['built-in', string] | null => {
  for (let index = environments.length - 1; index >= 0; index--) {
    const kind = environments[index].get(name);
    if (kind !== undefined && kind[1] === 'def') {
      return [kind[0], kind[2]] as ['user-defined', TokenRange] | ['built-in', string];
    }
  }
  return null;
};