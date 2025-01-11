import { Declaration, DeclarationProvider, DocumentLink, DocumentLinkProvider, DocumentSemanticTokensProvider, Hover, HoverProvider, languages, LocationLink, MarkdownString, ProviderResult, Range, RenameProvider, SemanticTokens, SemanticTokensBuilder, TextDocument, Uri, WorkspaceEdit } from "vscode";
import { baseEnvironment, diagnostics, legend, log, tokensData } from "./storage";
import { getPositionInfo } from "./parser";
import { getRecoveryIssues } from "./parsers/base";
import { checkVariableExistence, performParsing } from "./checks";

const selector = { language: 'si', scheme: 'file' };

const renameProvider: RenameProvider = {
	prepareRename(document, position): ProviderResult<Range> {
		const data = getPositionInfo(document, position);
		if (!data) return Promise.reject();
        if (typeof data.definition === 'string') return Promise.reject();
		return new Range(
			document.positionAt(data.current.start),
			document.positionAt(data.current.end)
		);
	},

	provideRenameEdits(document, position, newName): ProviderResult<WorkspaceEdit> {
		const data = getPositionInfo(document, position);
		if (!data) return;
        if (typeof data.definition === 'string') return;
		const edits = new WorkspaceEdit();
		for (const { start, end } of data.all) {
			edits.replace(document.uri, new Range(
				document.positionAt(start),
				document.positionAt(end)
			), newName);
		}
		return edits;
	}
}

const declarationProvider: DeclarationProvider = {
	provideDeclaration(document, position): ProviderResult<Declaration> {
		const data = getPositionInfo(document, position);
		if (!data) return;

		const currentStartPosition = document.positionAt(data.current.start);
		const currentEndPosition = document.positionAt(data.current.end);

        if (typeof data.definition === 'string') return;

		const definitionStartPosition = document.positionAt(data.definition.start);
		const definitionEndPosition = document.positionAt(data.definition.end);

		const definitionLine = document.lineAt(definitionStartPosition);

		const link: LocationLink = {
			targetUri: document.uri,
			originSelectionRange: new Range(
				currentStartPosition,
				currentEndPosition
			),
			targetSelectionRange: new Range(
				definitionStartPosition,
				definitionEndPosition
			),
			targetRange: definitionLine.range
		};

		return [link];
	},
}

const hoverProvider: HoverProvider = {
    provideHover(document, position): ProviderResult<Hover> {
        const data = getPositionInfo(document, position);
		if (!data) return;
		const range = new Range(
			document.positionAt(data.current.start),
			document.positionAt(data.current.end)
		);
		const label = new MarkdownString();
		label.appendMarkdown(`### ${document.getText(range)}\n---`);
        if (typeof data.definition === 'string') {
            const text = new MarkdownString();
            text.appendMarkdown(data.definition);
            return new Hover(
                [label, text],
                new Range(
                    document.positionAt(data.current.start),
                    document.positionAt(data.current.end)
                ));
        }
        if (!data.info) return;
        const startPosition = document.positionAt(data.info.range.start);
        const line = document.lineAt(startPosition.line);
        const text = new MarkdownString();
        text.appendText(line.text.trim());
        return new Hover(
            [label, text],
            range
		);
    }
}
// const linkProvider: DocumentLinkProvider = {
//     provideDocumentLinks(document): ProviderResult<DocumentLink[]> {
//         return tokensData
//             .filter(t => !(t.definition.start === t.position.start && t.definition.end === t.position.end))
//             .map(t => {
//                 const position = new Range(
//                     document.positionAt(t.position.start),
//                     document.positionAt(t.position.end)
//                 );
//                 const definitionPosition = document.positionAt(t.definition.start);
//                 return new DocumentLink(
//                     position,
//                     document.uri.with({ fragment: `L${definitionPosition.line+1},${definitionPosition.character+1}`})
//                 );
//             });
//     }
//}

const tokenProvider: DocumentSemanticTokensProvider = {
    provideDocumentSemanticTokens(document): ProviderResult<SemanticTokens> {
      log.clear();
      tokensData.length = 0;
      getRecoveryIssues().length = 0;
      diagnostics.clear();
  
      const tokensBuilder = new SemanticTokensBuilder(legend);
      const [parseResult, diags] = performParsing(document);
  
      if (parseResult) {
        checkVariableExistence(document, parseResult, [baseEnvironment, ['function', new Map()]], diags);
      }
      log.appendLine(`Tokens: ${tokensData.length}`);
      diagnostics.set(document.uri, diags);
  
      return tokensBuilder.build();
    },
  };

languages.registerDocumentSemanticTokensProvider(selector, tokenProvider, legend);
languages.registerDeclarationProvider(selector, declarationProvider);
languages.registerHoverProvider(selector, hoverProvider);
//languages.registerDocumentLinkProvider(selector, linkProvider);
languages.registerRenameProvider(selector, renameProvider);
