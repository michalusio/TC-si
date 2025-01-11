import { window, Range, SemanticTokensLegend, languages } from 'vscode';
import { TokenRange } from './parsers/ast';
import { Environment } from './checks';

export const log = window.createOutputChannel("TC-si");

const tokenTypes = ['type', 'parameter', 'variable'];
const tokenModifiers = ['declaration', 'definition', 'readonly'];
export const legend = new SemanticTokensLegend(tokenTypes, tokenModifiers);

export const tokensData: {
	position: TokenRange,
	definition: TokenRange | string,
	info?: {
		range: TokenRange
	}
}[] = [];

export const diagnostics = languages.createDiagnosticCollection('si');

export const str = (r: Range): string => {
	return `${r.start.line}:${r.start.character} - ${r.end.line}:${r.end.character}`;
}

const addDef = (name: string, description: string) => {
	baseEnvironment[1].set(name, ['built-in', 'def', description]);
}

const addDot = (name: string, description: string) => {
	baseEnvironment[1].set(name, ['built-in', 'dot', description]);
}

const addConst = (name: string, description: string) => {
	baseEnvironment[1].set(name, ['built-in', 'const', description]);
}

export const baseEnvironment: Environment = ['scope', new Map()];

addDef('array', 						'pub def array(length: Int, value: @Any) [@Any] {');
addDef('random', 						'pub def random(max: Int) Int {');
addDef('min', 							'pub def min(a: Int, b: Int) Int {');
addDef('max', 							'pub def max(a: Int, b: Int) Int {');
addDef('log10', 						'pub def log10(a: Int) Int {');
addDef('int', 							'pub def int(value: String) Int {');
addDef('str', 							'pub def str(value: @Any) String {');
addDef('exit', 							'pub def exit() {');
addDef('get_tick', 						'pub def get_tick() Int {');
addDef('get_last_time', 				'pub def get_last_time() Int {');
addDef('get_register_value', 			'pub def get_register_value(register: Int) Int {');
addDef('has_ram', 						'pub def has_ram() Bool {');
addDef('get_ram_value', 				'pub def get_ram_value(address: Int) Int {');
addDef('get_ram_size', 					'pub def get_ram_size() Int {');
addDef('get_delay_score', 				'pub def get_delay_score() Int {');
addDef('get_component_count', 			'pub def get_component_count() Int {');
addDef('get_program_address', 			'pub def get_program_address() Int {');
addDef('get_program_output', 			'pub def get_program_output() Int {');
addDef('get_level_memory', 				'pub def get_level_memory(id: String) Int {');
addDef('set_custom_input_text', 		'pub def set_custom_input_text(text: String) {');
addDef('ui_set_hidden', 				'pub def ui_set_hidden(id: String, hidden: Bool) {');
addDef('ui_set_text', 					'pub def ui_set_text(id: String, text: String) {');
addDef('ui_set_position', 				'pub def ui_set_position(id: String, x: Int, y: Int) {');
addDef('set_error', 					'pub def set_error(text: String) {');
addDef('output', 						'pub def output(text: String) {');
addDef('add_keyboard_value', 			'pub def add_keyboard_value(value: Int) {');
addDef('has_time_component', 			'pub def has_time_component() Bool {');
addDef('has_keyboard_component', 		'pub def has_keyboard_component() Bool {');
addDef('has_console_component', 		'pub def has_console_component() Bool {');
addDef('get_assembler_register_count', 	'pub def get_assembler_register_count() Int {');
addDef('get_console_offset', 			'pub def get_console_offset() Int {');
addDef('get_assembler_width', 			'pub def get_assembler_width() Int {');
addDef('get_latency_ram_is_busy', 		'pub def get_latency_ram_is_busy() Bool {');
addDef('set_address_text', 				'pub def set_address_text(text: String) {');
addDef('set_value_text', 				'pub def set_value_text(text: String) {');
addDef('get_cycle_count', 				'pub def get_cycle_count() Int {');
addDef('get_probe_value', 				'pub def get_probe_value() Int {');
addDef('get_gate_score', 				'pub def get_gate_score() Int {');
addDef('quick_sort', 					'pub def quick_sort($arr: [@Any]) {');
addDef('print', 						'pub def print(input: @Any) {');

addDot('find', 							'pub dot find(array: [@Any], value: @Any) Int {');
addDot('len', 							'pub dot len(array: [@Any]) Int {');
addDot('contains',						'pub dot contains(array: [@Type], value: @Type) Bool {');
addDot('in',							'pub dot in(value: @Type, array: [@Type]) Bool {');
addDef('high', 							'pub dot high(a: [@Any]) Int {');
addDef('sort',							'pub def sort($arr: [@Any]) {');
addDef('get_random_seed',				'pub def get_random_seed() Seed {');
addDef('next',							'pub dot next($s: Seed) Int {');
addDef('random',						'pub def random(max: Int) Int {');
addDef('sample',						'pub def sample(array: [@Any]) @Any {');

addConst('true', 'A `true` value');
addConst('false', 'A `false` value');
addConst('pass', 'Returning this value will pass the ongoing level test');
addConst('fail', 'Returning this value will fail the ongoing level test');
addConst('win', 'Returning this value will win the level');
addConst('Z_STATE', 'Constant denoting the `Hi-Z` state of the wire.\n\nEquivalent to `0x8000_0000_0000_0000`.');
