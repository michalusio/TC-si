import { addBinary, addDef, addDot, anyType, arr } from "../typeSetup";
import { boolType } from "./bool";
import { intType } from "./int";
import { stringType } from "./string";

addDot("find", "pub dot find(array: [@Any], value: @Any) Int {", intType, [
  arr(anyType),
  anyType,
]);
addDot("len", "pub dot len(string: String) Int {", intType, [stringType]);
addDot("len", "pub dot len(array: [@Any]) Int {", intType, [arr(anyType)]);
addDot(
  "contains",
  "pub dot contains(array: [@Type], value: @Type) Bool {",
  boolType,
  [arr(anyType), anyType]
);
addDot("in", "pub dot in(value: @Type, array: [@Type]) Bool {", boolType, [
  anyType,
  arr(anyType),
]);
addDef("high", "pub dot high(a: [@Any]) Int {", intType, [arr(anyType)]);
addDef("sort", "pub def sort($arr: [@Any]) {", null, [arr(anyType)]);
addDef("quick_sort", "pub def quick_sort($arr: [@Any]) {", null, [
  arr(anyType),
]);
addDef("sample", "pub def sample(array: [@Any]) @Any {", anyType, [
  arr(anyType),
]);
addBinary("+", "Concatenates two arrays together", arr(anyType), [
  arr(anyType),
  arr(anyType),
]);
addBinary("==", "Checks if the first array is equal to the second", boolType, [
  arr(anyType),
  arr(anyType),
]);
addBinary(
  "!=",
  "Checks if the first array is not equal to the second",
  boolType,
  [arr(anyType), arr(anyType)]
);

addDef("_size", "pub def _size(data: @Any) Int {", intType, [anyType]);
addDef(
  "array",
  "pub def array(length: Int, value: @Any) [@Any] {",
  arr(anyType),
  [intType, anyType]
);
