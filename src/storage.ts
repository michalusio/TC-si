import { window, Range, SemanticTokensLegend, languages, TextDocument, Position } from 'vscode';
import { ParseReturnType } from './parsers/types/ast';
import type { binaryOperator } from './parsers/base';
import type { Environment } from './environment';
import { logDebugInfo } from './workspace';
import { SimplexDiagnostic } from './SimplexDiagnostic';
import { TokenRange } from 'parser-combinators';

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

export const migrateTokenData = (from: TextDocument, to: TextDocument, diags: SimplexDiagnostic[], lastLibraryLine: number): SimplexDiagnostic[] => {
	const fromTokens = lastTokensData[from.uri.toString()];

	const lastLibraryLineOffset = from.offsetAt(new Position(lastLibraryLine, 0));

	const offsetTokenRange = (range: TokenRange): TokenRange => ({ start: range.start - lastLibraryLineOffset, end: range.end - lastLibraryLineOffset });

	lastTokensData[to.uri.toString()] = fromTokens
		.map(token => <TokenData>{
			position: offsetTokenRange(token.position),
			definition: typeof token.definition === 'string'
				? token.definition
				: offsetTokenRange(token.definition),
			info: {
				type: token.info.type,
				range: token.info.range
					? offsetTokenRange(token.info.range)
					: undefined,
				dotFunctionSuggestions: token.info.dotFunctionSuggestions
					? token.info.dotFunctionSuggestions.map(s => typeof s[1] === 'string'
						? s
						: [s[0], offsetTokenRange(s[1])]
					)
					: undefined
			}
		})
		.filter(token => token.position.start >= 0);

	return diags
		.map(d => d.offsetLines(-lastLibraryLine))
		.filter(d => d.range.start.line >= 0);
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

export const emptyScope = () => (<Environment>{
	type: "scope",
	switchTypes: new Map(),
	functions: [],
	operators: [],
	types: new Map(),
	variables: new Map(),
});

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