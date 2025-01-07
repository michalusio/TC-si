import { any, between, exhaust, map, opt, seq, spaces, spacesPlus, str, surely } from "parser-combinators";
import { binaryOperator, functionKind, functionName, lpr, typeDefinition, unaryOperator, variableName } from "./base";
import { FunctionDefinition } from "./ast";
import { recoverByAddingChars, rstr } from "./utils";

const parameter = map(seq(
	variableName,
	spaces,
	rstr(':'),
	spaces,
	recoverByAddingChars('Int', typeDefinition(), true, 'parameter type')
), ([name, _, __, ___, type]) => ({ name, type, typeOffset: name.length + _.length + __.length + ___.length }));

const parameterList = between(
	lpr,
	opt(map(seq(
		parameter,
		exhaust(seq(spaces, str(','), spaces, parameter), seq(spaces, rstr(')', false)))
	), ([param, params]) => {
		const paramOffset = param.typeOffset + 1 + param.type.length;
		return [
			{
				...param,
				nameOffset: 1,
				typeOffset: param.typeOffset + 1
			},
			...params.map((p, i) => {
				const offset = paramOffset
					+ p[0].length
					+ p[1].length
					+ p[2].length
					+ params
						.filter((_, j) => j < i)
						.reduce(
							(prev, curr) => prev
								+ curr[0].length
								+ curr[1].length
								+ curr[2].length
								+ curr[3].typeOffset
								+ curr[3].type.length, 0);
				return ({
					...p[3],
					nameOffset: offset,
					typeOffset: offset + p[3].typeOffset
				});
			})
		];
	})),
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
				opt(
					seq(
						spaces,
						typeDefinition()
					)
				)
			))
		), ([kind, _, [name, params, rType]]) => {
			params ??= [];
			const offset = kind.length + _.length;
			return {
				type: 'function' as const,
				kind,
				name,
				nameOffset: offset,
				returnType: rType?.[1],
				parameters: params.map(p => ({
					...p,
					nameOffset: p.nameOffset + offset,
					typeOffset: p.typeOffset + offset
				}))
			};
		}),
		map(seq(
			any(
				seq(
					str('unary'),
					spacesPlus,
					surely(seq(
						unaryOperator,
						parameterList,
						spaces,
						recoverByAddingChars('Int', typeDefinition(), true, 'return type')
					))
				),
				seq(
					str('binary'),
					spacesPlus,
					surely(seq(
						binaryOperator,
						parameterList,
						spaces,
						recoverByAddingChars('Int', typeDefinition(), true, 'return type')
					))
				)
			)
		), ([[kind, _, [name, params, __, returnType]]]) => {
			params ??= [];
			const offset = kind.length + _.length;
			return {
				type: 'operator' as const,
				kind,
				name,
				nameOffset: offset,
				parameters: params.map(p => ({
					...p,
					nameOffset: p.nameOffset + offset,
					typeOffset: p.typeOffset + offset
				})),
				returnType
			};
		})
	),
	spaces,
	rstr('{')
), ([pub, func, _, __]) => {
	const pl = pub?.length ?? 0;
	return <FunctionDefinition>{
		type: func.type,
		public: pub != null,
        kind: func.kind,
		returnType: func.returnType,
        name: {
            text: func.name,
            range: {
                start: func.nameOffset + pl,
                end: func.nameOffset + pl + func.name.length
            }
        },
		parameters: func.parameters.map(p => ({
			name: {
                text: p.name,
                range: {
                    start: p.nameOffset + pl,
                    end: p.nameOffset + pl + p.name.length
                }
            },
            type: {
                text: p.type,
                range: {
                    start: p.typeOffset + pl,
                    end: p.typeOffset + pl + p.type.length
                }
            }
		}))
	};
});