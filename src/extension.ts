import {
  commands,
  CodeAction,
  CodeActionKind,
  CompletionItem,
  CompletionItemKind,
  CompletionItemProvider,
  Declaration,
  DeclarationProvider,
  DiagnosticSeverity,
  DocumentSemanticTokensProvider,
  ExtensionContext,
  Hover,
  HoverProvider,
  InlayHint,
  InlayHintKind,
  InlayHintsProvider,
  languages,
  LanguageStatusSeverity,
  LocationLink,
  MarkdownString,
  ProviderResult,
  Range,
  RenameProvider,
  SemanticTokens,
  SemanticTokensBuilder,
  Uri,
  WorkspaceEdit,
  window,
  ViewColumn,
  workspace,
  QuickPickItem,
  QuickPickItemKind,
  TextDocumentContentProvider,
  EventEmitter,
  TextDocument,
  Position,
} from "vscode";
import path from 'path';
import {
  clearTokensData,
  diagnostics,
  isSymphonyFile,
  legend,
  log,
  logLine,
  migrateTokenData,
} from "./storage";
import { getPositionInfo, getDeclarations, getPositionInformation } from "./parser";
import { typeTokenToTypeString } from "./typeSetup";
import './definitions';
import { showInlayTypeHints } from "./workspace";
import { compile } from "./compiler";
import { getTextRepresentation } from "./compiler/representation";
import systemCode from "./compiler/systemCode.si";
import { OptLevel } from "./compiler/optimizer";
import { SimplexDiagnostic } from "./SimplexDiagnostic";
import { getDefinition, parseAndTypeCheck } from "./parseAndTypeCheck";

const diagnosticsPerFile: Record<string, SimplexDiagnostic[]> = {};
export const deduplicateDiagnostics = (diags: SimplexDiagnostic[]): SimplexDiagnostic[] => {
  const key = (d: SimplexDiagnostic) => `${d.message}(${d.range.start.line}:${d.range.start.character},${d.range.end.line}:${d.range.end.character})`;
  const container: Record<string, SimplexDiagnostic> = {};
  diags.forEach(d => {
    const k = key(d);
    if (!(k in container)) {
      container[k] = d;
    }
  })
  return Object.values(container);
}

export function activate(context: ExtensionContext)
{
  const selector = { language: "si", scheme: "file" };

  const renameProvider: RenameProvider = {
    prepareRename(document, position): ProviderResult<Range> {
      const data = getPositionInfo(document, position);
      if (!data) return Promise.reject();
      if (typeof data.definition === "string") return Promise.reject();
      return new Range(
        document.positionAt(data.current.start),
        document.positionAt(data.current.end)
      );
    },

    provideRenameEdits(
      document,
      position,
      newName
    ): ProviderResult<WorkspaceEdit> {
      const data = getPositionInfo(document, position);
      if (!data) return;
      if (typeof data.definition === "string") return;
      const edits = new WorkspaceEdit();
      for (const { start, end } of data.all) {
        edits.replace(
          document.uri,
          new Range(document.positionAt(start), document.positionAt(end)),
          newName
        );
      }
      return edits;
    },
  };

  const declarationProvider: DeclarationProvider = {
    provideDeclaration(document, position): ProviderResult<Declaration> {
      const data = getPositionInfo(document, position);
      if (!data) return;

      const currentStartPosition = document.positionAt(data.current.start);
      const currentEndPosition = document.positionAt(data.current.end);

      if (typeof data.definition === "string") return;

      const definitionStartPosition = document.positionAt(data.definition.start);
      const definitionEndPosition = document.positionAt(data.definition.end);

      const definitionLine = document.lineAt(definitionStartPosition);

      const link: LocationLink = {
        targetUri: document.uri,
        originSelectionRange: new Range(currentStartPosition, currentEndPosition),
        targetSelectionRange: new Range(
          definitionStartPosition,
          definitionEndPosition
        ),
        targetRange: definitionLine.range,
      };

      return [link];
    },
  };

  const hoverProvider: HoverProvider = {
    provideHover(document, position): ProviderResult<Hover> {
      const data = getPositionInfo(document, position);
      if (!data) {
        return;
      }

      const range = new Range(
        document.positionAt(data.current.start),
        document.positionAt(data.current.end)
      );
      if (typeof data.definition === "string") {
        const label = new MarkdownString();
        if (data.definition.startsWith(';')) {
          label.appendText(data.definition.slice(1));
        } else {
          label.appendCodeblock(data.definition, 'si');
        }
        return new Hover(label, range);
      }
      
      if (!data.info.range) {
        
        return;
      }

      const label = new MarkdownString();
      const startPosition = document.positionAt(data.info.range.start);
      const line = document.lineAt(startPosition.line);
      label.appendCodeblock(line.text.trim(), "si");
      
      return new Hover(label, range);
    },
  };

  const inlayProvider: InlayHintsProvider = {
    provideInlayHints(document, range) {
      if (!showInlayTypeHints()) return [];
      const declarations = getDeclarations(document);
      return declarations
        .filter(d => range.contains(document.positionAt(d.position.end)))
        .map(d => new InlayHint(document.positionAt(d.position.end), ": "+typeTokenToTypeString(d.info.type!), InlayHintKind.Type));
    },
  }

  const dotCompletionProvider: CompletionItemProvider = {
    provideCompletionItems(document, position, token, context): ProviderResult<CompletionItem[]> {
      const info = getPositionInfo(document, position.translate(0, -1));
      if (!info || info.current.end !== document.offsetAt(position) - 1) return [];
      return info.dotFunctionSuggestions.map(s =>  new CompletionItem({
        label: s[0],
        description: typeof s[1] === 'string' ? s[1] : document.getText(new Range(
          document.positionAt(s[1].start),
          document.positionAt(s[1].end)
        ))
      }, CompletionItemKind.Method));
    },
  }

  const statusItem = languages.createLanguageStatusItem('si', selector);
  statusItem.name = "TC Simplex Language status";
  context.subscriptions.push(statusItem);

  const tokenProvider: DocumentSemanticTokensProvider = {
    provideDocumentSemanticTokens(document, token): ProviderResult<SemanticTokens> {
      statusItem.busy = true;
      statusItem.text = "TC Simplex is parsing the file";
      statusItem.severity = LanguageStatusSeverity.Information;

      log.clear();
      clearTokensData(document);
      diagnostics.clear();
      
      return new Promise<SemanticTokens>((res, rej) => {
        const tokensBuilder = new SemanticTokensBuilder(legend);

        const startTime = Date.now();

        if (token.isCancellationRequested) {
          statusItem.busy = false;
          statusItem.text = "TC Simplex stopped parsing the file";
          rej();
          return;
        }

        const systemLines = systemCode.split('\n').length;
        const combinedCode = isSymphonyFile(document)
          ? `${systemCode}\n${document.getText()}`
          : document.getText();

        let [parseResult, diags, compiledDocument] = parseAndTypeCheck(combinedCode);

        if (token.isCancellationRequested) {
          statusItem.busy = false;
          statusItem.text = "TC Simplex stopped parsing the file";
          rej();
          return;
        }

        if (parseResult) {
          statusItem.busy = false;
          statusItem.text = `TC Simplex parsed the file (in ${Date.now() - startTime}ms)`;
        } else {
          statusItem.busy = false;
          statusItem.severity = LanguageStatusSeverity.Warning;
          statusItem.text = `TC Simplex failed to parse the file (in ${Date.now() - startTime}ms)`;
        }

        diags = migrateTokenData(compiledDocument, document, diags, systemLines);
        diagnosticsPerFile[document.uri.toString()] = deduplicateDiagnostics(diags);
        Object.entries(diagnosticsPerFile).forEach(([key, value]) => {
          diagnostics.set(Uri.parse(key, true), value);
        });

        recompile(document, diags);
        res(tokensBuilder.build());
      });
    },
  };

  context.subscriptions.push(languages.registerDocumentSemanticTokensProvider(
    selector,
    tokenProvider,
    legend
  ));

  context.subscriptions.push(workspace.onDidCloseTextDocument(document => {
    const docId = Uri.parse(document.uri.with({
      scheme: 'symphony',
    }).toString().replace('.si', '.symphony'));
    delete docIdMap[docId.toString()];
  }));
  context.subscriptions.push(workspace.registerTextDocumentContentProvider('symphony', documentContentProvider));
  context.subscriptions.push(languages.registerDeclarationProvider(selector, declarationProvider));
  context.subscriptions.push(languages.registerHoverProvider(selector, hoverProvider));
  context.subscriptions.push(languages.registerInlayHintsProvider(selector, inlayProvider));
  context.subscriptions.push(languages.registerRenameProvider(selector, renameProvider));
  context.subscriptions.push(languages.registerCompletionItemProvider(selector, dotCompletionProvider, '.'));
  context.subscriptions.push(languages.registerCodeActionsProvider(selector, {
    provideCodeActions(document, range, context) {
      const fixes = context.diagnostics
        .filter(d => d.severity === DiagnosticSeverity.Hint && d.message.startsWith('This value could be replaced with '))
        .filter(d => d.range.contains(range));
      return fixes.map(f => {
        const value = f.message.slice(34);
        const ca = new CodeAction(`Replace the expression with value ${value}`);
        ca.diagnostics = [f];
        ca.isPreferred = true;
        ca.kind = CodeActionKind.QuickFix;
        const we = new WorkspaceEdit();
        we.replace(document.uri, f.range, value);
        ca.edit = we;
        return ca;
      });
    },
  }));

  //context.subscriptions.push(commands.registerCommand("si.showSymphonyAssembly", async () => {
  //  const editor = window.activeTextEditor;
  //  if (editor?.document?.languageId !== "si") {
  //    await window.showErrorMessage("No open SI file found - try opening one.");
  //    return;
  //  }
  //
  //  const stripSymbols = await window.showQuickPick([
  //    <QuickPickItem>{
  //      label: "-S",
  //      kind: QuickPickItemKind.Default,
  //      detail: 'Comments will be stripped'
  //    },
  //    <QuickPickItem>{
  //      label: "",
  //      kind: QuickPickItemKind.Default,
  //      detail: 'All comments will be kept'
  //    }
  //  ], {
  //    title: "Choose stripping level"
  //  });
  //
  //  const optimize = await window.showQuickPick([
  //    <QuickPickItem>{
  //      label: "-O2",
  //      kind: QuickPickItemKind.Default,
  //      detail: 'All optimizations will be applied'
  //    },
  //    <QuickPickItem>{
  //      label: "-O1",
  //      kind: QuickPickItemKind.Default,
  //      detail: 'Optimizations which do not aggressively change the behavior will be applied'
  //    },
  //    <QuickPickItem>{
  //      label: "-O0",
  //      kind: QuickPickItemKind.Default,
  //      detail: 'No optimizations after initial code emission will be applied'
  //    },
  //  ], {
  //    title: "Choose optimization level",
  //  });
  //
  //  const optimizationLevel = (optimize?.label.slice(1) as OptLevel | undefined) ?? "O0";
  //  const stripDebugSymbols = stripSymbols?.label === '-S';
  //
  //  await compileDocument(editor.document, true, optimizationLevel, stripDebugSymbols);
  //}));
}

const compileDocument = async (document: TextDocument, warn: boolean, optimizationLevel: OptLevel, stripDebugSymbols: boolean) => {
  try {
    const systemLines = systemCode.split('\n').length;
    const combinedCode = `${systemCode}\n${document.getText()}`;
    let [parseResult, diags, compiledDocument] = parseAndTypeCheck(combinedCode);

    if (!parseResult) {
      if (warn) {
        await window.showErrorMessage("Cannot parse the file correctly.");
      }
      return;
    }

    if (diags.some(d => d.range.start.line < systemLines && d.severity === DiagnosticSeverity.Error)) {
      if (warn) {
        await window.showErrorMessage("Library files have errors - please fix them first.");
      }
      return;
    }
    if (diags.some(d => d.range.start.line >= systemLines && d.severity === DiagnosticSeverity.Error)) {
      if (warn) {
        await window.showErrorMessage("File has errors - please fix them first.");
      }
      return;
    }

    const systemLinesOffset = compiledDocument.offsetAt(new Position(systemLines - 1, 0));

    const compiledCode = compile(parseResult, {
      name: path.parse(document.fileName).name,
      librariesEndLineOffset: systemLinesOffset,
      optimizationLevel,
      stripDebugSymbols
    }, {
      document: compiledDocument,
      getDefinition: getDefinition(parseResult, systemLinesOffset),
      typeGetter: range => getPositionInformation(compiledDocument, range)?.info?.type ?? null,
      topmost: true
    });

    const docId = Uri.parse(document.uri.with({
      scheme: 'symphony',
    }).toString().replace('.si', '.symphony'));

    const wasLoaded = docId.toString() in docIdMap;
    docIdMap[docId.toString()] = [getTextRepresentation(compiledCode), optimizationLevel, stripDebugSymbols];

    if (wasLoaded) {
      onDidChangeEmitter.fire(docId);
    }

    const doc = await workspace.openTextDocument(docId);
    await window.showTextDocument(doc, { preview: true, viewColumn: ViewColumn.Beside, preserveFocus: true });
  } catch (ex) {
    if (ex instanceof Error) {
      logLine(ex.stack + '');
    } else {
      logLine(ex + '');
    }
    throw ex;
  }
}

const docIdMap: Record<string, [string, OptLevel, boolean]> = {};

function recompile(document: TextDocument, diags: SimplexDiagnostic[]) {
  if (diags.every(d => d.severity !== DiagnosticSeverity.Error)) {
    const docId = Uri.parse(document.uri.with({
      scheme: 'symphony',
    }).toString().replace('.si', '.symphony'));

    const obj = docIdMap[docId.toString()];

    if (obj) {
      compileDocument(document, false, obj[1], obj[2]);
    }
  }
}

const onDidChangeEmitter = new EventEmitter<Uri>();
  
const documentContentProvider = new (class implements TextDocumentContentProvider {
  onDidChange = onDidChangeEmitter.event;
  provideTextDocumentContent(uri: Uri): string {
    const id = uri.toString();
    const content = docIdMap[id];
    return content?.[0] ?? `Cannot find compiled code for ${uri.path}`;
  }
})();
