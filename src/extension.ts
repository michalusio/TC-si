import { languages } from "vscode";
import { legend } from "./storage";
import { declarationProvider } from "./declarations";
import { renameProvider } from "./rename";
import { tokenProvider } from "./tokens";

const selector = { language: 'si', scheme: 'file' };

languages.registerDocumentSemanticTokensProvider(selector, tokenProvider, legend);
languages.createDiagnosticCollection()
languages.registerDeclarationProvider(selector, declarationProvider);
languages.registerRenameProvider(selector, renameProvider);
