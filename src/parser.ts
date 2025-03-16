import { Position, TextDocument } from "vscode";
import { any, between, Context, exhaust, map, oneOrMany, opt, Parser, ref, regex, seq, spaces, spacesPlus, str, surely, wspaces } from "parser-combinators";
import { functionDeclaration as functionDefinition } from "./parsers/functions";
import { blockComment, lcb, lineComment, newline, variableName } from "./parsers/base";
import { anyNumericLiteral, rValue, stringLiteral, topmostVariableDeclaration, variableDeclaration, variableLiteral, variableModification } from "./parsers/variables";
import { typeDeclaration } from "./parsers/declaration";
import { eof, lookaround, manyForSure, recoverByAddingChars, recoverBySkipping, rstr, token } from "./parsers/utils";
import { FunctionDeclaration, IfStatement, RegAllocUseStatement, ReturnStatement, Statement, StatementsBlock, StatementsStatement, SwitchStatement, TokenRange, TypeDefinition, VariableDeclaration, WhileStatement } from "./parsers/types/ast";
import { lastTokensData } from "./storage";

export const getPositionInfo = (document: TextDocument, position: Position): {
	current: TokenRange,
	definition: TokenRange | string,
	info: {
		range?: TokenRange;
		type?: string;
	},
	all: TokenRange[],
	dotFunctionSuggestions: [string, string | TokenRange][]
 } | null => {
	const index = document.offsetAt(position);
	const token = lastTokensData.find(token => token.position.start <= index && token.position.end >= index);
	if (!token) return null;
	const definitionToken = (typeof token.definition !== 'string')
		? lastTokensData.find(t => t.position.start === (token.definition as TokenRange).start && t.position.end === (token.definition as TokenRange).end)
		: undefined;
	const allTokens = lastTokensData.filter(t => 
		(typeof t.definition === 'string' && typeof token.definition === 'string' && (t.definition === token.definition))
	 || (typeof t.definition !== 'string' && typeof token.definition !== 'string' && t.definition.start === token.definition.start && t.definition.end === token.definition.end)
	);
	return {
		current: token.position,
		definition: token.definition,
		info: definitionToken?.info ?? {},
		all: allTokens.map(t => t.position),
		dotFunctionSuggestions: token.info.dotFunctionSuggestions ?? []
	};
}

export const getDeclarations = (): {
    position: TokenRange;
    definition: TokenRange | string;
    info: {
        range?: TokenRange;
        type?: string;
    };
}[] => {
	return lastTokensData.filter(td => {
		if (typeof td.definition === 'string' || !td.info.type) return false;
		return td.position.start == td.definition.start
			&& td.position.end == td.definition.end
			&& td.position.end == td.info.range?.end;
	});
}

const returnStatement = map(
	seq(
		str('return'),
		token(opt(
			between(
				spacesPlus,
				recoverByAddingChars('0', map(rValue(), v => v.value), true, 'return value'),
				any(newline, lineComment, spacesPlus)
			)
		))
	),
	([_, value]) => (<ReturnStatement>{
		type: 'return',
		value
	})
);

const regAllocUse = map(
	seq(
		str('_reg_alloc_use'),
		spacesPlus,
		recoverByAddingChars('value', variableName, true, 'variable')
	),
	([_, __, value]) => (<RegAllocUseStatement>{
		type: '_reg_alloc_use',
		value
	})
);

const asmDeclaration = map(
	seq(
		str('asm'),
		spacesPlus,
		regex(/\w+/, "architecture"),
		spacesPlus,
		surely(
			seq(
				rstr('{'),
				exhaust(regex(/[^}]/, 'any character'), str('}')),
				str('}')
			)
		)
	),
	() => "asm block"
)

const callConvDeclaration = map(
	seq(
		str('call_conv'),
		spacesPlus,
		regex(/\w+/, "architecture"),
		spacesPlus,
		regex(/\w+/, "os"),
		spacesPlus,
		surely(
			seq(
				rstr('('),
				exhaust(regex(/[^)]/, 'any character'), str(')')),
				str(')')
			)
		)
	),
	() => "call_conv block"
)

const externDeclaration = map(
	seq(
		str('extern'),
		spacesPlus,
		regex(/\w+/, "os"),
		spacesPlus,
		regex(/\w+/, "varName")
	),
	() => "extern block"
)

function statementsBlock(): Parser<StatementsBlock> {
	return (ctx: Context) => map(
		surely(
			exhaust(
				seq(
					wspaces,
					recoverBySkipping(
						map(
							any<string | Statement>(
								lineComment,
								blockComment,
								newline,
								asmDeclaration,
								typeDeclaration,
								regAllocUse,
								returnStatement,
								whileBlock(),
								ifBlock(),
								switchBlock(),
								map(
									between(
										lcb,
										statementsBlock(),
										seq(wspaces, rstr('}'))
									),
									(statements) => (<StatementsStatement>{
										type: 'statements',
										statements
									})
								),
								map(
									seq(
										functionDefinition,
										opt(newline),
										statementsBlock(),
										wspaces,
										rstr('}'),
										any(newline, lineComment, lookaround(seq(spaces, str('}'))))
									),
									([definition, _, statements]) => (<FunctionDeclaration>{
										type: 'function-declaration',
										definition,
										statements
									})
								),
								map(seq(variableDeclaration, any(newline, lineComment, lookaround(seq(spaces, str('}'))))), ([v]) => v.value),
								map(seq(variableModification, any(newline, lineComment, lookaround(seq(spaces, str('}'))))), ([v]) => v.value),
								map(seq(rValue(), any(newline, lineComment, lookaround(seq(spaces, str('}'))))), ([v]) => v.value)
							),
							(s) => typeof s === 'string' ? null : s
						),
						regex(/.*?(?=})/, 'statement')
					)
				),
				seq(wspaces, rstr('}', false))
			)
		),
		(statements) => (<StatementsBlock> statements.map(s => s[1]).filter((s): s is Statement => s != null))
	)(ctx);
}

function whileBlock(): Parser<WhileStatement> {
	return (ctx: Context) => map(
		seq(
			str('while'),
			spacesPlus,
			surely(seq(
				recoverByAddingChars('true', rValue(), true, 'condition'),
				spaces,
				rstr('{'),
				statementsBlock(),
				wspaces,
				rstr('}'),
				any(newline, lineComment, spacesPlus)
			))
		),
		([_, __, [value, ___, ____, statements]]) => (<WhileStatement>{
			type: 'while',
			value,
			statements
		})
	)(ctx);
}

function ifBlock(): Parser<IfStatement> {
	return (ctx: Context) => map(
		seq(
			str('if'),
			spacesPlus,
			surely(seq(
				map(
					seq(
						recoverByAddingChars('true', rValue(), true, 'condition'),
						spaces,
						rstr('{'),
						statementsBlock(),
						wspaces,
						rstr('}'),
						any(newline, lineComment, spacesPlus),
					),
					([value, _, __, statements]) => ({ value, statements })
				),
				manyForSure(
					map(
						seq(
							wspaces,
							str('elif'),
							spacesPlus,
							surely(seq(
								recoverByAddingChars('true', rValue(), true, 'condition'),
								spaces,
								rstr('{'),
								statementsBlock(),
								wspaces,
								rstr('}'),
								any(newline, lineComment, spacesPlus)
							))
						),
						([_, __, ___, [value, ____, _____, statements]]) => ({ value, statements })
					)
				),
				opt(
					map(
						seq(
							wspaces,
							str('else'),
							spacesPlus,
							rstr('{'),
							recoverBySkipping(
								surely(
									seq(
										statementsBlock(),
										wspaces,
										rstr('}'),
									)
								),
								regex(/.*?}/, 'Close of Else block')
							),
							any(newline, lineComment, spacesPlus)
						),
						([_, __, ___, ____, data]) => data?.[0]
					)
				)
			))
		),
		([_, __, [ifBlock, elsifs, elseBlock]]) => (<IfStatement>{
			type: 'if',
			value: ifBlock.value,
			ifBlock: ifBlock.statements,
			elifBlocks: elsifs,
			elseBlock: elseBlock ?? []
		 })
	)(ctx);
}

function switchBlock(): Parser<SwitchStatement> {
	return (ctx: Context) => {
		let wspace: number | null = null;
		return map(
			seq(
				str('switch'),
				spacesPlus,
				surely(map(
					seq(
						rValue(),
						oneOrMany(newline),
						manyForSure(
							map(
								seq(
									ref(spaces, v => {
										if (wspace == null) {
											wspace = v?.length ?? 0;
											return true;
										}
										return wspace === (v?.length ?? 0);
									}),
									token(any(anyNumericLiteral, stringLiteral, variableLiteral, str('default'))),
									spacesPlus,
									rstr('{'),
									surely(map(
										seq(
											wspaces,
											statementsBlock(),
											wspaces,
											rstr('}'),
											any(oneOrMany(newline), lineComment, spacesPlus)
										),
										([_, statements]) => statements
									))
								),
								([_, caseName, __, ___, statements]) => ({ caseName, statements })
							)
						),
						opt(any(newline, lineComment, spacesPlus))
					),
					([value, _, cases]) => ({ value, cases })
				))
			),
			([_, __, data]) => {
				const statement: SwitchStatement = {
					type: 'switch',
					...data
				}
				return statement;
			}
		)(ctx);
	}
}

export const languageParser = map(
	exhaust(
		seq(
			spaces,
			any(
				eof,
				lineComment,
				blockComment,
				newline,
				callConvDeclaration,
				externDeclaration,
				map(seq(topmostVariableDeclaration, any(newline, lineComment, spacesPlus, eof)), ([v]) => v.value),
				map(
					seq(
						functionDefinition,
						opt(newline),
						statementsBlock(),
						wspaces,
						rstr('}'),
						any(newline, lineComment, spacesPlus, eof)
					),
					([definition, _, statements]) => (<FunctionDeclaration>{
						type: 'function-declaration',
						definition,
						statements
					})
				),
				map(seq(typeDeclaration, any(newline, lineComment, spacesPlus, eof)), ([v]) => v)
			)
		)
	),
	(data) => data.map(d => d[1]).filter((d): d is VariableDeclaration | FunctionDeclaration | TypeDefinition => !!d && typeof d !== 'string')
);
