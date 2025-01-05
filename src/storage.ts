import { window, Range, SemanticTokensLegend, languages } from 'vscode';

export const log = window.createOutputChannel("TC-si");

const tokenTypes = ['type', 'parameter', 'variable'];
const tokenModifiers = ['declaration', 'definition', 'readonly'];
export const legend = new SemanticTokensLegend(tokenTypes, tokenModifiers);

export const aliasData = new Map<string, Range[]>();
export const functionData = new Map<string, Range[]>();
export const parameterData = new Map<string, [Range, Range][]>();
export const variableData = new Map<string, [Range, Range][]>();

export const diagnostics = languages.createDiagnosticCollection('si');

export const str = (r: Range): string => {
	return `${r.start.line}:${r.start.character} - ${r.end.line}:${r.end.character}`;
}

