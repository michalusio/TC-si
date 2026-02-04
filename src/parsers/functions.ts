import { any, between, exhaust, many, map, opt, Parser, recoverByAddingChars, regex, seq, spaces, spacesPlus, str, surely, token } from "parser-combinators";
import { functionBinaryOperator, functionKind, functionName, lpr, newline, typeAliasDefinition, unaryOperator, variableName } from "./base";
import { FunctionDefinition, Parameter } from "./types/ast";
import { rstr, time } from "./utils";

function assumption(): Parser<FunctionDefinition> {
	return (ctx) => map(seq(
		regex(/\s*\/\/\/ *assume +/s, 'assumption declaration'),
		functionDeclarationWithoutOpeningBracket,
		newline
	), ([_, f, __]) => f)(ctx);
}

const parameter = map(seq(
	variableName,
	spaces,
	rstr(':'),
	spaces,
	recoverByAddingChars(typeAliasDefinition(), 'Int')
), ([name, _, __, ___, type]) => <Parameter>({ name, type }));

const parameterList = time('parameters', between(
	lpr,
	opt(map(seq(
		parameter,
		exhaust(seq(spaces, str(','), spaces, parameter), seq(spaces, rstr(')')))
	), ([param, params]) => [
			param,
			...params.map(p => p[3])
	])),
	rstr(')')
));

const functionDeclarationWithoutOpeningBracket = time('function declarations', map(seq(
	opt(str('pub ')),
	any(
		map(seq(
			functionKind,
			spacesPlus,
			surely(seq(
				functionName,
				parameterList,
				spaces,
				token(opt(map(typeAliasDefinition(), t => t.value)))
			))
		), ([kind, _, [name, params, __, returnType]]) => {
			params ??= [];
			return {
				type: 'function' as const,
				kind,
				name,
				returnType,
				parameters: params
			};
		}),
		map(seq(
			any(
				seq(
					str('unary'),
					spacesPlus,
					surely(seq(
						token(unaryOperator),
						opt(spaces),
						parameterList,
						spaces,
						token(opt(map(typeAliasDefinition(), t => t.value)))
					))
				),
				seq(
					str('binary'),
					spacesPlus,
					surely(seq(
						token(functionBinaryOperator),
						opt(spaces),
						parameterList,
						spaces,
						token(opt(map(typeAliasDefinition(), t => t.value)))
					))
				)
			)
		), ([[kind, _, [name, __, params, ___, returnType]]]) => {
			params ??= [];
			const offset = kind.length + _.length;
			return {
				type: 'operator' as const,
				kind,
				name,
				nameOffset: offset,
				parameters: params,
				returnType
			};
		})
	),
	spaces
), ([pub, func, _]) => {
	return <FunctionDefinition>{
		type: func.type,
		public: pub != null,
        kind: func.kind,
		returnType: func.returnType,
        name: func.name,
		parameters: func.parameters,
		assumptions: []
	};
}));

export const functionDeclaration = map(seq(
	time('assumptions', many(assumption())),
	functionDeclarationWithoutOpeningBracket,
	rstr('{')
), ([assumptions, f, _]) => ({
	...f,
	assumptions
}));