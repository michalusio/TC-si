import { map, seq, spacesPlus, str, surely } from "parser-combinators";
import { typeDefinition, typeName } from "./base";
import { TypeDefinition } from "./ast";

export const typeDeclaration = map(seq(
    str('type'),
    surely(
        seq(
            spacesPlus,
            typeName,
            spacesPlus,
            typeDefinition()
        )
    )
), ([_, [__, name, ___, definition]]) => (<TypeDefinition>{
    name: {
        text: name,
        range: {
            start: _.length + __.length,
            end: _.length + __.length + name.length
        }
    },
    definition: {
        text: definition,
        range: {
            start: _.length + __.length + name.length + ___.length,
            end: _.length + __.length + name.length + ___.length + definition.length
        }
    }
}));