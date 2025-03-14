import { workspace } from "vscode";

const setting = <T>(name: string, defaultValue: T) => {
    if (workspace.getConfiguration('tcsi').get(name) == null) {
        try {
            workspace.getConfiguration('tcsi').update(name, defaultValue);
        } catch (e) {}
    }
    return () => workspace.getConfiguration('tcsi').get(name) as T;
}

export const explicitReturn = setting('warnOnMissingExplicitReturn', false);
export const typeCheck = setting('showTypeCheckingErrors', true);
export const showInlayTypeHints = setting('showInlayTypeHints', true);
