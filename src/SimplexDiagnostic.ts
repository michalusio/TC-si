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

    public toString(): string {
        let sev: string;
        switch (this.severity) {
            case DiagnosticSeverity.Error:
                sev = "Error";
                break;
            case DiagnosticSeverity.Warning:
                sev = "Warning";
                break;
            case DiagnosticSeverity.Information:
                sev = "Information";
                break;
            case DiagnosticSeverity.Hint:
                sev = "Hint";
                break;
        }
        return `${sev} at ${this.range.start.line}:${this.range.start.character} - ${this.range.end.line}:${this.range.end.character} : ${this.message}`;
    }
}