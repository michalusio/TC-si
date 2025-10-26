import assert from 'assert';
import { cwd } from 'process';
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { map, seq, intP, str, spaces, spacesPlus, regex, ParseText, any } from 'parser-combinators';
import { checkVariableExistence, performParsing } from './checks';
import { baseEnvironment, isSymphonyFile, log, tokensData } from './storage';
import { getRecoveryIssues } from './parsers/base';
import { DiagnosticSeverity } from 'vscode';
import { deduplicateDiagnostics } from './extension';
import { SimplexDiagnostic } from './SimplexDiagnostic';
import { timings } from './parsers/utils';
import { generateMockDocument } from './workspace';
import { checkSymphonyDiagnostics } from './parsers/symphony';

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
        if (isSymphonyFile(document)) {
            checkSymphonyDiagnostics(document, parseResult, diags);
        }
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