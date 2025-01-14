import { window, Range, SemanticTokensLegend, languages } from 'vscode';
import { TokenRange } from './parsers/ast';
import { Environment, EnvironmentType, getArrayType } from './checks';
import { binaryOperator, ParseReturnType } from './parsers/base';

export const log = window.createOutputChannel("TC-si");

const tokenTypes = ['type', 'parameter', 'variable'];
const tokenModifiers = ['declaration', 'definition', 'readonly'];
export const legend = new SemanticTokensLegend(tokenTypes, tokenModifiers);

export const tokensData: {
	position: TokenRange,
	definition: TokenRange | string,
	info: {
		range?: TokenRange,
		type?: string;
	}
}[] = [];

export const diagnostics = languages.createDiagnosticCollection('si');

export const str = (r: Range): string => {
	return `${r.start.line}:${r.start.character} - ${r.end.line}:${r.end.character}`;
}

const addDef = (name: string, description: string, returnType: string | null, parameterTypes: string[]) => {
	baseEnvironment.functions.push({
		type: 'built-in',
		kind: 'def',
		name,
		data: description,
		parameterTypes,
		returnType
	});
}

const addDot = (name: string, description: string, returnType: string | null, parameterTypes: string[]) => {
	baseEnvironment.functions.push({
		type: 'built-in',
		kind: 'dot',
		name,
		data: description,
		parameterTypes,
		returnType
	});
}

const addUnary = (name: string, description: string, returnType: string, parameterType: string) => {
	baseEnvironment.operators.push({
		type: 'built-in',
		kind: 'unary',
		name,
		data: description,
		parameterTypes: [parameterType],
		returnType
	})
}

const addBinary = (name: string, description: string, returnType: string, parameterTypes: [string, string]) => {
	baseEnvironment.operators.push({
		type: 'built-in',
		kind: 'binary',
		name,
		data: description,
		parameterTypes,
		returnType
	})
}

const addConst = (name: string, description: string, varType: string) => {
	baseEnvironment.variables.set(name, {
		type: 'built-in',
		kind: 'const',
		data: description,
		varType
	});
}

const addType = (name: string, description: string): string => {
	const type: EnvironmentType = {
		type: 'built-in',
		data: description
	};
	baseEnvironment.types.set(name, type);
	return name;
}

export const addEnum = (name: string, description: string, values: string[], boolType?: string): string => {
	const type = addType(name, description);
	values.forEach(v => {
		addConst(v, `A \`${v}\` value of enum ${name}`, type);
	});
	addBinary('==', `Checks if the first ${name} value is equal to the second`, boolType ?? type, [type, type]);
	addBinary('!=', `Checks if the first ${name} value is not equal to the second`, boolType ?? type, [type, type]);
	return type;
}

export const baseEnvironment: Environment = {
	type: 'scope',
	functions: [],
	operators: [],
	types: new Map(),
	variables: new Map()
};

export const precedence: Record<ParseReturnType<typeof binaryOperator>, number> = {
	'||': 3,
	'&&': 4,
	'==': 5,
	'!=': 5,
	'<=': 5,
	'>=': 5,
	'<': 5,
	'<s': 5,
	'<u': 5,
	'>': 5,
	'+': 6,
	'-': 6,
	'&': 6,
	'|': 6,
	'^': 6,
	'*': 7,
	'/': 7,
	'%': 7,
	'ror': 7,
	'rol': 7,
	'<<': 7,
	'>>': 7,
	'asr': 7
}

const boolType = addEnum('Bool', 'A boolean value', ['fail', 'true']);
addUnary('!', 'Negates the boolean', boolType, boolType);
addBinary('||', 'ORs two booleans', boolType, [boolType, boolType]);
addBinary('&&', 'ANDs two booleans', boolType, [boolType, boolType]);

addEnum('TestResult', 'Describes whether the test passes, fails, or wins the level', ['pass', 'fail', 'win'], boolType);

const anyType = addType('@', 'Any type');

const stringType = addType('String', 'A string type');
addBinary('+', 'Adds two strings together', stringType, [stringType, stringType]);
addBinary('==', 'Checks if the first array is equal to the second', boolType, [stringType, stringType]);
addBinary('!=', 'Checks if the first array is not equal to the second', boolType, [stringType, stringType]);

const intType = addType('Int', 'A type allowing any integer to be passed in');

const addIntOperations = (iType: string) => {
	addUnary('~', 'Inverts the bits of the integer', iType, iType);
	addUnary('-', 'Negates the integer', iType, iType);

	addBinary('+', 'Adds two integers together', iType, [iType, iType]);
	addBinary('-', 'Subtracts two integers together', iType, [iType, iType]);
	addBinary('*', 'Multiplies two integers together', iType, [iType, iType]);
	addBinary('/', 'Divides two integers together', iType, [iType, iType]);
	addBinary('%', 'Calculates the modulo of the first integer by the second one', iType, [iType, iType]);
	addBinary('&', 'ANDs bits of two integers together', iType, [iType, iType]);
	addBinary('|', 'ORs bits of two integers together', iType, [iType, iType]);
	addBinary('^', 'XORs bits of two integers together', iType, [iType, iType]);
	addBinary('>>', 'Shifts the first integer right by the second integers value', iType, [iType, iType]);
	addBinary('<<', 'Shifts the first integer left by the second integers value', iType, [iType, iType]);
	addBinary('rol', 'Rotates the first integer left by the second integers value', iType, [iType, iType]);
	addBinary('ror', 'Rotates the first integer right by the second integers value', iType, [iType, iType]);
	addBinary('asr', 'Arithmetically shifts the first integer right by the second integers value', iType, [iType, iType]);
	
	addBinary('>', 'Checks if the first integer is larger than the second', boolType, [iType, iType]);
	addBinary('<', 'Checks if the first integer is smaller than the second', boolType, [iType, iType]);
	addBinary('<s', 'Checks if the first integer is smaller (signed) than the second', boolType, [iType, iType]);
	addBinary('<u', 'Checks if the first integer is smaller (unsigned) than the second', boolType, [iType, iType]);
	addBinary('>=', 'Checks if the first integer is larger or equal to the second', boolType, [iType, iType]);
	addBinary('<=', 'Checks if the first integer is smaller or equal to the second', boolType, [iType, iType]);
	addBinary('!=', 'Checks if the first integer is not equal to the second', boolType, [iType, iType]);
	addBinary('==', 'Checks if the first integer is equal to the second', boolType, [iType, iType]);
}

const seedType = addType('Seed', 'A type used for seeding the random generator');
addDef('get_random_seed',				'pub def get_random_seed() Seed {', seedType, []);
addDef('next',							'pub dot next($s: Seed) Int {', intType, [seedType]);
addDef('random',						'pub def random(max: Int) Int {', intType, [intType]);

const sintType = addType('SInt', 'A type allowing any signed integer to be passed in');
const uintType = addType('UInt', 'A type allowing any unsigned integer to be passed in');
for (let width = 1; width <= 2048; width++) {
	const s = addType('S' + width, `A signed integer of width ${width}`);
	addIntOperations(s);

	const u = addType('U' + width, `An unsigned integer of width ${width}`);
	addIntOperations(u);
}
addIntOperations(sintType);
addIntOperations(uintType);
addIntOperations(intType);

const arr = getArrayType.bind(null, [baseEnvironment]);
addDot('find', 							'pub dot find(array: [@Any], value: @Any) Int {', intType, [arr(anyType), anyType]);
addDot('len', 							'pub dot len(string: String) Int {', intType, [stringType]);
addDot('len', 							'pub dot len(array: [@Any]) Int {', intType, [arr(anyType)]);
addDot('contains',						'pub dot contains(array: [@Type], value: @Type) Bool {', boolType, [arr(anyType), anyType]);
addDot('in',							'pub dot in(value: @Type, array: [@Type]) Bool {', boolType, [anyType, arr(anyType)]);
addDef('high', 							'pub dot high(a: [@Any]) Int {', intType, [arr(anyType)]);
addDef('sort',							'pub def sort($arr: [@Any]) {', null, [arr(anyType)]);
addDef('quick_sort', 					'pub def quick_sort($arr: [@Any]) {', null, [arr(anyType)]);
addDef('sample',						'pub def sample(array: [@Any]) @Any {', anyType, [arr(anyType)]);
addBinary('+', 'Concatenates two arrays together', arr(anyType), [arr(anyType), arr(anyType)]);
addBinary('==', 'Checks if the first array is equal to the second', boolType, [arr(anyType), arr(anyType)]);
addBinary('!=', 'Checks if the first array is not equal to the second', boolType, [arr(anyType), arr(anyType)]);

addDef('_size', 						'pub def _size(data: @Any) Int {', intType, [anyType]);
addDef('array', 						'pub def array(length: Int, value: @Any) [@Any] {', arr(anyType), [intType, anyType]);
addDef('random', 						'pub def random(max: Int) Int {', intType, [intType]);
addDef('min', 							'pub def min(a: Int, b: Int) Int {', intType, [intType, intType]);
addDef('max', 							'pub def max(a: Int, b: Int) Int {', intType, [intType, intType]);
addDef('log10', 						'pub def log10(a: Int) Int {', intType, [intType]);
addDef('int', 							'pub def int(value: String) Int {', intType, [stringType]);
addDef('str', 							'pub def str(value: @Any) String {', stringType, [anyType]);
addDef('exit', 							'pub def exit() {', null, []);
addDef('exit', 							'pub def exit(code: Int) {', null, [intType]);
addDef('get_tick', 						'pub def get_tick() Int {', intType, []);
addDef('get_last_time', 				'pub def get_last_time() Int {', intType, []);
addDef('get_register_value', 			'pub def get_register_value(register: Int) Int {', intType, [intType]);
addDef('has_ram', 						'pub def has_ram() Bool {', boolType, []);
addDef('get_ram_value', 				'pub def get_ram_value(address: Int) Int {', intType, [intType]);
addDef('get_ram_size', 					'pub def get_ram_size() Int {', intType, []);
addDef('get_delay_score', 				'pub def get_delay_score() Int {', intType, []);
addDef('get_component_count', 			'pub def get_component_count() Int {', intType, []);
addDef('get_program_address', 			'pub def get_program_address() Int {', intType, []);
addDef('get_program_output', 			'pub def get_program_output() Int {', intType, []);
addDef('get_level_memory', 				'pub def get_level_memory(id: String) Int {', intType, [stringType]);
addDef('set_custom_input_text', 		'pub def set_custom_input_text(text: String) {', null, [stringType]);
addDef('ui_set_hidden', 				'pub def ui_set_hidden(id: String, hidden: Bool) {', null, [stringType, boolType]);
addDef('ui_set_text', 					'pub def ui_set_text(id: String, text: String) {', null, [stringType, stringType]);
addDef('ui_set_position', 				'pub def ui_set_position(id: String, x: Int, y: Int) {', null, [stringType, intType, intType]);
addDef('set_error', 					'pub def set_error(text: String) {', null, [stringType]);
addDef('output', 						'pub def output(text: String) {', null, [stringType]);
addDef('add_keyboard_value', 			'pub def add_keyboard_value(value: Int) {', null, [intType]);
addDef('has_time_component', 			'pub def has_time_component() Bool {', boolType, []);
addDef('has_keyboard_component', 		'pub def has_keyboard_component() Bool {', boolType, []);
addDef('has_console_component', 		'pub def has_console_component() Bool {', boolType, []);
addDef('get_assembler_register_count', 	'pub def get_assembler_register_count() Int {', intType, []);
addDef('get_console_offset', 			'pub def get_console_offset() Int {', intType, []);
addDef('get_assembler_width', 			'pub def get_assembler_width() Int {', intType, []);
addDef('get_latency_ram_is_busy', 		'pub def get_latency_ram_is_busy() Bool {', boolType, []);
addDef('set_address_text', 				'pub def set_address_text(text: String) {', null, [stringType]);
addDef('set_value_text', 				'pub def set_value_text(text: String) {', null, [stringType]);
addDef('get_cycle_count', 				'pub def get_cycle_count() Int {', intType, []);
addDef('get_probe_value', 				'pub def get_probe_value() Int {', intType, []);
addDef('get_gate_score', 				'pub def get_gate_score() Int {', intType, []);
addDef('print', 						'pub def print(input: @Any) {', null, [anyType]);

addConst('Z_STATE', 'Constant denoting the `Hi-Z` state of the wire.\n\nEquivalent to `0x8000_0000_0000_0000`.', intType);