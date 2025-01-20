import { addBinary, addDef, anyType, arr } from "../typeSetup";
import { boolType } from "./bool";
import { intType } from "./int";
import { stringType } from "./string";

addDef('assert', 'pub def assert(condition: Bool, error_code: Int) {', null, [boolType, intType]);
addDef('breakpoint', 'pub def breakpoint() {', null, []);
addDef("exit", "pub def exit() {", null, []);
addDef("exit", "pub def exit(code: Int) {", null, [intType]);
addDef("get_tick", "pub def get_tick() Int {", intType, []);
addDef("get_last_time", "pub def get_last_time() Int {", intType, []);
addDef(
  "get_register_value",
  "pub def get_register_value(register: Int) Int {",
  intType,
  [intType]
);
addDef("has_ram", "pub def has_ram() Bool {", boolType, []);
addDef("get_ram_value", "pub def get_ram_value(address: Int) Int {", intType, [
  intType,
]);
addDef("get_ram_size", "pub def get_ram_size() Int {", intType, []);
addDef("get_delay_score", "pub def get_delay_score() Int {", intType, []);
addDef(
  "get_component_count",
  "pub def get_component_count() Int {",
  intType,
  []
);
addDef(
  "get_program_address",
  "pub def get_program_address() Int {",
  intType,
  []
);
addDef("get_program_output", "pub def get_program_output() Int {", intType, []);
addDef(
  "get_level_memory",
  "pub def get_level_memory(id: String) Int {",
  intType,
  [stringType]
);
addDef(
  "set_custom_input_text",
  "pub def set_custom_input_text(text: String) {",
  null,
  [stringType]
);
addDef(
  "ui_set_hidden",
  "pub def ui_set_hidden(id: String, hidden: Bool) {",
  null,
  [stringType, boolType]
);
addDef("ui_set_text", "pub def ui_set_text(id: String, text: String) {", null, [
  stringType,
  stringType,
]);
addDef(
  "ui_set_position",
  "pub def ui_set_position(id: String, x: Int, y: Int) {",
  null,
  [stringType, intType, intType]
);
addDef("set_error", "pub def set_error(text: String) {", null, [stringType]);
addDef("output", "pub def output(text: String) {", null, [stringType]);
addDef("add_keyboard_value", "pub def add_keyboard_value(value: Int) {", null, [
  intType,
]);
addDef(
  "has_time_component",
  "pub def has_time_component() Bool {",
  boolType,
  []
);
addDef(
  "has_keyboard_component",
  "pub def has_keyboard_component() Bool {",
  boolType,
  []
);
addDef(
  "has_console_component",
  "pub def has_console_component() Bool {",
  boolType,
  []
);
addDef(
  "get_assembler_register_count",
  "pub def get_assembler_register_count() Int {",
  intType,
  []
);
addDef("get_console_offset", "pub def get_console_offset() Int {", intType, []);
addDef(
  "get_assembler_width",
  "pub def get_assembler_width() Int {",
  intType,
  []
);
addDef(
  "get_latency_ram_is_busy",
  "pub def get_latency_ram_is_busy() Bool {",
  boolType,
  []
);
addDef("set_address_text", "pub def set_address_text(text: String) {", null, [
  stringType,
]);
addDef("set_value_text", "pub def set_value_text(text: String) {", null, [
  stringType,
]);
addDef("get_cycle_count", "pub def get_cycle_count() Int {", intType, []);
addDef("get_probe_value", "pub def get_probe_value() Int {", intType, []);
addDef("get_gate_score", "pub def get_gate_score() Int {", intType, []);
addDef("print", "pub def print(input: @Any) {", null, [anyType]);
addDef("str", "pub def str(value: String) String {", stringType, [stringType]);
addDef("str", "pub def str(value: Bool) String {", stringType, [boolType]);
addDef("str", "pub def str(value: Uint) String {", stringType, ['Uint']);
addDef("str", "pub def str(value: Sint) String {", stringType, ['Sint']);
addDef("str", "pub def str(value: Char) String {", stringType, ['Char']);
addDef("str", "pub def str(value: [@Type]) String {", stringType, [arr(anyType)]);
addBinary("===", "pub binary ===(a: @A, b: @B) Bool {", boolType, [anyType, anyType]);