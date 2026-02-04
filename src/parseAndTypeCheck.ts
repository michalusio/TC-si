import { TextDocument } from "vscode";
import { checkVariableExistence, performParsing } from "./checks";
import { resetId } from "./compiler/utils";
import { FunctionDefinition, ParserOutput, Statement, StatementsBlock } from "./parsers/types/ast";
import { SimplexDiagnostic } from "./SimplexDiagnostic";
import { baseEnvironment, clearTokensData, emptyScope, finalizeTokensData, isSymphonyFile, log } from "./storage";
import { generateMockDocument } from "./workspace";
import { checkSymphonyDiagnostics } from "./parsers/symphony";
import { TokenRange } from "parser-combinators";

export function parseAndTypeCheck(code: string): [StatementsBlock | null, SimplexDiagnostic[], TextDocument] {
  const compilationDocument = generateMockDocument('simplex.compilation.si', code, code.split('\n'));
  resetId();
  log.clear();
  clearTokensData(compilationDocument);
  let [parseResult, diags] = performParsing(compilationDocument);
  
  typeCheckDocumentAfterParsing(compilationDocument, parseResult, diags);
  finalizeTokensData(compilationDocument);
  return [parseResult, diags, compilationDocument];
}

function typeCheckDocumentAfterParsing(document: TextDocument, parseResult: StatementsBlock | null, diags: SimplexDiagnostic[]) {
  if (parseResult) {
    checkVariableExistence(
      document,
      parseResult,
      [
        baseEnvironment,
        emptyScope(),
      ],
      diags
    );
    if (isSymphonyFile(document)) {
      checkSymphonyDiagnostics(document, parseResult, diags);
    }
  }
}

export function getDefinition(nodes: ParserOutput, librariesEndLineOffset: number): (rangeOrName: TokenRange | string) => FunctionDefinition | null {
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
      case 'comment':
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
        if (typeof rangeOrName === 'string') {
          if (node.definition.name.value === rangeOrName) {
            return {
              ...node.definition,
              public: node.definition.name.start < librariesEndLineOffset ? false : node.definition.public
            };
          }
        } else {
          if (node.definition.name.start === rangeOrName.start && node.definition.name.end === rangeOrName.end) {
            return {
              ...node.definition,
              public: node.definition.name.start < librariesEndLineOffset ? false : node.definition.public
            };
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