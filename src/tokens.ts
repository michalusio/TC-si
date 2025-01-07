import {
  Diagnostic,
  DiagnosticSeverity,
  DocumentSemanticTokensProvider,
  Position,
  ProviderResult,
  Range,
  SemanticTokens,
  SemanticTokensBuilder,
  TextDocument,
} from "vscode";
import {
  aliasData,
  diagnostics,
  functionData,
  legend,
  log,
  parameterData,
  variableData,
} from "./storage";
import { isFailure, ParseError, Parser, ParseText } from "parser-combinators";
import { languageParser } from "./parser";
import { getRecoveryIssues } from "./parsers/base";

type ITypeAlias = {
  text: string;
  name: Range;
  type: Range;
};

let functionId = 0;

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

const getAllAliases = (document: TextDocument): ITypeAlias[] => {
  const result: ITypeAlias[] = [];
  for (let lineIndex = 0; lineIndex < document.lineCount; lineIndex++) {
    const line = document.lineAt(lineIndex);
    if (line.isEmptyOrWhitespace) continue;

    const lineParseResult = /^(type\s+)([A-Z]\w*)(\s+)([\w\]\[]+)/.exec(
      line.text
    );
    if (lineParseResult == null) continue;

    const keywordMatch = lineParseResult[1];
    const nameMatch = lineParseResult[2];
    const whitespaceMatch = lineParseResult[3];
    const typeMatch = lineParseResult[4];

    result.push({
      text: nameMatch,
      name: new Range(
        lineIndex,
        keywordMatch.length,
        lineIndex,
        keywordMatch.length + nameMatch.length
      ),
      type: new Range(
        lineIndex,
        keywordMatch.length + nameMatch.length + whitespaceMatch.length,
        lineIndex,
        keywordMatch.length +
          nameMatch.length +
          whitespaceMatch.length +
          typeMatch.length
      ),
    });
  }
  return result;
};

const getAliasUsages = (document: TextDocument, alias: string): Range[] => {
  const result: Range[] = [];
  for (let lineIndex = 0; lineIndex < document.lineCount; lineIndex++) {
    const lineText = document.lineAt(lineIndex).text;
    for (const match of lineText.matchAll(new RegExp(`\\b${alias}\\b`, "g"))) {
      result.push(
        new Range(lineIndex, match.index, lineIndex, match.index + alias.length)
      );
    }
  }
  return result;
};

type IFunction = {
  text: string | null;
  name: Range;
  scope: Range;
  parameters: IParameter[];
};

type IParameter = {
  text: string;
  name: Range;
};

type IVariable = {
  text: string;
  name: Range;
};

const getFunctionParameters = (document: TextDocument): IFunction[] => {
  const result: IFunction[] = [];
  for (let lineIndex = 0; lineIndex < document.lineCount; lineIndex++) {
    const line = document.lineAt(lineIndex);
    if (line.isEmptyOrWhitespace) continue;

    const lineParseResult =
      /^(\s*)(pub)?(\s*)(def|dot|binary|unary)(\s+)(\+|==|=|!=|>|<|-|&|\||\^|\*|\/|>>|<<|\w+)\(/.exec(
        line.text
      );
    if (lineParseResult == null) continue;
    const lprl = lineParseResult[0].length;

    const startScope = line.range.start;

    const endParseResult = /\)\s*(\[*[A-Z]\w*\]*)?\s*{$/.exec(
      line.text.slice(lprl)
    );
    if (endParseResult == null) continue;

    const parameters: IParameter[] = Array.from(
      line.text
        .slice(lprl, line.text.length - endParseResult[0].length)
        .matchAll(/(\$?\w+)(\s*:\s*)(\[*[A-Z]\w*\]*)/g)
    ).map((match) => ({
      text: `${functionId}'${match[1]}`,
      name: new Range(
        lineIndex,
        lprl + match.index + (match[1].startsWith("$") ? 1 : 0),
        lineIndex,
        lprl + match.index + match[1].length
      ),
    }));
    functionId++;

    const endCheck = new RegExp(`^${lineParseResult[1] ?? ""}}$`);
    let endScope: Position = line.range.end;
    for (
      let endLineIndex = lineIndex + 1;
      endLineIndex < document.lineCount;
      endLineIndex++
    ) {
      const endLine = document.lineAt(endLineIndex);
      if (endCheck.test(endLine.text)) {
        endScope = endLine.range.end;
        break;
      }
    }

    const nameIndex =
      (lineParseResult[1]?.length ?? 0) +
      (lineParseResult[2]?.length ?? 0) +
      (lineParseResult[3]?.length ?? 0) +
      (lineParseResult[4]?.length ?? 0) +
      (lineParseResult[5]?.length ?? 0);
    const text = /\w+/.test(lineParseResult[6])
      ? lineParseResult[4] + lineParseResult[6]
      : null;
    result.push({
      text,
      name: new Range(
        lineIndex,
        nameIndex,
        lineIndex,
        nameIndex + lineParseResult[6].length
      ),
      scope: new Range(startScope, endScope),
      parameters,
    });
  }
  return result;
};

const getFunctionUsages = (document: TextDocument, func: string): Range[] => {
  const result: Range[] = [];
  for (let lineIndex = 0; lineIndex < document.lineCount; lineIndex++) {
    const lineText = document.lineAt(lineIndex).text;
    for (const match of lineText.matchAll(new RegExp(`\\b${func}\\(`, "g"))) {
      result.push(
        new Range(lineIndex, match.index, lineIndex, match.index + func.length)
      );
    }
  }
  return result;
};

const getFunctionParameterUsages = (
  document: TextDocument,
  func: IFunction
): [string, Range][] => {
  const result: [string, Range][] = [];
  for (
    let lineIndex = func.scope.start.line + 1;
    lineIndex < func.scope.end.line;
    lineIndex++
  ) {
    const lineText = document.lineAt(lineIndex).text;
    for (const param of func.parameters) {
      const paramName = param.text.split("'")[1];
      const onlyParamName = paramName.startsWith("$")
        ? paramName.slice(1)
        : paramName;
      for (const match of lineText.matchAll(
        new RegExp(`(?<=[^\\w])${onlyParamName}(?=[^\\w])`, "g")
      )) {
        result.push([
          param.text,
          new Range(
            lineIndex,
            match.index,
            lineIndex,
            match.index + onlyParamName.length
          ),
        ]);
      }
    }
  }
  return result;
};

const getGlobalVariables = (document: TextDocument): IVariable[] => {
  const result: IVariable[] = [];
  for (let lineIndex = 0; lineIndex < document.lineCount; lineIndex++) {
    const lineText = document.lineAt(lineIndex).text;
    for (const match of lineText.matchAll(
      /^(const|let|var)(\s+)([A-Z_]+)(\s+)=/g
    )) {
      result.push({
        text: match[3],
        name: new Range(
          lineIndex,
          match.index + match[1].length + match[2].length,
          lineIndex,
          match.index + match[1].length + match[2].length + match[3].length
        ),
      });
    }
  }
  return result;
};

const getGlobalVariableUsages = (
  document: TextDocument,
  variable: string
): Range[] => {
  const result: Range[] = [];
  for (let lineIndex = 0; lineIndex < document.lineCount; lineIndex++) {
    const lineText = document.lineAt(lineIndex).text;
    for (const match of lineText.matchAll(
      new RegExp(`\\b${variable}\\b`, "g")
    )) {
      result.push(
        new Range(
          lineIndex,
          match.index,
          lineIndex,
          match.index + variable.length
        )
      );
    }
  }
  return result;
};

export const tokenProvider: DocumentSemanticTokensProvider = {
  provideDocumentSemanticTokens(
    document: TextDocument
  ): ProviderResult<SemanticTokens> {
    aliasData.clear();
    functionData.clear();
    parameterData.clear();
    variableData.clear();
    log.clear();
    getRecoveryIssues().length = 0;

    const fullDocumentRange = new Range(
      new Position(0, 0),
      document.lineAt(document.lineCount - 1).range.end
    );

    const tokensBuilder = new SemanticTokensBuilder(legend);
    diagnostics.clear();

    const fullText = document.getText();
    const diags: Diagnostic[] = [];
    const startTime = Date.now();
    try {
      const parseResult = useParser(fullText, languageParser);
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
            issue.kind === 'warning'
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
            issue.kind === 'warning'
            ? DiagnosticSeverity.Warning
            : DiagnosticSeverity.Error
          )
        );
      }
    }
    log.appendLine(`Time spent parsing: ${Date.now() - startTime}ms`);
    diagnostics.set(document.uri, diags);

    const variables = getGlobalVariables(document);
    for (const variable of variables) {
      tokensBuilder.push(variable.name, "variable", ["readonly"]);
      variableData.set(variable.text, [[fullDocumentRange, variable.name]]);
      const variableUsage = getGlobalVariableUsages(document, variable.text);
      for (const param of variableUsage) {
        if (param.intersection(variable.name) !== undefined) continue;
        variableData.get(variable.text)!.push([fullDocumentRange, param]);
        tokensBuilder.push(param, "variable", ["readonly"]);
      }
    }

    const typeAliases = getAllAliases(document);
    for (const alias of typeAliases) {
      tokensBuilder.push(alias.name, "type", ["declaration"]);
      tokensBuilder.push(alias.type, "type", ["definition"]);
      aliasData.set(alias.text, [alias.name]);
      const aliasUsage = getAliasUsages(document, alias.text);
      for (const usage of aliasUsage) {
        if (usage.intersection(alias.name) !== undefined) continue;
        aliasData.get(alias.text)!.push(usage);
      }
    }

    const functionParams = getFunctionParameters(document);
    for (const func of functionParams) {
      if (func.text != null) {
        functionData.set(func.text, [func.name]);
        const functionUsage = getFunctionUsages(
          document,
          document.getText(func.name)
        );
        for (const usage of functionUsage) {
          if (usage.intersection(func.name) !== undefined) continue;
          functionData.get(func.text)!.push(usage);
        }
      }
      for (const param of func.parameters) {
        tokensBuilder.push(param.name, "parameter", ["declaration"]);
        parameterData.set(param.text, [[func.scope, param.name]]);
      }
      const parametersUsage = getFunctionParameterUsages(document, func);
      for (const param of parametersUsage) {
        tokensBuilder.push(param[1], "parameter");
        parameterData.get(param[0])!.push([func.scope, param[1]]);
      }
    }
    log.show(true);

    return tokensBuilder.build();
  },
};
