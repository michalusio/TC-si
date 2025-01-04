"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vscode_1 = require("vscode");
const tokenTypes = ['type', 'parameter'];
const tokenModifiers = ['declaration', 'definition'];
const legend = new vscode_1.SemanticTokensLegend(tokenTypes, tokenModifiers);
let functionData = new Map();
let parameterData = new Map();
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
            name: new vscode_1.Range(lineIndex, keywordMatch.length, lineIndex, keywordMatch.length + nameMatch.length),
            type: new vscode_1.Range(lineIndex, keywordMatch.length + nameMatch.length + whitespaceMatch.length, lineIndex, keywordMatch.length + nameMatch.length + whitespaceMatch.length + typeMatch.length)
        });
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
        const parameters = line.text
            .slice(lprl, line.text.length - endParseResult[0].length)
            .split(',')
            .map((p, i, all) => {
            const offset = all.filter((_, j) => j < i).reduce((prev, curr) => prev + curr.length + (prev > 0 ? 1 : 0), 0);
            const ppr = /(\s*)(\w+)(\s*:\s*)(\[*[A-Z]\w*\]*)/.exec(p);
            if (ppr == null)
                return null;
            return {
                text: ppr[2],
                name: new vscode_1.Range(lineIndex, lprl + offset + ppr[1].length, lineIndex, lprl + offset + ppr[1].length + ppr[2].length)
            };
        })
            .filter((p) => p != null);
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
        const text = /\w+/.test(lineParseResult[6]) ? lineParseResult[6] : null;
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
            for (const match of lineText.matchAll(new RegExp(`(?<=[^\\w])${param.text}(?=[^\\w])`, 'g'))) {
                result.push([
                    param.text,
                    new vscode_1.Range(lineIndex, match.index, lineIndex, match.index + param.text.length)
                ]);
            }
        }
    }
    return result;
};
const tokenProvider = {
    provideDocumentSemanticTokens(document) {
        functionData.clear();
        parameterData.clear();
        const tokensBuilder = new vscode_1.SemanticTokensBuilder(legend);
        const typeAliases = getAllAliases(document);
        for (const alias of typeAliases) {
            tokensBuilder.push(alias.name, 'type', ['declaration']);
            tokensBuilder.push(alias.type, 'type', ['definition']);
        }
        const functionParams = getFunctionParameters(document);
        for (const func of functionParams) {
            if (func.text != null) {
                functionData.set(func.text, []);
                const functionUsage = getFunctionUsages(document, func.text);
                //throw `${func.text} - ${functionUsage.length} usages`;
                for (const usage of functionUsage) {
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
        const renameBase = getRenameBase(document, position);
        if (renameBase == null)
            return;
        switch (renameBase[0]) {
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
const getRenameBase = (document, position) => {
    for (const func of functionData) {
        for (const funcRange of func[1]) {
            if (funcRange.contains(position)) {
                return ['function', document.getText(funcRange)];
            }
        }
    }
    for (const param of parameterData) {
        for (const [_, paramRange] of param[1]) {
            if (paramRange.contains(position)) {
                return ['parameter', document.getText(paramRange)];
            }
        }
    }
    return null;
};
const renameProvider = {
    prepareRename(document, position, token) {
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
        const renameBase = getRenameBase(document, position);
        if (renameBase == null)
            return;
        const edits = new vscode_1.WorkspaceEdit();
        switch (renameBase[0]) {
            case 'function': {
                const funcRanges = functionData.get(renameBase[1]);
                for (const funcRange of funcRanges) {
                    edits.replace(document.uri, funcRange, newName);
                }
            }
            case 'parameter': {
                const param = parameterData.get(renameBase[1]);
                for (const [funcRange, paramRange] of param) {
                    if (funcRange.contains(position)) {
                        edits.replace(document.uri, paramRange, newName);
                    }
                }
            }
        }
        return edits;
    }
};
vscode_1.languages.registerRenameProvider(selector, renameProvider);
//# sourceMappingURL=extension.js.map