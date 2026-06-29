import { between, regex } from "parser-combinators";
import { typeDeclaration } from "./declaration";

export const ioDeclaration = between(
    regex(/\s*\/\*\*\*\s*/s, 'IO declaration'),
    typeDeclaration,
    regex(/\s\*\*\*\/\s*/s, 'IO declaration end'),
);