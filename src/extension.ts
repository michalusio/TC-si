import {
  commands,
  CodeAction,
  CodeActionKind,
  CompletionItem,
  CompletionItemKind,
  CompletionItemProvider,
  Declaration,
  DeclarationProvider,
  Diagnostic,
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
  TextDocument
} from "vscode";
import path from 'path';
import {
  baseEnvironment,
  clearTokensData,
  diagnostics,
  finalizeTokensData,
  isSymphonyFile,
  legend,
  log,
} from "./storage";
import { getPositionInfo, getDeclarations } from "./parser";
import { getRecoveryIssues } from "./parsers/base";
import {
  checkVariableExistence,
  performParsing,
} from "./checks";
import { typeTokenToTypeString } from "./typeSetup";
import './definitions';
import { generateMockDocument, showInlayTypeHints } from "./workspace";
import { compile } from "./compiler";
import { getTextRepresentation } from "./compiler/representation";
import { FunctionDefinition, ParserOutput, Statement, TokenRange } from "./parsers/types/ast";
import systemCode from "./compiler/systemCode.si";
import { OptLevel, StripLevel } from "./compiler/optimizer";
import { resetId } from "./compiler/utils";
import { checkSymphonyDiagnostics } from "./parsers/symphony";

const diagnosticsPerFile: Record<string, Diagnostic[]> = {};
export const deduplicateDiagnostics = (diags: Diagnostic[]): Diagnostic[] => {
  const key = (d: Diagnostic) => `${d.message}(${d.range.start.line}:${d.range.start.character},${d.range.end.line}:${d.range.end.character})`;
  const container: Record<string, Diagnostic> = {};
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
      if (!data) return;

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
      
      if (!data.info.range) return;
      
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
      getRecoveryIssues().length = 0;
      diagnostics.clear();
      
      return new Promise<SemanticTokens>(res => {
        const tokensBuilder = new SemanticTokensBuilder(legend);

        const startTime = Date.now();

        if (token.isCancellationRequested) {
          statusItem.busy = false;
          statusItem.text = "TC Simplex stopped parsing the file";
        }

        const [parseResult, diags] = performParsing(document);

        if (token.isCancellationRequested) {
          statusItem.busy = false;
          statusItem.text = "TC Simplex stopped parsing the file";
        }

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
          statusItem.busy = false;
          statusItem.text = `TC Simplex parsed the file (in ${Date.now() - startTime}ms)`;
        } else {
          statusItem.busy = false;
          statusItem.severity = LanguageStatusSeverity.Warning;
          statusItem.text = `TC Simplex failed to parse the file (in ${Date.now() - startTime}ms)`;
        }

        diagnosticsPerFile[document.uri.toString()] = deduplicateDiagnostics(diags);
        Object.entries(diagnosticsPerFile).forEach(([key, value]) => {
          diagnostics.set(Uri.parse(key, true), value);
        });
        finalizeTokensData(document);

        if (diags.every(d => d.severity !== DiagnosticSeverity.Error)) {
          const docId = Uri.parse(document.uri.with({
            scheme: 'symphony',
          }).toString().replace('.si', '.symphony'));

          const obj = docIdMap[docId.toString()];

          if (obj) {
            compileDocument(document, false, obj[1], obj[2]);
          }
        }

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

  context.subscriptions.push(commands.registerCommand("si.showSymphonyAssembly", async () => {
    const editor = window.activeTextEditor;
    if (editor?.document?.languageId !== "si") {
      await window.showErrorMessage("No open SI file found - try opening one.");
      return;
    }

    const stripSymbols = await window.showQuickPick([
      <QuickPickItem>{
        label: "-S2",
        kind: QuickPickItemKind.Default,
        detail: 'Comments will be stripped, public functions will be stripped if not used/inlined',
        description: 'Good for executables'
      },
      <QuickPickItem>{
        label: "-S1",
        kind: QuickPickItemKind.Default,
        detail: 'Comments will be stripped, but all public functions will be kept, even if inlined',
        description: 'Good for libraries'
      },
      <QuickPickItem>{
        label: "-S0",
        kind: QuickPickItemKind.Default,
        detail: 'All public functions and comments will be kept',
        description: 'Good for debugging'
      }
    ], {
      title: "Choose stripping level"
    });

    const optimize = await window.showQuickPick([
      <QuickPickItem>{
        label: "-O2",
        kind: QuickPickItemKind.Default,
        detail: 'All optimizations will be applied'
      },
      <QuickPickItem>{
        label: "-O1",
        kind: QuickPickItemKind.Default,
        detail: 'Optimizations which do not aggressively change the behavior will be applied'
      },
      <QuickPickItem>{
        label: "-O0",
        kind: QuickPickItemKind.Default,
        detail: 'No optimizations after initial code emission will be applied'
      },
    ], {
      title: "Choose optimization level",
    });

    const optimizationLevel = (optimize?.label.slice(1) as OptLevel | undefined) ?? "O0";
    const stripDebugSymbols = (stripSymbols?.label.slice(1) as StripLevel | undefined) ?? "S0";

    await compileDocument(editor.document, true, optimizationLevel, stripDebugSymbols);
  }));
}

const compileDocument = async (document: TextDocument, warn: boolean, optimizationLevel: OptLevel, stripDebugSymbols: StripLevel) => {
    resetId();
    const sysLib = await parseSystemLibrary();
    if (!sysLib) {
      if (warn) {
        await window.showErrorMessage("Cannot load the simplex system library.");
      }
      return;
    }

    log.clear();
    clearTokensData(document);
    getRecoveryIssues().length = 0;
    const [parseResult, diags] = performParsing(document);
    if (!parseResult) {
      if (warn) {
        await window.showErrorMessage("Cannot parse the file correctly.");
      }
      return;
    }
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
    checkSymphonyDiagnostics(document, parseResult, diags);
    finalizeTokensData(document);

    if (diags.some(d => d.severity === DiagnosticSeverity.Error)) {
      if (warn) {
        await window.showErrorMessage("File has errors - please fix them first.");
      }
      return;
    }

    const compiledCode = compile(parseResult, sysLib, {
      name: path.parse(document.fileName).name,
      optimizationLevel,
      stripLevel: stripDebugSymbols
    }, {
      document,
      getSystemFunction: getDefinition(sysLib, true),
      getDefinition: getDefinition(parseResult)
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
  }

const docIdMap: Record<string, [string, OptLevel, StripLevel]> = {};

function getDefinition(nodes: ParserOutput, onlyPublic: boolean = false): (rangeOrName: TokenRange | string) => FunctionDefinition | null {
  function traverse(node: Statement, rangeOrName: TokenRange | string): FunctionDefinition | null {
    switch (node.type) {
      case '_default':
      case '_reg_alloc_use':
      case 'array':
      case "binary":
      case 'break':
      case 'cast':
      case 'continue':
      case 'declaration':
      case 'dotMethod':
      case 'function':
      case 'index':
      case 'interpolated':
      case 'modification':
      case 'number':
      case 'parenthesis':
      case 'return':
      case 'string':
      case 'ternary':
      case 'type-definition':
      case 'unary':
      case 'variable':
      case 'asm':
        return null;
      case 'statements': {
          for (const s of node.statements) {
            const def = traverse(s.value, rangeOrName);
            if (def) return def;
          }
          return null;
        }
      case 'if': {
          for (const s of node.ifBlock) {
            const def = traverse(s.value, rangeOrName);
            if (def) return def;
          }
          for (const s of node.elseBlock) {
            const def = traverse(s.value, rangeOrName);
            if (def) return def;
          }
          return null;
        }
      case 'switch': {
          for (const c of node.cases) {
            for (const s of c.statements) {
              const def = traverse(s.value, rangeOrName);
              if (def) return def;
            }
          }
          return null;
        }
      case 'while': {
        for (const s of node.statements) {
          const def = traverse(s.value, rangeOrName);
          if (def) return def;
        }
        return null;
      }
      case 'function-declaration': {
        if (!onlyPublic || node.definition.public) {
          if (typeof rangeOrName === 'string') {
            if (node.definition.name.value === rangeOrName) {
              return node.definition;
            }
          } else {
            if (node.definition.name.start === rangeOrName.start && node.definition.name.end === rangeOrName.end) {
              return node.definition;
            }
          }
        }
        for (const s of node.statements) {
            const def = traverse(s.value, rangeOrName);
            if (def) return def;
          }
        return null;
      }
    }
  }
  
  return (rangeOrName: TokenRange | string) => {
    for (const s of nodes) {
      const def = traverse(s.value, rangeOrName);
      if (def) return def;
    }
    return null;
  }
}

let cachedSystemLibrary: ParserOutput | null = null;
async function parseSystemLibrary(): Promise<ParserOutput | null> {
  if (cachedSystemLibrary) return cachedSystemLibrary;

  const document = generateMockDocument('simplex.system.lib.si', systemCode, systemCode.split('\n'));

  log.clear();
  clearTokensData(document);
  getRecoveryIssues().length = 0;
  const [parseResult, diags] = performParsing(document);
  if (!parseResult) {
    return null;
  }
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
  checkSymphonyDiagnostics(document, parseResult, diags);
  finalizeTokensData(document);

  cachedSystemLibrary = parseResult;
  return cachedSystemLibrary;
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
