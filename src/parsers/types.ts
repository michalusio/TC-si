import { map, opt, seq, spacesPlus, str, surely } from "parser-combinators";
import { typeDefinition, typeName } from "./base";
import { TypeDefinition } from "./ast";

export const typeDeclaration = map(seq(
    opt(str('pub ')),
    str('type'),
    surely(
        seq(
            spacesPlus,
            typeName,
            spacesPlus,
            typeDefinition
        )
    )
), ([pub, _, [__, name, ___, definition]]) => (<TypeDefinition>{
    type: 'type-definition',
    public: !!pub,
    name,
    definition
}));