import { window, Range, SemanticTokensLegend, languages, TextDocument } from 'vscode';
import { ParseReturnType, TokenRange } from './parsers/types/ast';
import type { binaryOperator } from './parsers/base';
import type { Environment } from './environment';
import { logDebugInfo } from './workspace';

export const log = window.createOutputChannel("TC-si");

export const logLine = (v: string) => {
	if (logDebugInfo()) {
		console.debug(v);
		log.appendLine(v);
	}
}

const tokenTypes = ['type', 'parameter', 'variable'];
const tokenModifiers = ['declaration', 'definition', 'readonly'];
export const legend = new SemanticTokensLegend(tokenTypes, tokenModifiers);

export type TokenData = {
	position: TokenRange,
	definition: TokenRange | string,
	info: {
		range?: TokenRange,
		type?: string;
		dotFunctionSuggestions?: [string, string | TokenRange][];
	}
};

export const tokensData: TokenData[] = [];
export let lastTokensData: Record<string, TokenData[]> = {};

export const getTokensData = (document: TextDocument) => lastTokensData[document.uri.toString()] ?? [];

export const clearTokensData = (document: TextDocument) => {
	if (tokensData.length > 0) {
		lastTokensData[document.uri.toString()] = [...tokensData];
	}
	tokensData.length = 0;
}

export const finalizeTokensData = (document: TextDocument) => {
	if (tokensData.length > 0) {
		lastTokensData[document.uri.toString()] = [...tokensData];
	}
}

export const diagnostics = languages.createDiagnosticCollection('si');

export const str = (r: Range): string => {
	return `${r.start.line}:${r.start.character} - ${r.end.line}:${r.end.character}`;
}

export const baseEnvironment: Environment = {
	type: 'scope',
	switchTypes: new Map(),
	functions: [],
	operators: [],
	types: new Map(),
	variables: new Map()
};

export const precedence: Record<ParseReturnType<typeof binaryOperator>, number> = {
	'||': 3,
	'&&': 4,
	'===': 5,
	'==': 5,
	'!=': 5,
	'<=': 5,
	'>=': 5,
	'<': 5,
	'<s': 5,
	'<u': 5,
	'>': 5,
	'+': 6,
	'-': 6,
	'&': 6,
	'|': 6,
	'^': 6,
	'*': 7,
	'/': 7,
	'%': 7,
	'<<': 7,
	'>>': 7
}

export const isSymphonyFile = (document: TextDocument): boolean => {
  const firstLine = document.lineAt(0).text.toLowerCase().replace(' ', '');
  return firstLine === '///symphony';
}