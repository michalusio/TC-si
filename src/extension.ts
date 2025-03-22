import {
  CompletionItem,
  CompletionItemKind,
  CompletionItemProvider,
  Declaration,
  DeclarationProvider,
  Diagnostic,
  DocumentSemanticTokensProvider,
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
} from "vscode";
import {
  baseEnvironment,
  clearTokensData,
  diagnostics,
  finalizeTokensData,
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
import { showInlayTypeHints } from "./workspace";

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
    const declarations = getDeclarations();
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

const statusItem = languages.createLanguageStatusItem('si', selector);
statusItem.name = "TC Simplex Language status";

const tokenProvider: DocumentSemanticTokensProvider = {
  provideDocumentSemanticTokens(document, token): ProviderResult<SemanticTokens> {
    statusItem.busy = true;
    statusItem.text = "TC Simplex is parsing the file";
    statusItem.severity = LanguageStatusSeverity.Information;

    log.clear();
    clearTokensData();
    getRecoveryIssues().length = 0;
    diagnostics.clear();
    return new Promise<SemanticTokens>(res => {
      const startTime = Date.now();
      const tokensBuilder = new SemanticTokensBuilder(legend);

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
      finalizeTokensData();
      res(tokensBuilder.build());
    });
  },
};

languages.registerDocumentSemanticTokensProvider(
  selector,
  tokenProvider,
  legend
);
languages.registerDeclarationProvider(selector, declarationProvider);
languages.registerHoverProvider(selector, hoverProvider);
languages.registerInlayHintsProvider(selector, inlayProvider);
languages.registerRenameProvider(selector, renameProvider);
languages.registerCompletionItemProvider(selector, dotCompletionProvider, '.');
