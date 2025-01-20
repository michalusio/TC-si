import { addBinary, addType } from "../typeSetup";
import { boolType } from "./bool";

export const stringType = addType("String", "A string type");
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