import assert from 'assert';
import { cwd } from 'process';
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { map, seq, intP, str, spaces, spacesPlus, regex, ParseText, any } from 'parser-combinators';
import { checkVariableExistence, performParsing } from './checks';
import { baseEnvironment, emptyScope, isSymphonyFile, log, tokensData } from './storage';
import { DiagnosticSeverity, Position } from 'vscode';
import { deduplicateDiagnostics } from './extension';
import { SimplexDiagnostic } from './SimplexDiagnostic';
import { timings } from './parsers/utils';
import { generateMockDocument } from './workspace';
import { checkSymphonyDiagnostics } from './parsers/symphony';
import systemCode from "./compiler/systemCode.si";
import { getDefinition, parseAndTypeCheck } from './parseAndTypeCheck';
import { CompilationResult, compile, getTextRepresentation } from './compiler';
import path from 'path';
import { getPositionInformation } from './parser';

const diagnosticParser = map(
    seq(
        str('//#'),
        spaces,
        map(
            seq(
                seq(
                    intP,
                    str(':'),
                    intP
                ),
                seq(
                    spaces,
                    str('-'),
                    spaces
                ),
                seq(
                    intP,
                    str(':'),
                    intP
                ),
                seq(
                    spacesPlus,
                    str('-'),
                    any(
                        str('Error'),
                        str('Warning'),
                        str('Information'),
                        str('Hint')
                    )
                ),
                seq(
                    spacesPlus,
                    str('-'),
                    regex(/.+/, 'Message')
                )
            ),
            ([[sl, _, sc], __, [el, ___, ec], [____, _____, severity], [______, _______, message]]) => ({
                start: {
                    line: sl-1,
                    character: sc-1
                },
                end: {
                    line: el-1,
                    character: ec-1
                },
                message,
                severity: severity === 'Error'
                    ? DiagnosticSeverity.Error
                    : (
                        severity === 'Warning'
                            ? DiagnosticSeverity.Warning
                            : (
                                severity === 'Information'
                                ? DiagnosticSeverity.Information
                                : DiagnosticSeverity.Hint
                            )
                    )
            })
        )
    ),
    ([_, __, diag]) => diag
);

function performTest(path: string, codeText: string, codeLines: string[]): SimplexDiagnostic[] {
    const document = generateMockDocument(path, codeText, codeLines);
    log.clear();
    tokensData.length = 0;
    let [parseResult, diags] = performParsing(document);
    diags = deduplicateDiagnostics(diags);

    if (parseResult) {
        checkVariableExistence(
            document,
            parseResult,
            [
                baseEnvironment,
                emptyScope(),
            ],
            diags
        );
        if (isSymphonyFile(document)) {
            checkSymphonyDiagnostics(document, parseResult, diags);
        }
    }
    return diags;
}

function performAssemblyTest(docPath: string, codeText: string, codeLines: string[]): CompilationResult | null {
    const document = generateMockDocument(docPath, codeText, codeLines);
    const systemLines = systemCode.split('\n').length;
    const combinedCode = `${systemCode}\n${document.getText()}`;
    let [parseResult, diags, compiledDocument] = parseAndTypeCheck(combinedCode);

    if (!parseResult) {
      return null;
    }

    if (diags.some(d => d.range.start.line < systemLines && d.severity === DiagnosticSeverity.Error)) {
      return null;
    }
    if (diags.some(d => d.range.start.line >= systemLines && d.severity === DiagnosticSeverity.Error)) {
      return null;
    }

    const systemLinesOffset = compiledDocument.offsetAt(new Position(systemLines - 1, 0));

    return compile(parseResult, {
      name: path.parse(document.fileName).name,
      librariesEndLineOffset: systemLinesOffset,
      optimizationLevel: 'O2',
      stripDebugSymbols: true
    }, {
      document: compiledDocument,
      getDefinition: getDefinition(parseResult, systemLinesOffset),
      typeGetter: range => getPositionInformation(compiledDocument, range)?.info?.type ?? null,
      topmost: true
    });
}

readdirSync(join(cwd(), '../../tests'), { recursive: true, encoding: 'utf-8' })
    .filter(fileName => fileName.endsWith('.si'))
    .forEach(fileName => {
        const path = join(cwd(), '../../tests', fileName);
        const fileLines = readFileSync(path, { encoding: 'utf-8' })
            .split('\n')
            .map(line => line.replaceAll('\r', ''));
        const diagnosticLines = fileLines
            .filter(line => line.startsWith('//#'))
        const codeLines = fileLines
            .filter(line => !line.startsWith('//#'));
        const codeText = codeLines.join('\n');

        suite(fileName, function () {
            this.timeout(0);
            this.slow(250);
            if (diagnosticLines.length === 0) {
                test('Should have no diagnostics', () => {
                    const diags = performTest(path, codeText, codeLines);
                    diags.forEach(diag => console.error('Leftover: ' + JSON.stringify(diag)));
                    assert(diags.length === 0, 'There should have been no diagnostics');
                });
            } else {
                test(`Should have correct diagnostics (${diagnosticLines.length})`, () => {
                    const diagnostics = diagnosticLines.map(line => ParseText(line, diagnosticParser));
                    let diags = performTest(path, codeText, codeLines);
                    let error = false;
                    diagnostics.forEach(expected => {
                        const foundDiagnosticIndex = diags.findIndex(provided => {
                            return provided.message.trim() === expected.message.trim()
                                && provided.severity === expected.severity
                                && provided.range.start.line === expected.start.line
                                && provided.range.start.character === expected.start.character
                                && provided.range.end.line === expected.end.line
                                && provided.range.end.character === expected.end.character;
                        });
                        if (foundDiagnosticIndex < 0) {
                            console.error('Expected: ' + JSON.stringify(expected));
                            error = true;
                        } else {
                            diags = diags.filter((_, i) => i !== foundDiagnosticIndex);
                        }
                    });
                    diags.forEach(diag => console.error('Leftover: ' + JSON.stringify(diag)));
                    assert(!error && diags.length === 0, `The diagnostics should all be specified`);
                });
            }
            test('Should parse under 1000ms', () => {
                const timeStart = Date.now();
                performTest(path, codeText, codeLines);
                if (Date.now() - timeStart >= 1000) {
                    console.info(JSON.stringify(timings, null, 2));
                    assert.fail('Parsing was over 1000ms');
                }
            });
        });
    });

readdirSync(join(cwd(), '../../compiler-tests'), { recursive: true, encoding: 'utf-8' })
    .filter(fileName => fileName.endsWith('.si'))
    .forEach(fileName => {
        const path = join(cwd(), '../../compiler-tests', fileName);
        const fileLines = readFileSync(path, { encoding: 'utf-8' })
            .split('\n')
            .map(line => line.replaceAll('\r', ''));
        const resultFile = readFileSync(path+'.symphony', { encoding: 'utf-8' });
        const codeText = fileLines.join('\n');

        suite(fileName, function () {
            test('Should generate correct assembly code', () => {
                const result = performAssemblyTest(path, codeText, fileLines);
                if (!result) assert.fail('No compilation result');
                assert.equal(getTextRepresentation(result), resultFile, 'The compiled code should be correct');
            });
        });
    });

suite('general', () => {
    const text = `pub def malloc(size: U16) Rc {
    var heap = (<[U16]>HEAP_ALLOCATOR_START)
    var block_end_pointer = 0
    while (true) {
        var next_block_pointer = heap[block_end_pointer]
        if (next_block_pointer == 0) {
            return <Rc> 0
        }

        var block_length = heap[next_block_pointer]
        if (block_length == size) {
            heap[block_end_pointer] = next_block_pointer + block_length - 1
            return <Rc> (HEAP_ALLOCATOR_START + next_block_pointer + next_block_pointer)
        } elif (block_length > size + 1) {
            var new_next_block_pointer = next_block_pointer + size - 1
            heap[block_end_pointer] = new_next_block_pointer
            heap[new_next_block_pointer] = block_length - size
            return <Rc> (HEAP_ALLOCATOR_START + next_block_pointer + next_block_pointer)
        }

        block_end_pointer += block_length - 1
    }
    return <Rc> 0
}`;
    const document = generateMockDocument('test.txt', text, text.split('\n'));
    let anyFail = false
    for (let offset = 0; offset < text.length; offset++) {
        if (offset !== document.offsetAt(document.positionAt(offset))) {
            anyFail = true;
            const p = document.positionAt(offset);
            test(`positionAt <=> offsetAt (${offset})`, () => {
                assert.equal(offset, document.offsetAt(document.positionAt(offset)), `Calculated position is ${p.line}:${p.character}`);
            });
        }
    }
    if (!anyFail) {
        test(`positionAt <=> offsetAt (${text.length} tests)`, () => {
        });
    }
});