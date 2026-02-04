import { Diagnostic, DiagnosticSeverity, Range } from "vscode";

export class SimplexDiagnostic extends Diagnostic {
    constructor(range: Range, message: string, severity?: DiagnosticSeverity) {
        super(range, message, severity);
        this.source = 'TC Simplex';
    }

    public offsetLines(lines: number): SimplexDiagnostic {
        this.range = this.range.with(
            this.range.start.with(this.range.start.line + lines),
            this.range.end.with(this.range.end.line + lines)
        );
        return this;
    }
}