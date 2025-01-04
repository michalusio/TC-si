"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vscode_1 = require("vscode");
const tokenTypes = ['type', 'parameter', 'variable'];
const tokenModifiers = ['declaration', 'definition', 'readonly'];
const legend = new vscode_1.SemanticTokensLegend(tokenTypes, tokenModifiers);
let aliasData = new Map();
let functionData = new Map();
let parameterData = new Map();
let variableData = new Map();
let functionId = 0;
const getAllAliases = (document) => {
    const result = [];
    for (let lineIndex = 0; lineIndex < document.lineCount; lineIndex++) {
        const line = document.lineAt(lineIndex);
        if (line.isEmptyOrWhitespace)
            continue;
        const lineParseResult = /^(type\s+)([A-Z]\w*)(\s+)([\w\]\[]+)/.exec(line.text);
        if (lineParseResult == null)
            continue;
        const keywordMatch = lineParseResult[1];
        const nameMatch = lineParseResult[2];
        const whitespaceMatch = lineParseResult[3];
        const typeMatch = lineParseResult[4];
        result.push({
            text: nameMatch,
            name: new vscode_1.Range(lineIndex, keywordMatch.length, lineIndex, keywordMatch.length + nameMatch.length),
            type: new vscode_1.Range(lineIndex, keywordMatch.length + nameMatch.length + whitespaceMatch.length, lineIndex, keywordMatch.length + nameMatch.length + whitespaceMatch.length + typeMatch.length)
        });
    }
    return result;
};
const getAliasUsages = (document, alias) => {
    const result = [];
    for (let lineIndex = 0; lineIndex < document.lineCount; lineIndex++) {
        const lineText = document.lineAt(lineIndex).text;
        for (const match of lineText.matchAll(new RegExp(`\\b${alias}\\b`, 'g'))) {
            result.push(new vscode_1.Range(lineIndex, match.index, lineIndex, match.index + alias.length));
        }
    }
    return result;
};
const getFunctionParameters = (document) => {
    const result = [];
    for (let lineIndex = 0; lineIndex < document.lineCount; lineIndex++) {
        const line = document.lineAt(lineIndex);
        if (line.isEmptyOrWhitespace)
            continue;
        const lineParseResult = /^(\s*)(pub)?(\s*)(def|dot|binary|unary)(\s+)(\+|==|=|!=|>|<|-|&|\||\^|\*|\/|>>|<<|\w+)\(/.exec(line.text);
        if (lineParseResult == null)
            continue;
        const lprl = lineParseResult[0].length;
        const startScope = line.range.start;
        const endParseResult = /\)\s*(\[*[A-Z]\w*\]*)?\s*{$/.exec(line.text.slice(lprl));
        if (endParseResult == null)
            continue;
        const parameters = Array.from(line.text
            .slice(lprl, line.text.length - endParseResult[0].length)
            .matchAll(/(\$?\w+)(\s*:\s*)(\[*[A-Z]\w*\]*)/g))
            .map(match => ({
            text: `${functionId}'${match[1]}`,
            name: new vscode_1.Range(lineIndex, lprl + match.index + (match[1].startsWith('$') ? 1 : 0), lineIndex, lprl + match.index + match[1].length)
        }));
        functionId++;
        const endCheck = new RegExp(`^${lineParseResult[1] ?? ""}}$`);
        let endScope = line.range.end;
        for (let endLineIndex = lineIndex + 1; endLineIndex < document.lineCount; endLineIndex++) {
            const endLine = document.lineAt(endLineIndex);
            if (endCheck.test(endLine.text)) {
                endScope = endLine.range.end;
                break;
            }
        }
        const nameIndex = (lineParseResult[1]?.length ?? 0)
            + (lineParseResult[2]?.length ?? 0)
            + (lineParseResult[3]?.length ?? 0)
            + (lineParseResult[4]?.length ?? 0)
            + (lineParseResult[5]?.length ?? 0);
        const text = /\w+/.test(lineParseResult[6]) ? (lineParseResult[4] + lineParseResult[6]) : null;
        result.push({
            text,
            name: new vscode_1.Range(lineIndex, nameIndex, lineIndex, nameIndex + lineParseResult[6].length),
            scope: new vscode_1.Range(startScope, endScope),
            parameters
        });
    }
    return result;
};
const getFunctionUsages = (document, func) => {
    const result = [];
    for (let lineIndex = 0; lineIndex < document.lineCount; lineIndex++) {
        const lineText = document.lineAt(lineIndex).text;
        for (const match of lineText.matchAll(new RegExp(`\\b${func}\\(`, 'g'))) {
            result.push(new vscode_1.Range(lineIndex, match.index, lineIndex, match.index + func.length));
        }
    }
    return result;
};
const getFunctionParameterUsages = (document, func) => {
    const result = [];
    for (let lineIndex = func.scope.start.line + 1; lineIndex < func.scope.end.line; lineIndex++) {
        const lineText = document.lineAt(lineIndex).text;
        for (const param of func.parameters) {
            const paramName = param.text.split("'")[1];
            const onlyParamName = paramName.startsWith('$') ? paramName.slice(1) : paramName;
            for (const match of lineText.matchAll(new RegExp(`(?<=[^\\w])${onlyParamName}(?=[^\\w])`, 'g'))) {
                result.push([
                    param.text,
                    new vscode_1.Range(lineIndex, match.index, lineIndex, match.index + onlyParamName.length)
                ]);
            }
        }
    }
    return result;
};
const getGlobalVariables = (document) => {
    const result = [];
    for (let lineIndex = 0; lineIndex < document.lineCount; lineIndex++) {
        const lineText = document.lineAt(lineIndex).text;
        for (const match of lineText.matchAll(/^(const|let|var)(\s+)([A-Z_]+)(\s+)=/g)) {
            result.push({
                text: match[3],
                name: new vscode_1.Range(lineIndex, match.index + match[1].length + match[2].length, lineIndex, match.index + match[1].length + match[2].length + match[3].length)
            });
        }
    }
    return result;
};
const getGlobalVariableUsages = (document, variable) => {
    const result = [];
    for (let lineIndex = 0; lineIndex < document.lineCount; lineIndex++) {
        const lineText = document.lineAt(lineIndex).text;
        for (const match of lineText.matchAll(new RegExp(`\\b${variable}\\b`, 'g'))) {
            result.push(new vscode_1.Range(lineIndex, match.index, lineIndex, match.index + variable.length));
        }
    }
    return result;
};
const tokenProvider = {
    provideDocumentSemanticTokens(document) {
        aliasData.clear();
        functionData.clear();
        parameterData.clear();
        variableData.clear();
        const fullDocumentRange = new vscode_1.Range(new vscode_1.Position(0, 0), document.lineAt(document.lineCount - 1).range.end);
        const tokensBuilder = new vscode_1.SemanticTokensBuilder(legend);
        const variables = getGlobalVariables(document);
        for (const variable of variables) {
            tokensBuilder.push(variable.name, 'variable', ['readonly']);
            variableData.set(variable.text, [[fullDocumentRange, variable.name]]);
            const variableUsage = getGlobalVariableUsages(document, variable.text);
            for (const param of variableUsage) {
                if (param.intersection(variable.name) !== undefined)
                    continue;
                variableData.get(variable.text).push([fullDocumentRange, param]);
                tokensBuilder.push(param, 'variable', ['readonly']);
            }
        }
        const typeAliases = getAllAliases(document);
        for (const alias of typeAliases) {
            tokensBuilder.push(alias.name, 'type', ['declaration']);
            tokensBuilder.push(alias.type, 'type', ['definition']);
            aliasData.set(alias.text, [alias.name]);
            const aliasUsage = getAliasUsages(document, alias.text);
            for (const usage of aliasUsage) {
                if (usage.intersection(alias.name) !== undefined)
                    continue;
                aliasData.get(alias.text).push(usage);
            }
        }
        const functionParams = getFunctionParameters(document);
        for (const func of functionParams) {
            if (func.text != null) {
                functionData.set(func.text, [func.name]);
                const functionUsage = getFunctionUsages(document, func.text);
                for (const usage of functionUsage) {
                    if (usage.intersection(func.name) !== undefined)
                        continue;
                    functionData.get(func.text).push(usage);
                }
            }
            for (const param of func.parameters) {
                tokensBuilder.push(param.name, 'parameter', ['declaration']);
                parameterData.set(param.text, [[func.scope, param.name]]);
            }
            const parametersUsage = getFunctionParameterUsages(document, func);
            for (const param of parametersUsage) {
                tokensBuilder.push(param[1], 'parameter');
                parameterData.get(param[0]).push([func.scope, param[1]]);
            }
        }
        return tokensBuilder.build();
    }
};
const selector = { language: 'si', scheme: 'file' };
vscode_1.languages.registerDocumentSemanticTokensProvider(selector, tokenProvider, legend);
const declarationProvider = {
    provideDeclaration(document, position, token) {
        const renameBase = getRenameBase(position);
        if (renameBase == null)
            return;
        switch (renameBase[0]) {
            case 'variable': {
                const variable = variableData.get(renameBase[1]);
                for (const [funcRange, variableRange] of variable) {
                    if (funcRange.contains(position)) {
                        return new vscode_1.Location(document.uri, variableRange);
                    }
                }
            }
            case 'alias': {
                return new vscode_1.Location(document.uri, aliasData.get(renameBase[1])[0]);
            }
            case 'function': {
                return new vscode_1.Location(document.uri, functionData.get(renameBase[1])[0]);
            }
            case 'parameter': {
                const param = parameterData.get(renameBase[1]);
                for (const [funcRange, paramRange] of param) {
                    if (funcRange.contains(position)) {
                        return new vscode_1.Location(document.uri, paramRange);
                    }
                }
            }
        }
    },
};
vscode_1.languages.registerDeclarationProvider(selector, declarationProvider);
const getRenameBase = (position) => {
    for (const variable of variableData) {
        for (const [_, variableRange] of variable[1]) {
            if (variableRange.contains(position)) {
                return ['variable', variable[0]];
            }
        }
    }
    for (const alias of aliasData) {
        for (const aliasRange of alias[1]) {
            if (aliasRange.contains(position)) {
                return ['alias', alias[0]];
            }
        }
    }
    for (const func of functionData) {
        for (const funcRange of func[1]) {
            if (funcRange.contains(position)) {
                return ['function', func[0]];
            }
        }
    }
    for (const param of parameterData) {
        for (const [_, paramRange] of param[1]) {
            if (paramRange.contains(position)) {
                return ['parameter', param[0]];
            }
        }
    }
    return null;
};
const renameProvider = {
    prepareRename(document, position, token) {
        for (const variable of variableData) {
            for (const [_, variableRange] of variable[1]) {
                if (variableRange.contains(position)) {
                    return variableRange;
                }
            }
        }
        for (const alias of aliasData) {
            for (const aliasRange of alias[1]) {
                if (aliasRange.contains(position)) {
                    return aliasRange;
                }
            }
        }
        for (const func of functionData) {
            for (const funcRange of func[1]) {
                if (funcRange.contains(position)) {
                    return funcRange;
                }
            }
        }
        for (const param of parameterData) {
            for (const [_, paramRange] of param[1]) {
                if (paramRange.contains(position)) {
                    return paramRange;
                }
            }
        }
        return Promise.reject();
    },
    provideRenameEdits(document, position, newName, token) {
        if (!/\w+/.test(newName)) {
            return Promise.reject();
        }
        const renameBase = getRenameBase(position);
        if (renameBase == null)
            return;
        const edits = new vscode_1.WorkspaceEdit();
        switch (renameBase[0]) {
            case 'variable': {
                const variable = variableData.get(renameBase[1]);
                for (const [funcRange, variableRange] of variable) {
                    if (funcRange.contains(position)) {
                        edits.replace(document.uri, variableRange, newName);
                    }
                }
                break;
            }
            case 'alias': {
                const aliasRanges = aliasData.get(renameBase[1]);
                for (const aliasRange of aliasRanges) {
                    edits.replace(document.uri, aliasRange, newName);
                }
                break;
            }
            case 'function': {
                const funcRanges = functionData.get(renameBase[1]);
                for (const funcRange of funcRanges) {
                    edits.replace(document.uri, funcRange, newName);
                }
                break;
            }
            case 'parameter': {
                const param = parameterData.get(renameBase[1]);
                for (const [funcRange, paramRange] of param) {
                    if (funcRange.contains(position)) {
                        edits.replace(document.uri, paramRange, newName);
                    }
                }
                break;
            }
        }
        return edits;
    }
};
vscode_1.languages.registerRenameProvider(selector, renameProvider);
//# sourceMappingURL=extension.js.map