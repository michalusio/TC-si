import { addBinary, addEnum, addUnary } from "../typeSetup";

export const boolType = addEnum("Bool", "A boolean value", ["false", "true"]);
addUnary("!", "Negates the boolean", boolType, boolType);
addBinary("||", "ORs two booleans", boolType, [boolType, boolType]);
addBinary("&&", "ANDs two booleans", boolType, [boolType, boolType]);