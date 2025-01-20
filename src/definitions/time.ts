import { addBinary, addDef, addDot, addType } from "../typeSetup";
import { boolType } from "./bool";
import { intType } from "./int";

const timeType = addType(
    "Time",
    "Type used for denoting time (in microseconds)"
);
addDot("sec", "pub dot sec(amount: Int) Time {", timeType, [intType]);
addDot("ms", "pub dot ms(amount: Int) Time {", timeType, [intType]);
addDot("us", "pub dot us(amount: Int) Time {", timeType, [intType]);
addDot("ns", "pub dot ns(amount: Int) Time {", timeType, [intType]);
addDot("min", "pub dot min(amount: Int) Time {", timeType, [intType]);
addDot("hour", "pub dot hour(amount: Int) Time {", timeType, [intType]);
addDot("day", "pub dot day(amount: Int) Time {", timeType, [intType]);

addBinary('+', 'Adds two times together', timeType, [timeType, timeType]);
addBinary('-', 'Subtracts one time from another', timeType, [timeType, timeType]);
addBinary('*', 'Multiplies two times together', timeType, [timeType, timeType]);
addBinary('+=', 'Adds a time to another', timeType, [timeType, timeType]);
addBinary('-=', 'Subtracts a time from another', timeType, [timeType, timeType]);
addBinary('<', 'Checks if the first time is less than the second one', boolType, [timeType, timeType]);
addBinary('>', 'Checks if the first time is greater than the second one', boolType, [timeType, timeType]);
addBinary('<=', 'Checks if the first time is less than or equal to the second one', boolType, [timeType, timeType]);
addBinary('>=', 'Checks if the first time is greater than or equal to the second one', boolType, [timeType, timeType]);

addDef("sleep", "pub def sleep(duration: Time) {", null, [timeType]);
addDef("get_time", "pub def get_time() Time {", timeType, []);