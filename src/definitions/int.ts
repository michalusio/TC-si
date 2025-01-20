import { addBinary, addConst, addDef, addType, addUnary, anyType } from "../typeSetup";
import { boolType } from "./bool";
import { stringType } from "./string";

export const intType = addType("Int", "A type allowing any integer to be passed in");

const addIntOperations = (iType: string) => {
  addUnary("~", "Inverts the bits of the integer", iType, iType);
  addUnary("-", "Negates the integer", iType, iType);

  addBinary("+", "Adds two integers together", iType, [iType, iType]);
  addBinary("-", "Subtracts two integers together", iType, [iType, iType]);
  addBinary("*", "Multiplies two integers together", iType, [iType, iType]);
  addBinary("/", "Divides two integers together", iType, [iType, iType]);
  addBinary(
    "%",
    "Calculates the modulo of the first integer by the second one",
    iType,
    [iType, iType]
  );
  addBinary("&", "ANDs bits of two integers together", iType, [iType, iType]);
  addBinary("|", "ORs bits of two integers together", iType, [iType, iType]);
  addBinary("^", "XORs bits of two integers together", iType, [iType, iType]);
  addBinary(
    ">>",
    "Shifts the first integer right by the second integers value",
    iType,
    [iType, iType]
  );
  addBinary(
    "<<",
    "Shifts the first integer left by the second integers value",
    iType,
    [iType, iType]
  );
  addBinary(
    "rol",
    "Rotates the first integer left by the second integers value",
    iType,
    [iType, iType]
  );
  addBinary(
    "ror",
    "Rotates the first integer right by the second integers value",
    iType,
    [iType, iType]
  );
  addBinary(
    "asr",
    "Arithmetically shifts the first integer right by the second integers value",
    iType,
    [iType, iType]
  );

  addBinary(
    ">",
    "Checks if the first integer is larger than the second",
    boolType,
    [iType, iType]
  );
  addBinary(
    "<",
    "Checks if the first integer is smaller than the second",
    boolType,
    [iType, iType]
  );
  addBinary(
    "<s",
    "Checks if the first integer is smaller (signed) than the second",
    boolType,
    [iType, iType]
  );
  addBinary(
    "<u",
    "Checks if the first integer is smaller (unsigned) than the second",
    boolType,
    [iType, iType]
  );
  addBinary(
    ">=",
    "Checks if the first integer is larger or equal to the second",
    boolType,
    [iType, iType]
  );
  addBinary(
    "<=",
    "Checks if the first integer is smaller or equal to the second",
    boolType,
    [iType, iType]
  );
  addBinary(
    "!=",
    "Checks if the first integer is not equal to the second",
    boolType,
    [iType, iType]
  );
  addBinary(
    "==",
    "Checks if the first integer is equal to the second",
    boolType,
    [iType, iType]
  );
};

const sintType = addType(
  "SInt",
  "A type allowing any signed integer to be passed in"
);
const uintType = addType(
  "UInt",
  "A type allowing any unsigned integer to be passed in"
);
for (let width = 1; width <= 2048; width++) {
  const s = addType("S" + width, `A signed integer of width ${width}`);
  addIntOperations(s);

  const u = addType("U" + width, `An unsigned integer of width ${width}`);
  addIntOperations(u);
}
addIntOperations(sintType);
addIntOperations(uintType);
addIntOperations(intType);

addConst(
  "Z_STATE",
  "Constant denoting the `Hi-Z` state of the wire.\n\nEquivalent to `0x8000_0000_0000_0000`.",
  intType
);

addDef("random", "pub def random(max: Int) Int {", intType, [intType]);
addDef("min", "pub def min(a: Int, b: Int) Int {", intType, [intType, intType]);
addDef("max", "pub def max(a: Int, b: Int) Int {", intType, [intType, intType]);
addDef("log10", "pub def log10(a: Int) Int {", intType, [intType]);
addDef("int", "pub def int(value: String) Int {", intType, [stringType]);
