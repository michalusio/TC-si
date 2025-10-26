import { basename } from "path";
import { EndOfLine, Position, Range, TextDocument, Uri, workspace } from "vscode";

const setting = <T>(name: string, defaultValue: T) => {
    if (workspace.getConfiguration('tcsi').get(name) == null) {
        try {
            workspace.getConfiguration('tcsi').update(name, defaultValue);
        } catch (e) {}
    }
    return () => workspace.getConfiguration('tcsi').get(name) as T;
}

export const explicitReturn = setting('warnOnMissingExplicitReturn', false);
export const typeCheck = setting('showTypeCheckingErrors', true);
export const showInlayTypeHints = setting('showInlayTypeHints', true);
export const logDebugInfo = setting('logDebugInfo', false);

export const generateMockDocument = (path: string, text: string, textSplitted: string[]): TextDocument => {
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