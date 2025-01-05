import { ProviderResult, Range, RenameProvider, WorkspaceEdit } from "vscode";
import { aliasData, functionData, parameterData, variableData } from "./storage";
import { getPositionInfo } from "./parser";

export const renameProvider: RenameProvider = {
	prepareRename(document, position, token): ProviderResult<Range> {
		for (const variable of variableData) {
			for (const [_, variableRange] of variable[1]) {
				if (variableRange.contains(position)) {
					return variableRange;
				}
			}
		}
		for (const alias of aliasData) {
			for (const aliasRange of alias[1]) {
				if (aliasRange.contains(position)) {
					return aliasRange;
				}
			}
		}
		for (const func of functionData) {
			for (const funcRange of func[1]) {
				if (funcRange.contains(position)) {
					return funcRange;
				}
			}
		}
		for (const param of parameterData) {
			for (const [_, paramRange] of param[1]) {
				if (paramRange.contains(position)) {
					return paramRange;
				}
			}
		}
		return Promise.reject();
	},

	provideRenameEdits(document, position, newName, token): ProviderResult<WorkspaceEdit> {
		if (!/\w+/.test(newName)) {
			return Promise.reject();
		}
		const renameBase = getPositionInfo(position);
		if (renameBase == null) return;
		const edits = new WorkspaceEdit();
		switch (renameBase[0]) {
			case 'variable': {
				const variable = variableData.get(renameBase[1])!;
				for (const [funcRange, variableRange] of variable) {
					if (funcRange.contains(position)) {
						edits.replace(document.uri, variableRange, newName);
					}
				}
				break;
			}
			case 'alias': {
				const aliasRanges = aliasData.get(renameBase[1])!;
				for (const aliasRange of aliasRanges) {
					edits.replace(document.uri, aliasRange, newName);
				}
				break;
			}
			case 'function': {
				const funcRanges = functionData.get(renameBase[1])!;
				for (const funcRange of funcRanges) {
					edits.replace(document.uri, funcRange, newName);
				}
				break;
			}
			case 'parameter': {
				const param = parameterData.get(renameBase[1])!;
				for (const [funcRange, paramRange] of param) {
					if (funcRange.contains(position)) {
						edits.replace(document.uri, paramRange, newName);
					}
				}
				break;
			}
		}
		return edits;
	}
}