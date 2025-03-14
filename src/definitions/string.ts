import { addBinary, addDef, addDot, addType } from "../typeSetup";
import { boolType } from "./bool";
import { intType } from "./int";

export const stringType = addType("String", "A string type");
addDot("len", "pub dot len(string: String) Int {", intType, [stringType]);
addBinary("+", "Adds two strings together", stringType, [
  stringType,
  stringType,
]);
addBinary("==", "Checks if the first string is equal to the second", boolType, [
  stringType,
  stringType,
]);
addBinary(
  "!=",
  "Checks if the first string is not equal to the second",
  boolType,
  [stringType, stringType]
);
addDef("int", "pub def int(value: String) Int {", intType, [stringType]);
