import { CancellationToken, Declaration, DeclarationProvider, Location, Position, ProviderResult, TextDocument } from "vscode";
import { aliasData, functionData, parameterData, variableData } from "./storage";
import { getPositionInfo } from "./parser";

export const declarationProvider: DeclarationProvider = {
	provideDeclaration(document: TextDocument, position: Position, token: CancellationToken): ProviderResult<Declaration> {
		const renameBase = getPositionInfo(position);
		if (renameBase == null) return;
		switch (renameBase[0]) {
			case 'variable': {
				const variable = variableData.get(renameBase[1])!;
				for (const [funcRange, variableRange] of variable) {
					if (funcRange.contains(position)) {
						return new Location(document.uri, variableRange);
					}
				}
			}
			case 'alias': {
				return new Location(document.uri, aliasData.get(renameBase[1])![0]);
			}
			case 'function': {
				return new Location(document.uri, functionData.get(renameBase[1])![0]);
			}
			case 'parameter': {
				const param = parameterData.get(renameBase[1])!;
				for (const [funcRange, paramRange] of param) {
					if (funcRange.contains(position)) {
						return new Location(document.uri, paramRange);
					}
				}
			}
		}
	},
}