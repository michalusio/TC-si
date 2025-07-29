import assert from 'assert';
import { cwd } from 'process';
import { readdirSync, readFileSync } from 'fs';
import { basename, join } from 'path';
import { map, seq, intP, str, spaces, spacesPlus, regex, ParseText, any } from 'parser-combinators';
import { checkVariableExistence, performParsing } from './checks';
import { baseEnvironment, log, tokensData } from './storage';
import { getRecoveryIssues } from './parsers/base';
import { DiagnosticSeverity, EndOfLine, Position, Range, TextDocument, Uri } from 'vscode';
import { deduplicateDiagnostics } from './extension';
import { SimplexDiagnostic } from './SimplexDiagnostic';
import { timings } from './parsers/utils';

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

const generateMockDocument = (path: string, text: string, textSplitted: string[]): TextDocument => {
    return {
        uri: Uri.file(path),
        fileName: basename(path),
        isUntitled: false,
        languageId: 'si',
        version: 1,
        isDirty: false,
        isClosed: false,
        eol: EndOfLine.LF,
        encoding: 'utf8',
        lineCount: text.split("\n").length,
        save: () => Promise.resolve(false),
        lineAt: (lineOrPosition: number | Position) => {
            const lineNumber = typeof lineOrPosition === 'number'
                ? lineOrPosition
                : lineOrPosition.line;
            const lineText = textSplitted[lineNumber];
            const nonWhiteSpaceIndex = lineText.search(/\S/);
            return {
                range: new Range(
                    lineNumber,
                    0,
                    lineNumber,
                    lineText.length
                ),
                text: lineText,
                isEmptyOrWhitespace: nonWhiteSpaceIndex === -1,
                rangeIncludingLineBreak: new Range(
                    lineNumber,
                    0,
                    lineNumber,
                    lineText.length + 1
                ),
                lineNumber,
                firstNonWhitespaceCharacterIndex: nonWhiteSpaceIndex === -1
                    ? lineText.length
                    : nonWhiteSpaceIndex
            }
        },
        offsetAt: (position: Position) => {
            let index = 0;
            for (let lineNumber = 0; lineNumber < textSplitted.length; lineNumber++) {
                if (position.line === lineNumber) {
                    index += textSplitted[lineNumber].length;
                } else {
                    index += position.character;
                }
            }
            return index;
        },
        positionAt: (offset: number) => {
            for (let lineNumber = 0; lineNumber < textSplitted.length; lineNumber++) {
                if (offset > textSplitted[lineNumber].length + 1) {
                    offset -= textSplitted[lineNumber].length + 1;
                } else {
                    return new Position(lineNumber, offset);
                }
            }
            return new Position(textSplitted.length - 1, textSplitted[textSplitted.length - 1].length - 1);
        },
        getText: (range?: Range) => {
            if (!range) return text;
            throw 'unsupported';
        },
        getWordRangeAtPosition: (position: Position) => {
            return new Range(position, position);
        },
        validatePosition: () => { throw 'unsupported'; },
        validateRange: () => { throw 'unsupported'; }
    };
}

function performTest(path: string, codeText: string, codeLines: string[]): SimplexDiagnostic[] {
    const document = generateMockDocument(path, codeText, codeLines);
    log.clear();
    tokensData.length = 0;
    getRecoveryIssues().length = 0;
    let [parseResult, diags] = performParsing(document);
    diags = deduplicateDiagnostics(diags);

    if (parseResult) {
        checkVariableExistence(
            document,
            parseResult,
            [
            baseEnvironment,
            {
                type: "scope",
                switchTypes: new Map(),
                functions: [],
                operators: [],
                types: new Map(),
                variables: new Map(),
            },
            ],
            diags
        );
    }
    return diags;
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