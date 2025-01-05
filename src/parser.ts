import { Position } from "vscode";
import { variableData, aliasData, functionData, parameterData, log } from "./storage";
import { any, between, exhaust, many, opt, Parser, ref, seq, spaces, surely, wspaces } from "parser-combinators";
import { functionDeclaration } from "./parsers/functions";
import { newline, rcb } from "./parsers/base";
import { functionCall, variableDeclaration, variableModification } from "./parsers/variables";
import { typeDeclaration } from "./parsers/types";

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

export const languageParser = exhaust(
	seq(
		spaces,
		any(
			newline,
			seq(
				functionDeclaration,
				newline,
				surely(exhaust(
					surely(seq(
						spaces,
						any(
							newline,
							variableDeclaration,
							seq(functionCall, newline),
							variableModification
						)
					)),
					rcb
				)),
				rcb,
				newline
			),
			variableDeclaration,
			seq(typeDeclaration, newline)
		)
	)
);