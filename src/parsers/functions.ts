import { any, between, exhaust, map, opt, seq, spaces, spacesPlus, str, surely } from "parser-combinators";
import { functionBinaryOperator, functionKind, functionName, lpr, typeDefinition, unaryOperator, variableName } from "./base";
import { FunctionDefinition, Parameter } from "./ast";
import { recoverByAddingChars, rstr, token } from "./utils";

const parameter = map(seq(
	variableName,
	spaces,
	rstr(':'),
	spaces,
	recoverByAddingChars('Int', typeDefinition(), true, 'parameter type')
), ([name, _, __, ___, type]) => <Parameter>({ name, type }));

const parameterList = between(
	lpr,
	opt(map(seq(
		parameter,
		exhaust(seq(spaces, str(','), spaces, parameter), seq(spaces, rstr(')', false)))
	), ([param, params]) => [
			param,
			...params.map(p => p[3])
	])),
	rstr(')')
);

export const functionDeclaration = map(seq(
	opt(str('pub ')),
	any(
		map(seq(
			functionKind,
			spacesPlus,
			surely(seq(
				functionName,
				parameterList,
				spaces,
				token(opt(map(typeDefinition(), t => t.value)))
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
						token(opt(map(typeDefinition(), t => t.value)))
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
						token(opt(map(typeDefinition(), t => t.value)))
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
	spaces,
	rstr('{')
), ([pub, func, _, __]) => {
	return <FunctionDefinition>{
		type: func.type,
		public: pub != null,
        kind: func.kind,
		returnType: func.returnType,
        name: func.name,
		parameters: func.parameters
	};
});