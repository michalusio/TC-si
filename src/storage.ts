import { window, Range, SemanticTokensLegend, languages } from 'vscode';
import { ParseReturnType, TokenRange } from './parsers/types/ast';
import type { binaryOperator } from './parsers/base';
import type { Environment } from './environment';

export const log = window.createOutputChannel("TC-si");

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
export let lastTokensData: TokenData[] = [];

export const clearTokensData = () => {
	if (tokensData.length > 0) {
		lastTokensData = [...tokensData];
	}
	tokensData.length = 0;
}

export const finalizeTokensData = () => {
	if (tokensData.length > 0) {
		lastTokensData = [...tokensData];
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
	'ror': 7,
	'rol': 7,
	'<<': 7,
	'>>': 7,
	'asr': 7
}
