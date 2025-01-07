import { Position } from "vscode";
import { variableData, aliasData, functionData, parameterData } from "./storage";
import { any, Context, exhaust, oneOrMany, opt, Parser, ref, regex, seq, spaces, spacesPlus, str, surely, wspaces } from "parser-combinators";
import { functionDeclaration } from "./parsers/functions";
import { blockComment, lineComment, newline, variableName } from "./parsers/base";
import { functionCall, rValue, variableDeclaration, variableModification } from "./parsers/variables";
import { typeDeclaration } from "./parsers/types";
import { eof, manyForSure, recoverByAddingChars, recoverBySkipping, rstr } from "./parsers/utils";
import { RValue } from "./parsers/ast";

type PositionType = 'variable' | 'alias' | 'function' | 'parameter';

export const getPositionInfo = (position: Position): [PositionType, string] | null => {
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
}

const returnStatement = seq(
	str('return'),
	spacesPlus,
	recoverByAddingChars('0', rValue(), true, 'return value'),
	any(newline, lineComment, spacesPlus)
);

const regAllocUse = seq(
	str('_reg_alloc_use'),
	spacesPlus,
	recoverByAddingChars('value', variableName, true, 'variable')
);

const statementsBlock = surely(exhaust(
	seq(
		spaces,
		recoverBySkipping(
			any(
				lineComment,
				blockComment,
				newline,
				regAllocUse,
				returnStatement,
				seq(variableDeclaration, any(newline, lineComment, spacesPlus)),
				whileBlock(),
				ifBlock(),
				switchBlock(),
				seq(functionCall, any(newline, lineComment, spacesPlus)),
				seq(variableModification, any(newline, lineComment, spacesPlus)),
			),
			regex(/.*?(?=})/, 'statement')
		)
	),
	seq(wspaces, rstr('}', false))
));

function whileBlock(): Parser<['while', string, [RValue, string, '{', unknown, string | null, '}', string]]> {
	return (ctx: Context) => seq(
		str('while'),
		spacesPlus,
		surely(seq(
			recoverByAddingChars('true', rValue(), true, 'condition'),
			spaces,
			rstr('{'),
			statementsBlock,
			wspaces,
			rstr('}'),
			any(newline, lineComment, spacesPlus)
		))
	)(ctx);
}

function ifBlock(): Parser<['if', string,
	[RValue, string, '{', unknown, string | null, '}', string,
		[string | null, 'elif', string, [RValue, string, '{', unknown, string | null, '}', string]][],
		[string | null, 'else', string, '{', [unknown, string | null, '}'] | null, string] | null
	]]> {
	return (ctx: Context) => seq(
		str('if'),
		spacesPlus,
		surely(seq(
			recoverByAddingChars('true', rValue(), true, 'condition'),
			spaces,
			rstr('{'),
			statementsBlock,
			wspaces,
			rstr('}'),
			any(newline, lineComment, spacesPlus),
			manyForSure(
				seq(
					wspaces,
					str('elif'),
					spacesPlus,
					surely(seq(
						recoverByAddingChars('true', rValue(), true, 'condition'),
						spaces,
						rstr('{'),
						statementsBlock,
						wspaces,
						rstr('}'),
						any(newline, lineComment, spacesPlus)
					))
				)
			),
			opt(
				seq(
					wspaces,
					str('else'),
					spacesPlus,
					rstr('{'),
					recoverBySkipping(
						surely(
							seq(
								statementsBlock,
								wspaces,
								rstr('}'),
							)
						),
						regex(/.*?}/, 'Close of Else block')
					),
					any(newline, lineComment, spacesPlus)
				)
			)
		))
	)(ctx);
}

function switchBlock(): Parser<['switch', string, [RValue, string[], [string | null, string, string, '{', [string | null, unknown, string | null, '}', string | string[]]][], string]]> {
	return (ctx: Context) => {
		let wspace: number | null = null;
		return seq(
			str('switch'),
			spacesPlus,
			surely(seq(
				rValue(),
				oneOrMany(newline),
				manyForSure(
					seq(
						ref(spaces, v => {
							if (wspace == null) {
								wspace = v?.length ?? 0;
								return true;
							}
							return wspace === (v?.length ?? 0);
						}),
						variableName,
						spacesPlus,
						rstr('{'),
						surely(seq(
							wspaces,
							statementsBlock,
							wspaces,
							rstr('}'),
							any(oneOrMany(newline), lineComment, spacesPlus)
						))
					)
				),
				any(newline, lineComment, spacesPlus)
			))
		)(ctx);
	}
}

export const languageParser = exhaust(
	seq(
		spaces,
		any(
			lineComment,
			blockComment,
			newline,
			seq(variableDeclaration, any(newline, lineComment, spacesPlus, eof)),
			seq(
				functionDeclaration,
				newline,
				statementsBlock,
				wspaces,
				rstr('}'),
				any(newline, lineComment, spacesPlus, eof)
			),
			seq(typeDeclaration, any(newline, lineComment, spacesPlus, eof))
		)
	)
);