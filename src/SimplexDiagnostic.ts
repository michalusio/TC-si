import { Diagnostic, DiagnosticSeverity, Range } from "vscode";

export class SimplexDiagnostic extends Diagnostic {
    constructor(range: Range, message: string, severity?: DiagnosticSeverity) {
        super(range, message, severity);
        this.source = 'TC Simplex';
    }
}