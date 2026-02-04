import { Position, TextDocument } from "vscode";
import { any, between, Context, eof, exhaust, isFailure, lookaround, map, oneOrMany, opt, Parser, recoverByAddingChars, ref, regex, seq, spaces, spacesPlus, str, surely, Token, token, TokenRange, wspaces } from "parser-combinators";
import { functionDeclaration } from "./parsers/functions";
import { blockComment, lcb, lineComment, newline, variableName } from "./parsers/base";
import { rValue, topmostVariableDeclaration, variableDeclaration, variableModification } from "./parsers/variables";
import { typeDeclaration } from "./parsers/declaration";
import { manyForSure, recoverBySkipping, rstr } from "./parsers/utils";
import { BreakStatement, ContinueStatement, FunctionDeclaration, IfStatement, RegAllocUseStatement, ReturnStatement, Statement, StatementsBlock, StatementsStatement, SwitchStatement, WhileStatement, AsmStatement, CommentStatement } from "./parsers/types/ast";
import { getTokensData } from "./storage";
import { symphonyParser } from "./parsers/symphony";

type PositionInfo = {
	current: TokenRange,
	definition: TokenRange | string,
	info: {
		range?: TokenRange;
		type?: string;
	},
	all: TokenRange[],
	dotFunctionSuggestions: [string, string | TokenRange][]
};

export const getPositionInfo = (document: TextDocument, position: Position): PositionInfo | null => {
	const index = document.offsetAt(position);
	const token = getTokensData(document).find(token => token.position.start <= index && token.position.end >= index);
	if (!token) {
		return null;
	}
	const definitionToken = (typeof token.definition !== 'string')
		? getTokensData(document).find(t => t.position.start === (token.definition as TokenRange).start && t.position.end === (token.definition as TokenRange).end)
		: undefined;
	const allTokens = getTokensData(document).filter(t => 
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

export const getPositionInformation = (document: TextDocument, token: TokenRange): PositionInfo | null => {
	return getPositionInfo(document,
		document.positionAt(Math.floor((token.end + token.start) / 2))
	);
}

export const getDeclarations = (document: TextDocument): {
    position: TokenRange;
    definition: TokenRange | string;
    info: {
        range?: TokenRange;
        type?: string;
    };
}[] => {
	return getTokensData(document).filter(td => {
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
				recoverByAddingChars(map(rValue(), v => v.value), '0'),
				any(newline, lineComment, spacesPlus, lookaround(str('}')))
			)
		))
	),
	([_, value]) => (<ReturnStatement>{
		type: 'return',
		value
	})
);

const breakStatement = map(
	seq(
		str('break')
	),
	([_]) => (<BreakStatement>{
		type: 'break'
	})
);

const continueStatement = map(
	seq(
		str('continue')
	),
	([_]) => (<ContinueStatement>{
		type: 'continue'
	})
);

const regAllocUse = map(
	seq(
		str('_reg_alloc_use'),
		spacesPlus,
		oneOrMany(variableName, seq(spaces, str(','), spaces))
	),
	([_, __, values]) => (<RegAllocUseStatement>{
		type: '_reg_alloc_use',
		values
	})
);

const parseAssembler = (parser: Parser<AsmStatement>): Parser<AsmStatement> => {
	return (ctx) => {
		const result = parser(ctx);
		if (isFailure(result)) return result;
		const { architecture, code } = result.value;
		if (architecture !== 'symphony') return result;
		const symphonyResult = symphonyParser({
			index: 0,
			path: '',
			text: code
		});
		if (isFailure(symphonyResult)) return {
			ctx: {
				...ctx,
				index: symphonyResult.ctx.index + ctx.index,
			},
			expected: symphonyResult.expected,
			history: symphonyResult.history,
			success: symphonyResult.success
		};
		return {
			...result,
			value: {
				...result.value,
				code: JSON.stringify(symphonyResult.value)
			}
		};
	}
}

const asmDeclaration = parseAssembler(map(
	seq(
		str('asm'),
		spacesPlus,
		regex(/\w+/, "architecture"),
		spacesPlus,
		surely(
			between(
				rstr('{'),
				exhaust(regex(/[^}]/, 'any character'), str('}')),
				str('}')
			)
		)
	),
	([type, _, architecture, __, chars]) => (<AsmStatement>{
		type,
		architecture,
		code: chars.join('')
	})
));

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
							token(any<string | Statement>(
								blockComment,
								newline,
								asmDeclaration,
								typeDeclaration,
								regAllocUse,
								returnStatement,
								breakStatement,
								continueStatement,
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
										functionDeclaration,
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
								lineComment,
								map(seq(variableDeclaration, any(newline, lineComment, lookaround(seq(spaces, str('}'))))), ([v]) => v.value),
								map(seq(variableModification, any(newline, lineComment, lookaround(seq(spaces, str('}'))))), ([v]) => v.value),
								map(seq(rValue(), any(newline, lineComment, lookaround(seq(spaces, str('}'))))), ([v]) => v.value)
							)),
							(s) => typeof s.value === 'string' ? ({...s, value: <CommentStatement>{ type: 'comment', value: s.value }}) : (s as Token<Statement>)
						),
						regex(/.*?(?=})/, 'statement')
					)
				),
				seq(wspaces, rstr('}'))
			)
		),
		(statements) => (<StatementsBlock> statements.map(s => s[1]).filter((s): s is Token<Statement> => s != null && (s.value.type !== 'comment' || !!s.value.value.trim())))
	)(ctx);
}

function whileBlock(): Parser<WhileStatement> {
	return (ctx: Context) => map(
		seq(
			str('while'),
			spacesPlus,
			surely(seq(
				recoverByAddingChars(rValue(), 'true'),
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
						recoverByAddingChars(rValue(), 'true'),
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
								recoverByAddingChars(rValue(), 'true'),
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
			elseBlock: ((): StatementsBlock => {
				elseBlock ??= [];
				if (elsifs.length === 0) return elseBlock;

				let startBlock: IfStatement | null = null;
				let currentBlock: IfStatement | null = null;
				for (const ei of elsifs) {
					const block = <IfStatement> {
						type: 'if',
						value: ei.value,
						ifBlock: ei.statements,
						elseBlock
					};
					startBlock ??= block;
					if (currentBlock) {
						currentBlock.elseBlock = [{
							start: ei.value.start - 3,
							end: ei.statements[ei.statements.length - 1].end,
							value: block
						}];
					}
					currentBlock = block;
				}

				const statement = elseBlock[elseBlock.length - 1]
					?? startBlock!.elseBlock[startBlock!.elseBlock.length - 1]
					?? startBlock!.ifBlock[startBlock!.ifBlock.length - 1];
				return [{
					start: startBlock!.value.start - 3,
					end: statement.end + 1,
					value: startBlock!
				}];
			})()
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
									token(any(
										map(
											seq(str('default'), lookaround(any(str(' '), str('{')))),
											([v]) => v
										),
										map(rValue(), v => v.value)
									)),
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
			token(any<void | string | Statement>(
				eof,
				blockComment,
				newline,
				asmDeclaration,
				callConvDeclaration,
				externDeclaration,
				regAllocUse,
				returnStatement,
				breakStatement,
				continueStatement,
				whileBlock(),
				ifBlock(),
				switchBlock(),
				map(seq(topmostVariableDeclaration, any(newline, lineComment, spacesPlus, eof)), ([v]) => v.value),
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
						functionDeclaration,
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
				lineComment,
				map(seq(typeDeclaration, any(newline, lineComment, spacesPlus, eof)), ([v]) => v),
				map(seq(variableDeclaration, any(newline, lineComment, lookaround(seq(spaces, str('}'))))), ([v]) => v.value),
				map(seq(variableModification, any(newline, lineComment, lookaround(seq(spaces, str('}'))))), ([v]) => v.value),
				map(seq(rValue(), any(newline, lineComment, lookaround(seq(spaces, str('}'))))), ([v]) => v.value)
			))
		)
	),
	(data) => data
		.map(d => d[1])
		.filter((d): d is Token<Statement | string> => !!d.value && (typeof d.value !== 'string' || !!d.value.trim()))
		.map(d => typeof d.value === 'string' ? ({ ...d, value: <CommentStatement>{ type: 'comment', value: d.value } }) : (d as Token<Statement>))
);
