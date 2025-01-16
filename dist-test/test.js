"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// node_modules/parser-combinators/dist/types.js
var require_types = __commonJS({
  "node_modules/parser-combinators/dist/types.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.ParseError = exports2.fail = exports2.result = exports2.failure = exports2.success = exports2.isFailure = void 0;
    function isFailure3(input) {
      return !input.success;
    }
    exports2.isFailure = isFailure3;
    function success2(ctx, value) {
      return { success: true, value, ctx };
    }
    exports2.success = success2;
    function failure2(ctx, expected, history) {
      return { success: false, expected, ctx, history };
    }
    exports2.failure = failure2;
    function result(value) {
      return (ctx) => success2(ctx, value);
    }
    exports2.result = result;
    function fail2(reason) {
      return (ctx) => failure2(ctx, reason, [reason]);
    }
    exports2.fail = fail2;
    var ParseError2 = class extends Error {
      constructor(message, input, index, history) {
        super(message);
        this.index = index;
        this.history = history;
        [this.line, this.column, this.row] = this.getInputData(input, index);
      }
      getInputData(input, index) {
        const lines = input.split("\n");
        let row = 0;
        while (index > 0) {
          if (lines[row].length > index) {
            return [lines[row], index + 1, row + 1];
          }
          index -= lines[row].length + 1;
          row += 1;
        }
        return [lines[row], index + 1, row + 1];
      }
      getPrettyErrorMessage() {
        return `${this.message} (line ${this.row}, col ${this.column})
${this.line}
${(this.column ? " ".repeat(this.column - 1) : "") + "^"}`;
      }
    };
    exports2.ParseError = ParseError2;
  }
});

// node_modules/parser-combinators/dist/parsers/any.js
var require_any = __commonJS({
  "node_modules/parser-combinators/dist/parsers/any.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.surely = exports2.any = void 0;
    var _1 = require_parsers();
    var types_1 = require_types();
    function any6(...parsers) {
      return (ctx) => {
        const expected = [];
        for (const parser of parsers) {
          const res = parser(ctx);
          if ((0, types_1.isFailure)(res)) {
            const surelyIndex = res.history.findIndex((h) => h == "surely");
            if (surelyIndex > -1) {
              return (0, types_1.failure)(res.ctx, res.expected, res.history);
            }
            expected.push(res);
          } else
            return res;
        }
        const longest = expected.reduce((a, b) => a.history.length >= b.history.length ? a : b);
        return (0, types_1.failure)(longest.ctx, longest.expected, ["any", ...longest.history]);
      };
    }
    exports2.any = any6;
    function surely5(parser) {
      return (0, _1.expect)(parser, "surely");
    }
    exports2.surely = surely5;
  }
});

// node_modules/parser-combinators/dist/parsers/seq.js
var require_seq = __commonJS({
  "node_modules/parser-combinators/dist/parsers/seq.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.seq = void 0;
    var types_1 = require_types();
    function seq7(...parsers) {
      return (ctx) => {
        const values = [];
        for (const parser of parsers) {
          const res = parser(ctx);
          ctx = res.ctx;
          if ((0, types_1.isFailure)(res))
            return (0, types_1.failure)(res.ctx, res.expected, ["seq", ...res.history]);
          values.push(res.value);
        }
        return (0, types_1.success)(ctx, values);
      };
    }
    exports2.seq = seq7;
  }
});

// node_modules/parser-combinators/dist/parsers/between.js
var require_between = __commonJS({
  "node_modules/parser-combinators/dist/parsers/between.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.between = void 0;
    var types_1 = require_types();
    var seq_1 = require_seq();
    function between5(left, parser, right) {
      const sequence = (0, seq_1.seq)(left, parser, right);
      return (ctx) => {
        const res = sequence(ctx);
        if ((0, types_1.isFailure)(res)) {
          const newHistory = [...res.history];
          newHistory.splice(0, 1);
          return (0, types_1.failure)(res.ctx, res.expected, ["between", ...newHistory]);
        }
        return { ...res, value: res.value[1] };
      };
    }
    exports2.between = between5;
  }
});

// node_modules/parser-combinators/dist/parsers/exhaust.js
var require_exhaust = __commonJS({
  "node_modules/parser-combinators/dist/parsers/exhaust.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.exhaust = void 0;
    var types_1 = require_types();
    function exhaust5(parser, until = null) {
      return (ctx) => {
        const results = [];
        while (true) {
          const res = parser(ctx);
          if ((0, types_1.isFailure)(res)) {
            if (until === null || (0, types_1.isFailure)(until(ctx))) {
              return (0, types_1.failure)(res.ctx, res.expected, ["exhaust", ...res.history]);
            }
            return (0, types_1.success)(ctx, results);
          }
          ctx = res.ctx;
          results.push(res.value);
          if (res.ctx.index === res.ctx.text.length)
            return (0, types_1.success)(res.ctx, results);
        }
      };
    }
    exports2.exhaust = exhaust5;
  }
});

// node_modules/parser-combinators/dist/parsers/map.js
var require_map = __commonJS({
  "node_modules/parser-combinators/dist/parsers/map.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.map = void 0;
    var types_1 = require_types();
    function map7(parser, mapper) {
      return (ctx) => {
        const res = parser(ctx);
        if ((0, types_1.isFailure)(res))
          return (0, types_1.failure)(res.ctx, res.expected, ["map", ...res.history]);
        try {
          const newValue = mapper(res.value);
          return (0, types_1.success)(res.ctx, newValue);
        } catch (e) {
          return (0, types_1.failure)(res.ctx, "Error while mapping", ["map"]);
        }
      };
    }
    exports2.map = map7;
  }
});

// node_modules/parser-combinators/dist/parsers/opt.js
var require_opt = __commonJS({
  "node_modules/parser-combinators/dist/parsers/opt.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.opt = void 0;
    var types_1 = require_types();
    function opt6(parser) {
      return (ctx) => {
        const parseResult = parser(ctx);
        if ((0, types_1.isFailure)(parseResult)) {
          return (0, types_1.success)(ctx, null);
        }
        return parseResult;
      };
    }
    exports2.opt = opt6;
  }
});

// node_modules/parser-combinators/dist/parsers/many.js
var require_many = __commonJS({
  "node_modules/parser-combinators/dist/parsers/many.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.oneOrManyRed = exports2.oneOrMany = exports2.zeroOrMany = exports2.many = void 0;
    var types_1 = require_types();
    var map_1 = require_map();
    var opt_1 = require_opt();
    var seq_1 = require_seq();
    function many3(parser) {
      return (ctx) => {
        const results = [];
        while (true) {
          const res = parser(ctx);
          if ((0, types_1.isFailure)(res)) {
            return (0, types_1.success)(ctx, results);
          }
          ctx = res.ctx;
          results.push(res.value);
        }
      };
    }
    exports2.many = many3;
    function zeroOrMany(item, separator) {
      return (0, map_1.map)((0, opt_1.opt)(oneOrMany2(item, separator)), (t) => t !== null && t !== void 0 ? t : []);
    }
    exports2.zeroOrMany = zeroOrMany;
    function oneOrMany2(item, separator = void 0) {
      const sequencer = (0, map_1.map)((0, seq_1.seq)(item, many3(separator ? (0, map_1.map)((0, seq_1.seq)(separator, item), ([, t]) => t) : item)), ([t, ts]) => [t, ...ts]);
      return (ctx) => {
        const res = sequencer(ctx);
        if ((0, types_1.isFailure)(res)) {
          const newHistory = [...res.history];
          newHistory.splice(0, 2);
          return (0, types_1.failure)(res.ctx, res.expected, ["oneOrMany", ...newHistory]);
        }
        return res;
      };
    }
    exports2.oneOrMany = oneOrMany2;
    function oneOrManyRed(item, separator, reducer) {
      return (0, map_1.map)((0, map_1.map)((0, seq_1.seq)((0, map_1.map)(item, (x) => [null, x]), many3((0, seq_1.seq)(separator, item))), ([t, ts]) => [t, ...ts]), (ts) => {
        let result = ts[0][1];
        for (let i = 1; i < ts.length; i++) {
          result = reducer(result, ts[i][1], ts[i][0]);
        }
        return result;
      });
    }
    exports2.oneOrManyRed = oneOrManyRed;
  }
});

// node_modules/parser-combinators/dist/parsers/regex.js
var require_regex = __commonJS({
  "node_modules/parser-combinators/dist/parsers/regex.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.regex = void 0;
    var types_1 = require_types();
    function regex5(match, expected) {
      const regexp = new RegExp(match, typeof match === "string" ? "y" : match.flags + "y");
      return (ctx) => {
        regexp.lastIndex = ctx.index;
        const regexMatch = regexp.exec(ctx.text);
        if (regexMatch !== null && regexMatch.index === ctx.index) {
          return (0, types_1.success)({ ...ctx, index: ctx.index + regexMatch[0].length }, regexMatch[0]);
        } else {
          return (0, types_1.failure)(ctx, expected, [expected]);
        }
      };
    }
    exports2.regex = regex5;
  }
});

// node_modules/parser-combinators/dist/parsers/str.js
var require_str = __commonJS({
  "node_modules/parser-combinators/dist/parsers/str.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.str = void 0;
    var types_1 = require_types();
    function str8(match) {
      return (ctx) => {
        if (ctx.text.startsWith(match, ctx.index)) {
          return (0, types_1.success)({ ...ctx, index: ctx.index + match.length }, match);
        } else {
          return (0, types_1.failure)(ctx, match, [match]);
        }
      };
    }
    exports2.str = str8;
  }
});

// node_modules/parser-combinators/dist/parsers/utilities.js
var require_utilities = __commonJS({
  "node_modules/parser-combinators/dist/parsers/utilities.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.expectErase = exports2.expect = exports2.ref = void 0;
    var types_1 = require_types();
    function ref3(parser, check, expected) {
      return (ctx) => {
        const res = parser(ctx);
        if (!(0, types_1.isFailure)(res) && !check(res.value)) {
          return (0, types_1.failure)(res.ctx, expected !== null && expected !== void 0 ? expected : "check", [`ref: ${expected !== null && expected !== void 0 ? expected : "check"}`]);
        }
        return res;
      };
    }
    exports2.ref = ref3;
    function expect2(parser, expected) {
      return (ctx) => {
        const res = parser(ctx);
        if ((0, types_1.isFailure)(res)) {
          return (0, types_1.failure)(res.ctx, expected, [expected, ...res.history]);
        }
        return res;
      };
    }
    exports2.expect = expect2;
    function expectErase(parser, expected) {
      return (ctx) => {
        const res = parser(ctx);
        if ((0, types_1.isFailure)(res)) {
          return (0, types_1.failure)(res.ctx, expected, [expected]);
        }
        return res;
      };
    }
    exports2.expectErase = expectErase;
  }
});

// node_modules/parser-combinators/dist/parsers/values.js
var require_values = __commonJS({
  "node_modules/parser-combinators/dist/parsers/values.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.realP = exports2.real = exports2.intP = exports2.int = exports2.boolP = exports2.bool = exports2.wspaces = exports2.spacesPlus = exports2.spaces = void 0;
    var map_1 = require_map();
    var opt_1 = require_opt();
    var regex_1 = require_regex();
    var seq_1 = require_seq();
    var str_1 = require_str();
    var utilities_1 = require_utilities();
    exports2.spaces = (0, regex_1.regex)(/ */, "spaces");
    exports2.spacesPlus = (0, regex_1.regex)(/ +/, "spaces");
    exports2.wspaces = (0, opt_1.opt)((0, regex_1.regex)(/(?:\s|\t|\n|\r)+/, "whitespace characters"));
    exports2.bool = (0, regex_1.regex)(/true|false/, "boolean");
    exports2.boolP = (0, map_1.map)(exports2.bool, (val) => val === "true");
    exports2.int = (0, regex_1.regex)(/\d+/, "integer");
    exports2.intP = (0, map_1.map)(exports2.int, (seq7) => parseInt(seq7, 10));
    exports2.real = (0, utilities_1.expect)((0, map_1.map)((0, seq_1.seq)(exports2.int, (0, str_1.str)("."), exports2.int), ([intPart, , decimalPart]) => `${intPart}.${decimalPart}`), "real");
    exports2.realP = (0, map_1.map)(exports2.real, (seq7) => parseFloat(seq7));
  }
});

// node_modules/parser-combinators/dist/parsers/index.js
var require_parsers = __commonJS({
  "node_modules/parser-combinators/dist/parsers/index.js"(exports2) {
    "use strict";
    var __createBinding = exports2 && exports2.__createBinding || (Object.create ? function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: function() {
          return m[k];
        } };
      }
      Object.defineProperty(o, k2, desc);
    } : function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    });
    var __exportStar = exports2 && exports2.__exportStar || function(m, exports3) {
      for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports3, p)) __createBinding(exports3, m, p);
    };
    Object.defineProperty(exports2, "__esModule", { value: true });
    __exportStar(require_any(), exports2);
    __exportStar(require_between(), exports2);
    __exportStar(require_exhaust(), exports2);
    __exportStar(require_many(), exports2);
    __exportStar(require_map(), exports2);
    __exportStar(require_opt(), exports2);
    __exportStar(require_regex(), exports2);
    __exportStar(require_seq(), exports2);
    __exportStar(require_str(), exports2);
    __exportStar(require_utilities(), exports2);
    __exportStar(require_values(), exports2);
  }
});

// node_modules/parser-combinators/dist/parser.js
var require_parser = __commonJS({
  "node_modules/parser-combinators/dist/parser.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.ParseText = exports2.ParseFile = void 0;
    var fs = require("fs");
    var types_1 = require_types();
    function ParseFile(path, parser) {
      const text = fs.readFileSync(path, "utf8");
      return ParseText2(text, parser, path);
    }
    exports2.ParseFile = ParseFile;
    function ParseText2(text, parser, path = "") {
      const res = parser({ text, path, index: 0 });
      if ((0, types_1.isFailure)(res)) {
        throw new types_1.ParseError(`Parse error, expected ${[...res.history].pop()} at char ${res.ctx.index}`, text, res.ctx.index, res.history);
      }
      if (res.ctx.index !== text.length) {
        throw new types_1.ParseError(`Parse error at index ${res.ctx.index}`, text, res.ctx.index, []);
      }
      return res.value;
    }
    exports2.ParseText = ParseText2;
  }
});

// node_modules/parser-combinators/dist/index.js
var require_dist = __commonJS({
  "node_modules/parser-combinators/dist/index.js"(exports2) {
    "use strict";
    var __createBinding = exports2 && exports2.__createBinding || (Object.create ? function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: function() {
          return m[k];
        } };
      }
      Object.defineProperty(o, k2, desc);
    } : function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    });
    var __exportStar = exports2 && exports2.__exportStar || function(m, exports3) {
      for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports3, p)) __createBinding(exports3, m, p);
    };
    Object.defineProperty(exports2, "__esModule", { value: true });
    __exportStar(require_types(), exports2);
    __exportStar(require_parsers(), exports2);
    __exportStar(require_parser(), exports2);
  }
});

// src/test.ts
var import_assert = __toESM(require("assert"));
var import_process = require("process");
var import_fs = require("fs");
var import_path = require("path");
var import_parser_combinators8 = __toESM(require_dist());

// src/checks.ts
var import_vscode3 = require("vscode");

// src/parsers/base.ts
var import_parser_combinators2 = __toESM(require_dist());

// src/parsers/utils.ts
var import_parser_combinators = __toESM(require_dist());

// src/storage.ts
var import_vscode = require("vscode");
var log = import_vscode.window.createOutputChannel("TC-si");
var tokenTypes = ["type", "parameter", "variable"];
var tokenModifiers = ["declaration", "definition", "readonly"];
var legend = new import_vscode.SemanticTokensLegend(tokenTypes, tokenModifiers);
var tokensData = [];
var diagnostics = import_vscode.languages.createDiagnosticCollection("si");
var baseEnvironment = {
  type: "scope",
  switchTypes: /* @__PURE__ */ new Map(),
  functions: [],
  operators: [],
  types: /* @__PURE__ */ new Map(),
  variables: /* @__PURE__ */ new Map()
};
var precedence = {
  "||": 3,
  "&&": 4,
  "==": 5,
  "!=": 5,
  "<=": 5,
  ">=": 5,
  "<": 5,
  "<s": 5,
  "<u": 5,
  ">": 5,
  "+": 6,
  "-": 6,
  "&": 6,
  "|": 6,
  "^": 6,
  "*": 7,
  "/": 7,
  "%": 7,
  "ror": 7,
  "rol": 7,
  "<<": 7,
  ">>": 7,
  "asr": 7
};

// src/parsers/utils.ts
function recoverByAddingChars(chars, parser, log2 = true, message) {
  return (ctx) => {
    let firstFailure = null;
    for (let i = 0; i <= chars.length; i++) {
      const addedChars = chars.slice(0, i);
      const result = parser({
        index: ctx.index,
        path: ctx.path,
        text: `${ctx.text.slice(0, ctx.index)}${addedChars}${ctx.text.slice(
          ctx.index
        )}`
      });
      if ((0, import_parser_combinators.isFailure)(result)) {
        if (firstFailure == null) {
          firstFailure = result;
        }
      } else {
        if (log2 && i > 0) {
          getRecoveryIssues().push({
            type: "added",
            index: ctx.index,
            text: message ?? `\`${addedChars}\``
          });
        }
        return result;
      }
    }
    if (firstFailure == null) throw "Missing failure info";
    return firstFailure;
  };
}
function recoverBySkipping(parser, skipBy, log2 = true) {
  return (ctx) => {
    const result = parser(ctx);
    if ((0, import_parser_combinators.isFailure)(result)) {
      if (result.history.includes("surely")) {
        const skipped = skipBy(ctx);
        if (log2 && !(0, import_parser_combinators.isFailure)(skipped)) {
          getRecoveryIssues().push({
            type: "skipped",
            index: ctx.index,
            text: result.ctx.text.slice(ctx.index, skipped.ctx.index)
          });
        }
        return {
          ...skipped,
          value: null
        };
      }
    }
    return result;
  };
}
function rstr(value, log2 = true) {
  return recoverByAddingChars(value, (0, import_parser_combinators.str)(value), log2);
}
var eof = (ctx) => {
  if (ctx.index === ctx.text.length) {
    return (0, import_parser_combinators.success)(ctx, void 0);
  } else {
    return (0, import_parser_combinators.failure)(ctx, "End Of File", ["EOF"]);
  }
};
function manyForSure(parser) {
  return (ctx) => {
    const results = [];
    while (true) {
      const res = parser(ctx);
      if ((0, import_parser_combinators.isFailure)(res)) {
        if (res.history.includes("surely")) {
          return (0, import_parser_combinators.failure)(
            res.ctx,
            res.expected,
            res.history.filter((h) => h !== "surely")
          );
        }
        return (0, import_parser_combinators.success)(ctx, results);
      }
      ctx = res.ctx;
      results.push(res.value);
    }
  };
}
function token(parser) {
  return (ctx) => {
    const result = parser(ctx);
    if (result.success) {
      return {
        ...result,
        value: {
          value: result.value,
          start: ctx.index,
          end: result.ctx.index
        }
      };
    }
    return result;
  };
}
function lookaround(parser) {
  return (ctx) => {
    const result = parser(ctx);
    if (result.success) {
      return (0, import_parser_combinators.success)(ctx, void 0);
    }
    return (0, import_parser_combinators.failure)(ctx, result.expected, ["lookaround", ...result.history]);
  };
}

// src/parsers/base.ts
var recoveryIssues = [];
var getRecoveryIssues = () => recoveryIssues;
var lbr = (0, import_parser_combinators2.str)("[");
var rbr = (0, import_parser_combinators2.str)("]");
var lpr = (0, import_parser_combinators2.str)("(");
var rpr = (0, import_parser_combinators2.str)(")");
var lcb = (0, import_parser_combinators2.str)("{");
var rcb = (0, import_parser_combinators2.str)("}");
var lab = (0, import_parser_combinators2.str)("<");
var rab = (0, import_parser_combinators2.str)(">");
var disallowedNames = [
  "def",
  "dot",
  "switch",
  "while",
  "if",
  "return",
  "var",
  "const",
  "let",
  "type",
  "else",
  "elif",
  "default"
];
var variableName = token(
  (0, import_parser_combinators2.map)(
    (0, import_parser_combinators2.seq)(
      (0, import_parser_combinators2.many)((0, import_parser_combinators2.any)((0, import_parser_combinators2.str)("$"), (0, import_parser_combinators2.str)("."))),
      (0, import_parser_combinators2.ref)((0, import_parser_combinators2.regex)(/\w+/, "Variable name"), (p) => !disallowedNames.includes(p))
    ),
    ([front, name]) => ({ front: front.join(""), name })
  )
);
var typeName = token((0, import_parser_combinators2.regex)(/@?[A-Z]\w*/, "Type name"));
var functionName = token(
  (0, import_parser_combinators2.ref)((0, import_parser_combinators2.regex)(/\w+/, "Function name"), (p) => !disallowedNames.includes(p))
);
var unaryOperator = (0, import_parser_combinators2.any)((0, import_parser_combinators2.str)("-"), (0, import_parser_combinators2.str)("~"), (0, import_parser_combinators2.str)("!"), (0, import_parser_combinators2.str)("+"));
var functionBinaryOperator = (0, import_parser_combinators2.any)(
  (0, import_parser_combinators2.str)("+="),
  (0, import_parser_combinators2.str)("-="),
  (0, import_parser_combinators2.str)("&&="),
  (0, import_parser_combinators2.str)("&="),
  (0, import_parser_combinators2.str)("||="),
  (0, import_parser_combinators2.str)("|="),
  (0, import_parser_combinators2.str)("^="),
  (0, import_parser_combinators2.str)("*="),
  (0, import_parser_combinators2.str)("%="),
  (0, import_parser_combinators2.str)("+"),
  (0, import_parser_combinators2.str)("-"),
  (0, import_parser_combinators2.str)("&&"),
  (0, import_parser_combinators2.str)("&"),
  (0, import_parser_combinators2.str)("||"),
  (0, import_parser_combinators2.str)("|"),
  (0, import_parser_combinators2.str)("^"),
  (0, import_parser_combinators2.str)("*"),
  (0, import_parser_combinators2.str)("%"),
  (0, import_parser_combinators2.str)("<="),
  (0, import_parser_combinators2.str)(">="),
  (0, import_parser_combinators2.str)("!="),
  (0, import_parser_combinators2.str)("=="),
  (0, import_parser_combinators2.str)("<<"),
  (0, import_parser_combinators2.str)(">>"),
  (0, import_parser_combinators2.str)("<"),
  (0, import_parser_combinators2.str)(">"),
  (0, import_parser_combinators2.regex)(/\/(?!\/)/, "/")
);
var binaryOperator = (0, import_parser_combinators2.any)(
  (0, import_parser_combinators2.str)("+"),
  (0, import_parser_combinators2.str)("-"),
  (0, import_parser_combinators2.str)("&&"),
  (0, import_parser_combinators2.str)("&"),
  (0, import_parser_combinators2.str)("||"),
  (0, import_parser_combinators2.str)("|"),
  (0, import_parser_combinators2.str)("^"),
  (0, import_parser_combinators2.str)("*"),
  (0, import_parser_combinators2.str)("%"),
  (0, import_parser_combinators2.str)("<="),
  (0, import_parser_combinators2.str)("<u"),
  (0, import_parser_combinators2.str)("<s"),
  (0, import_parser_combinators2.str)(">="),
  (0, import_parser_combinators2.str)("!="),
  (0, import_parser_combinators2.str)("=="),
  (0, import_parser_combinators2.str)("<<"),
  (0, import_parser_combinators2.str)(">>"),
  (0, import_parser_combinators2.str)("<"),
  (0, import_parser_combinators2.str)(">"),
  (0, import_parser_combinators2.str)("rol"),
  (0, import_parser_combinators2.str)("ror"),
  (0, import_parser_combinators2.str)("asr"),
  (0, import_parser_combinators2.map)((0, import_parser_combinators2.regex)(/\/(?!\/)/, "/"), (r) => r)
);
var newline = (0, import_parser_combinators2.regex)(/[ \t]*\r?\n/, "End of line");
var functionKind = (0, import_parser_combinators2.any)((0, import_parser_combinators2.str)("def"), (0, import_parser_combinators2.str)("dot"));
var typeDefinition = (0, import_parser_combinators2.any)(
  typeAliasDefinition(),
  (0, import_parser_combinators2.between)(
    lab,
    token(
      (0, import_parser_combinators2.map)(
        (0, import_parser_combinators2.seq)(
          import_parser_combinators2.spaces,
          (0, import_parser_combinators2.regex)(/\w+/, "Variable name"),
          (0, import_parser_combinators2.exhaust)(
            (0, import_parser_combinators2.seq)(
              import_parser_combinators2.spaces,
              (0, import_parser_combinators2.str)(","),
              import_parser_combinators2.spaces,
              (0, import_parser_combinators2.regex)(/\w+/, "Variable name")
            ),
            (0, import_parser_combinators2.seq)(import_parser_combinators2.spaces, rstr(">", false))
          )
        ),
        ([_, variant, variants]) => [variant, ...variants.map((p) => p[3])]
      )
    ),
    (0, import_parser_combinators2.seq)(import_parser_combinators2.spaces, rstr(">"))
  )
);
function typeAliasDefinition() {
  return (ctx) => token(
    (0, import_parser_combinators2.any)(
      (0, import_parser_combinators2.map)(typeName, (t) => t.value),
      (0, import_parser_combinators2.map)(
        (0, import_parser_combinators2.between)(lbr, typeAliasDefinition(), rstr("]")),
        (t) => `[${t.value}]`
      )
    )
  )(ctx);
}
var lineComment = (0, import_parser_combinators2.regex)(/\s*\/\/.*?\r?\n/s, "Line comment");
var blockComment = (0, import_parser_combinators2.regex)(/\s*\/\*.*?\*\//s, "Block comment");

// src/parser.ts
var import_parser_combinators6 = __toESM(require_dist());

// src/parsers/functions.ts
var import_parser_combinators3 = __toESM(require_dist());
var parameter = (0, import_parser_combinators3.map)((0, import_parser_combinators3.seq)(
  variableName,
  import_parser_combinators3.spaces,
  rstr(":"),
  import_parser_combinators3.spaces,
  recoverByAddingChars("Int", typeAliasDefinition(), true, "parameter type")
), ([name, _, __, ___, type]) => ({ name, type }));
var parameterList = (0, import_parser_combinators3.between)(
  lpr,
  (0, import_parser_combinators3.opt)((0, import_parser_combinators3.map)((0, import_parser_combinators3.seq)(
    parameter,
    (0, import_parser_combinators3.exhaust)((0, import_parser_combinators3.seq)(import_parser_combinators3.spaces, (0, import_parser_combinators3.str)(","), import_parser_combinators3.spaces, parameter), (0, import_parser_combinators3.seq)(import_parser_combinators3.spaces, rstr(")", false)))
  ), ([param, params]) => [
    param,
    ...params.map((p) => p[3])
  ])),
  rstr(")")
);
var functionDeclaration = (0, import_parser_combinators3.map)((0, import_parser_combinators3.seq)(
  (0, import_parser_combinators3.opt)((0, import_parser_combinators3.str)("pub ")),
  (0, import_parser_combinators3.any)(
    (0, import_parser_combinators3.map)((0, import_parser_combinators3.seq)(
      functionKind,
      import_parser_combinators3.spacesPlus,
      (0, import_parser_combinators3.surely)((0, import_parser_combinators3.seq)(
        functionName,
        parameterList,
        import_parser_combinators3.spaces,
        token((0, import_parser_combinators3.opt)((0, import_parser_combinators3.map)(typeAliasDefinition(), (t) => t.value)))
      ))
    ), ([kind, _, [name, params, __, returnType]]) => {
      params ??= [];
      return {
        type: "function",
        kind,
        name,
        returnType,
        parameters: params
      };
    }),
    (0, import_parser_combinators3.map)((0, import_parser_combinators3.seq)(
      (0, import_parser_combinators3.any)(
        (0, import_parser_combinators3.seq)(
          (0, import_parser_combinators3.str)("unary"),
          import_parser_combinators3.spacesPlus,
          (0, import_parser_combinators3.surely)((0, import_parser_combinators3.seq)(
            token(unaryOperator),
            (0, import_parser_combinators3.opt)(import_parser_combinators3.spaces),
            parameterList,
            import_parser_combinators3.spaces,
            token((0, import_parser_combinators3.opt)((0, import_parser_combinators3.map)(typeAliasDefinition(), (t) => t.value)))
          ))
        ),
        (0, import_parser_combinators3.seq)(
          (0, import_parser_combinators3.str)("binary"),
          import_parser_combinators3.spacesPlus,
          (0, import_parser_combinators3.surely)((0, import_parser_combinators3.seq)(
            token(functionBinaryOperator),
            (0, import_parser_combinators3.opt)(import_parser_combinators3.spaces),
            parameterList,
            import_parser_combinators3.spaces,
            token((0, import_parser_combinators3.opt)((0, import_parser_combinators3.map)(typeAliasDefinition(), (t) => t.value)))
          ))
        )
      )
    ), ([[kind, _, [name, __, params, ___, returnType]]]) => {
      params ??= [];
      const offset = kind.length + _.length;
      return {
        type: "operator",
        kind,
        name,
        nameOffset: offset,
        parameters: params,
        returnType
      };
    })
  ),
  import_parser_combinators3.spaces,
  rstr("{")
), ([pub, func, _, __]) => {
  return {
    type: func.type,
    public: pub != null,
    kind: func.kind,
    returnType: func.returnType,
    name: func.name,
    parameters: func.parameters
  };
});

// src/parsers/variables.ts
var import_parser_combinators4 = __toESM(require_dist());
var variableKind = token((0, import_parser_combinators4.any)(
  (0, import_parser_combinators4.str)("const"),
  (0, import_parser_combinators4.str)("let"),
  (0, import_parser_combinators4.str)("var")
));
var stringLiteral = (0, import_parser_combinators4.map)(
  (0, import_parser_combinators4.regex)(/"(?:\.|(\\\")|[^\""\n])*"/, "String literal"),
  (value) => ({
    type: "string",
    value
  })
);
var stringInterpolatedLiteral = (0, import_parser_combinators4.map)(
  (0, import_parser_combinators4.between)(
    (0, import_parser_combinators4.str)("`"),
    (0, import_parser_combinators4.exhaust)(
      (0, import_parser_combinators4.any)(
        (0, import_parser_combinators4.between)(
          lcb,
          rValue(),
          rstr("}")
        ),
        (0, import_parser_combinators4.regex)(/[^\n\r{`]+/, "String character")
      ),
      rstr("`", false)
    ),
    (0, import_parser_combinators4.str)("`")
  ),
  (value) => {
    let totalValue = "";
    const inserts = [];
    for (const v of value) {
      if (typeof v === "string") {
        totalValue += v;
      } else {
        inserts.push({
          index: totalValue.length,
          value: v
        });
      }
    }
    return {
      type: "interpolated",
      value: totalValue,
      inserts
    };
  }
);
var numericBase2Literal = (0, import_parser_combinators4.map)(
  (0, import_parser_combinators4.regex)(/0b[01][_01]*/, "Numeric literal"),
  (str8) => ({
    type: "number",
    value: parseInt(str8.slice(2).replaceAll("_", ""), 2)
  })
);
var numericBase10Literal = (0, import_parser_combinators4.map)(
  (0, import_parser_combinators4.expect)(import_parser_combinators4.intP, "Numeric literal"),
  (value) => ({
    type: "number",
    value
  })
);
var numericBase16Literal = (0, import_parser_combinators4.map)(
  (0, import_parser_combinators4.regex)(/0x[0-9a-zA-Z]+/, "Numeric literal"),
  (str8) => ({
    type: "number",
    value: parseInt(str8, 16)
  })
);
var anyNumericLiteral = (0, import_parser_combinators4.any)(
  numericBase16Literal,
  numericBase2Literal,
  numericBase10Literal
);
var variableLiteral = (0, import_parser_combinators4.map)(
  (0, import_parser_combinators4.expect)(variableName, "Variable literal"),
  (value) => ({
    type: "variable",
    value
  })
);
var arrayLiteral = (0, import_parser_combinators4.map)(
  (0, import_parser_combinators4.seq)(
    lbr,
    (0, import_parser_combinators4.surely)((0, import_parser_combinators4.exhaust)(
      (0, import_parser_combinators4.seq)(
        import_parser_combinators4.wspaces,
        rValue(),
        (0, import_parser_combinators4.opt)((0, import_parser_combinators4.seq)(
          import_parser_combinators4.wspaces,
          (0, import_parser_combinators4.str)(","),
          (0, import_parser_combinators4.opt)((0, import_parser_combinators4.any)(lineComment, blockComment))
        ))
      ),
      (0, import_parser_combinators4.seq)((0, import_parser_combinators4.opt)((0, import_parser_combinators4.any)(lineComment, blockComment)), import_parser_combinators4.wspaces, rstr("]", false))
    )),
    (0, import_parser_combinators4.opt)((0, import_parser_combinators4.any)(lineComment, blockComment)),
    import_parser_combinators4.wspaces,
    rstr("]")
  ),
  ([_, values, __, ___]) => ({
    type: "array",
    values: values.map((v) => v[1])
  })
);
var functionCall = (0, import_parser_combinators4.map)((0, import_parser_combinators4.seq)(
  functionName,
  (0, import_parser_combinators4.between)(
    lpr,
    (0, import_parser_combinators4.surely)(
      (0, import_parser_combinators4.opt)(
        (0, import_parser_combinators4.seq)(
          import_parser_combinators4.wspaces,
          rValue(),
          (0, import_parser_combinators4.exhaust)(
            (0, import_parser_combinators4.seq)(
              import_parser_combinators4.wspaces,
              (0, import_parser_combinators4.str)(","),
              import_parser_combinators4.wspaces,
              rValue()
            ),
            (0, import_parser_combinators4.seq)(import_parser_combinators4.spaces, rstr(")", false))
          )
        )
      )
    ),
    (0, import_parser_combinators4.seq)(import_parser_combinators4.spaces, rstr(")"))
  )
), ([name, rest]) => {
  const parameters = rest == null ? [] : [
    rest[1],
    ...rest[2].map((r) => r[3])
  ];
  return {
    type: "function",
    value: name,
    parameters
  };
});
var cast = (0, import_parser_combinators4.between)(
  lab,
  typeAliasDefinition(),
  rab
);
var castedRValue = (0, import_parser_combinators4.map)((0, import_parser_combinators4.seq)(
  cast,
  import_parser_combinators4.spaces,
  (0, import_parser_combinators4.surely)(rValue())
), ([cast2, _, value]) => {
  return {
    type: "cast",
    to: cast2,
    value
  };
});
var unaryRValue = (0, import_parser_combinators4.map)((0, import_parser_combinators4.seq)(
  unaryOperator,
  import_parser_combinators4.spaces,
  (0, import_parser_combinators4.surely)(rValue())
), ([operator, _, value]) => {
  return {
    type: "unary",
    operator,
    value
  };
});
var parenthesisedRValue = (0, import_parser_combinators4.map)((0, import_parser_combinators4.between)(
  (0, import_parser_combinators4.seq)(lpr, import_parser_combinators4.spaces),
  rValue(),
  (0, import_parser_combinators4.seq)(import_parser_combinators4.spaces, rstr(")"))
), (value) => ({
  type: "parenthesis",
  value
}));
function rValue() {
  return (ctx) => (0, import_parser_combinators4.map)(
    (0, import_parser_combinators4.seq)(
      token((0, import_parser_combinators4.any)(
        unaryRValue,
        castedRValue,
        stringLiteral,
        stringInterpolatedLiteral,
        numericBase16Literal,
        numericBase2Literal,
        numericBase10Literal,
        parenthesisedRValue,
        arrayLiteral,
        functionCall,
        variableLiteral
      )),
      (0, import_parser_combinators4.many)((0, import_parser_combinators4.between)(
        lbr,
        recoverByAddingChars("0", rValue(), true, "index"),
        rstr("]")
      )),
      (0, import_parser_combinators4.opt)((0, import_parser_combinators4.seq)(import_parser_combinators4.spaces, blockComment)),
      (0, import_parser_combinators4.any)(
        (0, import_parser_combinators4.seq)(
          import_parser_combinators4.spaces,
          (0, import_parser_combinators4.str)("?"),
          (0, import_parser_combinators4.surely)((0, import_parser_combinators4.seq)(
            (0, import_parser_combinators4.between)(
              import_parser_combinators4.spaces,
              recoverByAddingChars("0", rValue(), true, "on-true value"),
              import_parser_combinators4.spaces
            ),
            (0, import_parser_combinators4.str)(":"),
            import_parser_combinators4.spaces,
            recoverByAddingChars("0", rValue(), true, "on-false value")
          ))
        ),
        (0, import_parser_combinators4.seq)(
          (0, import_parser_combinators4.opt)(
            (0, import_parser_combinators4.seq)(
              (0, import_parser_combinators4.str)("."),
              (0, import_parser_combinators4.surely)(functionCall)
            )
          ),
          (0, import_parser_combinators4.opt)(
            (0, import_parser_combinators4.seq)(
              (0, import_parser_combinators4.between)(
                import_parser_combinators4.spaces,
                binaryOperator,
                import_parser_combinators4.spaces
              ),
              (0, import_parser_combinators4.surely)(recoverByAddingChars("0", rValue(), true, "second operand"))
            )
          )
        )
      )
    ),
    ([value, indexes, _, operation]) => {
      let actualValue = value;
      if (actualValue.value.type === "cast" && actualValue.value.value.value.type === "binary") {
        const binary = actualValue.value.value.value;
        actualValue = {
          start: actualValue.start,
          end: actualValue.end,
          value: {
            ...binary,
            left: {
              start: actualValue.start,
              end: binary.left.start,
              value: {
                type: "cast",
                to: actualValue.value.to,
                value: binary.left
              }
            }
          }
        };
      }
      indexes.forEach((index) => {
        actualValue = {
          start: actualValue.start,
          end: actualValue.end + 1,
          value: {
            type: "index",
            value: actualValue,
            parameter: index
          }
        };
      });
      if (typeof operation[0] === "string") {
        const op = operation;
        const data = {
          start: actualValue.start,
          end: op[2][3].end,
          value: {
            type: "ternary",
            condition: actualValue,
            ifTrue: op[2][0],
            ifFalse: op[2][3]
          }
        };
        return data;
      } else {
        const op = operation;
        const functionCall2 = op[0];
        if (functionCall2) {
          actualValue = {
            start: actualValue.start,
            end: (functionCall2[1].parameters[functionCall2[1].parameters.length - 1]?.end ?? actualValue.end + 1) + 1,
            value: {
              type: "dotMethod",
              object: actualValue,
              value: functionCall2[1].value,
              parameters: functionCall2[1].parameters
            }
          };
        }
        const binaryOperator2 = op[1];
        if (binaryOperator2) {
          const right = binaryOperator2[1];
          const left = actualValue;
          if (right.value.type === "binary" && precedence[right.value.operator] < precedence[binaryOperator2[0]]) {
            actualValue = {
              start: actualValue.start,
              end: right.end + 1,
              value: {
                type: "binary",
                operator: right.value.operator,
                left: {
                  start: actualValue.start,
                  end: right.start + 1,
                  value: {
                    type: "binary",
                    operator: binaryOperator2[0],
                    left,
                    right: right.value.left
                  }
                },
                right: right.value.right
              }
            };
          } else if (right.value.type === "ternary") {
            actualValue = {
              start: actualValue.start,
              end: right.end,
              value: {
                type: "ternary",
                condition: {
                  start: left.start,
                  end: right.value.condition.end,
                  value: {
                    type: "binary",
                    operator: binaryOperator2[0],
                    left,
                    right: right.value.condition
                  }
                },
                ifTrue: right.value.ifTrue,
                ifFalse: right.value.ifFalse
              }
            };
          } else {
            actualValue = {
              start: actualValue.start,
              end: right.end + 1,
              value: {
                type: "binary",
                operator: binaryOperator2[0],
                left,
                right
              }
            };
          }
        }
        return actualValue;
      }
    }
  )(ctx);
}
var variableModification = (0, import_parser_combinators4.map)(
  (0, import_parser_combinators4.expect)(
    (0, import_parser_combinators4.seq)(
      token(variableLiteral),
      (0, import_parser_combinators4.many)((0, import_parser_combinators4.between)(
        lbr,
        recoverByAddingChars("0", rValue(), true, "value"),
        rstr("]")
      )),
      import_parser_combinators4.spaces,
      (0, import_parser_combinators4.opt)(binaryOperator),
      (0, import_parser_combinators4.str)("="),
      (0, import_parser_combinators4.surely)((0, import_parser_combinators4.seq)(
        import_parser_combinators4.spaces,
        recoverByAddingChars("0", rValue(), true, "value")
      ))
    ),
    "Variable modification statement"
  ),
  ([name, indexes, _, operator, __, [___, value]]) => {
    let actualName = name;
    indexes.forEach((index) => {
      actualName = {
        start: actualName.start,
        end: index.end + 1,
        value: {
          type: "index",
          value: actualName,
          parameter: index
        }
      };
    });
    return {
      start: actualName.start,
      end: value.end + 1,
      value: {
        type: "modification",
        name: actualName,
        operator: operator ?? void 0,
        value
      }
    };
  }
);
var topmostVariableDeclaration = (0, import_parser_combinators4.map)(
  (0, import_parser_combinators4.expect)(
    (0, import_parser_combinators4.seq)(
      (0, import_parser_combinators4.opt)((0, import_parser_combinators4.str)("pub ")),
      variableKind,
      import_parser_combinators4.spacesPlus,
      (0, import_parser_combinators4.surely)(
        (0, import_parser_combinators4.seq)(
          recoverByAddingChars("variable", variableName, true, "variable name"),
          import_parser_combinators4.spaces,
          rstr("="),
          import_parser_combinators4.spaces,
          recoverByAddingChars("0", rValue(), true, "value")
        )
      )
    ),
    "Variable declaration statement"
  ),
  ([pub, kind, _, [name, __, ___, ____, value]]) => ({
    start: kind.start,
    end: value.end,
    value: {
      type: "declaration",
      public: !!pub,
      kind,
      name,
      value
    }
  })
);
var variableDeclaration = (0, import_parser_combinators4.map)(
  (0, import_parser_combinators4.expect)(
    (0, import_parser_combinators4.seq)(
      variableKind,
      import_parser_combinators4.spacesPlus,
      (0, import_parser_combinators4.surely)(
        (0, import_parser_combinators4.seq)(
          recoverByAddingChars("variable", variableName, true, "variable name"),
          import_parser_combinators4.spaces,
          rstr("="),
          import_parser_combinators4.spaces,
          recoverByAddingChars("0", rValue(), true, "value")
        )
      )
    ),
    "Variable declaration statement"
  ),
  ([kind, _, [name, __, ___, ____, value]]) => ({
    start: kind.start,
    end: value.end,
    value: {
      type: "declaration",
      public: false,
      kind,
      name,
      value
    }
  })
);

// src/parsers/types.ts
var import_parser_combinators5 = __toESM(require_dist());
var typeDeclaration = (0, import_parser_combinators5.map)((0, import_parser_combinators5.seq)(
  (0, import_parser_combinators5.opt)((0, import_parser_combinators5.str)("pub ")),
  (0, import_parser_combinators5.str)("type"),
  (0, import_parser_combinators5.surely)(
    (0, import_parser_combinators5.seq)(
      import_parser_combinators5.spacesPlus,
      typeName,
      import_parser_combinators5.spacesPlus,
      typeDefinition
    )
  )
), ([pub, _, [__, name, ___, definition]]) => ({
  type: "type-definition",
  public: !!pub,
  name,
  definition
}));

// src/parser.ts
var getPositionInfo = (document, position) => {
  const index = document.offsetAt(position);
  const token2 = tokensData.find((token3) => token3.position.start <= index && token3.position.end >= index);
  if (!token2) return null;
  const definitionToken = typeof token2.definition !== "string" ? tokensData.find((t) => t.position.start === token2.definition.start && t.position.end === token2.definition.end) : void 0;
  const allTokens = tokensData.filter(
    (t) => typeof t.definition === "string" && typeof token2.definition === "string" && t.definition === token2.definition || typeof t.definition !== "string" && typeof token2.definition !== "string" && t.definition.start === token2.definition.start && t.definition.end === token2.definition.end
  );
  return {
    current: token2.position,
    definition: token2.definition,
    info: definitionToken?.info ?? {},
    all: allTokens.map((t) => t.position)
  };
};
var returnStatement = (0, import_parser_combinators6.map)(
  (0, import_parser_combinators6.seq)(
    (0, import_parser_combinators6.str)("return"),
    token((0, import_parser_combinators6.opt)(
      (0, import_parser_combinators6.between)(
        import_parser_combinators6.spacesPlus,
        recoverByAddingChars("0", (0, import_parser_combinators6.map)(rValue(), (v) => v.value), true, "return value"),
        (0, import_parser_combinators6.any)(newline, lineComment, import_parser_combinators6.spacesPlus)
      )
    ))
  ),
  ([_, value]) => ({
    type: "return",
    value
  })
);
var regAllocUse = (0, import_parser_combinators6.map)(
  (0, import_parser_combinators6.seq)(
    (0, import_parser_combinators6.str)("_reg_alloc_use"),
    import_parser_combinators6.spacesPlus,
    recoverByAddingChars("value", variableName, true, "variable")
  ),
  ([_, __, value]) => ({
    type: "_reg_alloc_use",
    value
  })
);
function statementsBlock() {
  return (ctx) => (0, import_parser_combinators6.map)(
    (0, import_parser_combinators6.surely)(
      (0, import_parser_combinators6.exhaust)(
        (0, import_parser_combinators6.seq)(
          import_parser_combinators6.wspaces,
          recoverBySkipping(
            (0, import_parser_combinators6.map)(
              (0, import_parser_combinators6.any)(
                lineComment,
                blockComment,
                newline,
                typeDeclaration,
                regAllocUse,
                returnStatement,
                whileBlock(),
                ifBlock(),
                switchBlock(),
                (0, import_parser_combinators6.map)(
                  (0, import_parser_combinators6.between)(
                    lcb,
                    statementsBlock(),
                    (0, import_parser_combinators6.seq)(import_parser_combinators6.wspaces, rstr("}"))
                  ),
                  (statements) => ({
                    type: "statements",
                    statements
                  })
                ),
                (0, import_parser_combinators6.map)(
                  (0, import_parser_combinators6.seq)(
                    functionDeclaration,
                    (0, import_parser_combinators6.opt)(newline),
                    statementsBlock(),
                    import_parser_combinators6.wspaces,
                    rstr("}"),
                    (0, import_parser_combinators6.any)(newline, lineComment, lookaround((0, import_parser_combinators6.seq)(import_parser_combinators6.spaces, (0, import_parser_combinators6.str)("}"))))
                  ),
                  ([definition, _, statements]) => ({
                    type: "function-declaration",
                    definition,
                    statements
                  })
                ),
                (0, import_parser_combinators6.map)((0, import_parser_combinators6.seq)(variableDeclaration, (0, import_parser_combinators6.any)(newline, lineComment, lookaround((0, import_parser_combinators6.seq)(import_parser_combinators6.spaces, (0, import_parser_combinators6.str)("}"))))), ([v]) => v.value),
                (0, import_parser_combinators6.map)((0, import_parser_combinators6.seq)(variableModification, (0, import_parser_combinators6.any)(newline, lineComment, lookaround((0, import_parser_combinators6.seq)(import_parser_combinators6.spaces, (0, import_parser_combinators6.str)("}"))))), ([v]) => v.value),
                (0, import_parser_combinators6.map)((0, import_parser_combinators6.seq)(rValue(), (0, import_parser_combinators6.any)(newline, lineComment, lookaround((0, import_parser_combinators6.seq)(import_parser_combinators6.spaces, (0, import_parser_combinators6.str)("}"))))), ([v]) => v.value)
              ),
              (s) => typeof s === "string" ? null : s
            ),
            (0, import_parser_combinators6.regex)(/.*?(?=})/, "statement")
          )
        ),
        (0, import_parser_combinators6.seq)(import_parser_combinators6.wspaces, rstr("}", false))
      )
    ),
    (statements) => statements.map((s) => s[1]).filter((s) => s != null)
  )(ctx);
}
function whileBlock() {
  return (ctx) => (0, import_parser_combinators6.map)(
    (0, import_parser_combinators6.seq)(
      (0, import_parser_combinators6.str)("while"),
      import_parser_combinators6.spacesPlus,
      (0, import_parser_combinators6.surely)((0, import_parser_combinators6.seq)(
        recoverByAddingChars("true", rValue(), true, "condition"),
        import_parser_combinators6.spaces,
        rstr("{"),
        statementsBlock(),
        import_parser_combinators6.wspaces,
        rstr("}"),
        (0, import_parser_combinators6.any)(newline, lineComment, import_parser_combinators6.spacesPlus)
      ))
    ),
    ([_, __, [value, ___, ____, statements]]) => ({
      type: "while",
      value,
      statements
    })
  )(ctx);
}
function ifBlock() {
  return (ctx) => (0, import_parser_combinators6.map)(
    (0, import_parser_combinators6.seq)(
      (0, import_parser_combinators6.str)("if"),
      import_parser_combinators6.spacesPlus,
      (0, import_parser_combinators6.surely)((0, import_parser_combinators6.seq)(
        (0, import_parser_combinators6.map)(
          (0, import_parser_combinators6.seq)(
            recoverByAddingChars("true", rValue(), true, "condition"),
            import_parser_combinators6.spaces,
            rstr("{"),
            statementsBlock(),
            import_parser_combinators6.wspaces,
            rstr("}"),
            (0, import_parser_combinators6.any)(newline, lineComment, import_parser_combinators6.spacesPlus)
          ),
          ([value, _, __, statements]) => ({ value, statements })
        ),
        manyForSure(
          (0, import_parser_combinators6.map)(
            (0, import_parser_combinators6.seq)(
              import_parser_combinators6.wspaces,
              (0, import_parser_combinators6.str)("elif"),
              import_parser_combinators6.spacesPlus,
              (0, import_parser_combinators6.surely)((0, import_parser_combinators6.seq)(
                recoverByAddingChars("true", rValue(), true, "condition"),
                import_parser_combinators6.spaces,
                rstr("{"),
                statementsBlock(),
                import_parser_combinators6.wspaces,
                rstr("}"),
                (0, import_parser_combinators6.any)(newline, lineComment, import_parser_combinators6.spacesPlus)
              ))
            ),
            ([_, __, ___, [value, ____, _____, statements]]) => ({ value, statements })
          )
        ),
        (0, import_parser_combinators6.opt)(
          (0, import_parser_combinators6.map)(
            (0, import_parser_combinators6.seq)(
              import_parser_combinators6.wspaces,
              (0, import_parser_combinators6.str)("else"),
              import_parser_combinators6.spacesPlus,
              rstr("{"),
              recoverBySkipping(
                (0, import_parser_combinators6.surely)(
                  (0, import_parser_combinators6.seq)(
                    statementsBlock(),
                    import_parser_combinators6.wspaces,
                    rstr("}")
                  )
                ),
                (0, import_parser_combinators6.regex)(/.*?}/, "Close of Else block")
              ),
              (0, import_parser_combinators6.any)(newline, lineComment, import_parser_combinators6.spacesPlus)
            ),
            ([_, __, ___, ____, data]) => data?.[0]
          )
        )
      ))
    ),
    ([_, __, [ifBlock2, elsifs, elseBlock]]) => ({
      type: "if",
      value: ifBlock2.value,
      ifBlock: ifBlock2.statements,
      elifBlocks: elsifs,
      elseBlock: elseBlock ?? []
    })
  )(ctx);
}
function switchBlock() {
  return (ctx) => {
    let wspace = null;
    return (0, import_parser_combinators6.map)(
      (0, import_parser_combinators6.seq)(
        (0, import_parser_combinators6.str)("switch"),
        import_parser_combinators6.spacesPlus,
        (0, import_parser_combinators6.surely)((0, import_parser_combinators6.map)(
          (0, import_parser_combinators6.seq)(
            rValue(),
            (0, import_parser_combinators6.oneOrMany)(newline),
            manyForSure(
              (0, import_parser_combinators6.map)(
                (0, import_parser_combinators6.seq)(
                  (0, import_parser_combinators6.ref)(import_parser_combinators6.spaces, (v) => {
                    if (wspace == null) {
                      wspace = v?.length ?? 0;
                      return true;
                    }
                    return wspace === (v?.length ?? 0);
                  }),
                  token((0, import_parser_combinators6.any)(anyNumericLiteral, stringLiteral, variableLiteral, (0, import_parser_combinators6.str)("default"))),
                  import_parser_combinators6.spacesPlus,
                  rstr("{"),
                  (0, import_parser_combinators6.surely)((0, import_parser_combinators6.map)(
                    (0, import_parser_combinators6.seq)(
                      import_parser_combinators6.wspaces,
                      statementsBlock(),
                      import_parser_combinators6.wspaces,
                      rstr("}"),
                      (0, import_parser_combinators6.any)((0, import_parser_combinators6.oneOrMany)(newline), lineComment, import_parser_combinators6.spacesPlus)
                    ),
                    ([_, statements]) => statements
                  ))
                ),
                ([_, caseName, __, ___, statements]) => ({ caseName, statements })
              )
            ),
            (0, import_parser_combinators6.opt)((0, import_parser_combinators6.any)(newline, lineComment, import_parser_combinators6.spacesPlus))
          ),
          ([value, _, cases]) => ({ value, cases })
        ))
      ),
      ([_, __, data]) => {
        const statement = {
          type: "switch",
          ...data
        };
        return statement;
      }
    )(ctx);
  };
}
var languageParser = (0, import_parser_combinators6.map)(
  (0, import_parser_combinators6.exhaust)(
    (0, import_parser_combinators6.seq)(
      import_parser_combinators6.spaces,
      (0, import_parser_combinators6.any)(
        eof,
        lineComment,
        blockComment,
        newline,
        (0, import_parser_combinators6.map)((0, import_parser_combinators6.seq)(topmostVariableDeclaration, (0, import_parser_combinators6.any)(newline, lineComment, import_parser_combinators6.spacesPlus, eof)), ([v]) => v.value),
        (0, import_parser_combinators6.map)(
          (0, import_parser_combinators6.seq)(
            functionDeclaration,
            (0, import_parser_combinators6.opt)(newline),
            statementsBlock(),
            import_parser_combinators6.wspaces,
            rstr("}"),
            (0, import_parser_combinators6.any)(newline, lineComment, import_parser_combinators6.spacesPlus, eof)
          ),
          ([definition, _, statements]) => ({
            type: "function-declaration",
            definition,
            statements
          })
        ),
        (0, import_parser_combinators6.map)((0, import_parser_combinators6.seq)(typeDeclaration, (0, import_parser_combinators6.any)(newline, lineComment, import_parser_combinators6.spacesPlus, eof)), ([v]) => v)
      )
    )
  ),
  (data) => data.map((d) => d[1]).filter((d) => !!d && typeof d !== "string")
);

// src/checks.ts
var import_parser_combinators7 = __toESM(require_dist());

// src/SimplexDiagnostic.ts
var import_vscode2 = require("vscode");
var SimplexDiagnostic = class extends import_vscode2.Diagnostic {
  constructor(range, message, severity) {
    super(range, message, severity);
    this.source = "TC Simplex";
  }
};

// src/checks.ts
var import_vscode4 = require("vscode");

// src/typeSetup.ts
var typeStringToTypeToken = (value) => {
  let numberOfArrays = 0;
  for (let index = 0; index < value.length; index++) {
    const char = value[index];
    if (char === "[") {
      numberOfArrays++;
    } else break;
  }
  return `${"*".repeat(numberOfArrays)}${value.slice(numberOfArrays, value.length - numberOfArrays)}`;
};
var typeTokenToTypeString = (value) => {
  let numberOfArrays = 0;
  for (let index = 0; index < value.length; index++) {
    const char = value[index];
    if (char === "*") {
      numberOfArrays++;
    } else break;
  }
  return `${"[".repeat(numberOfArrays)}${value.slice(numberOfArrays)}${"]".repeat(numberOfArrays)}`;
};
var tryGetVariable = (inScope, environments, name) => {
  for (let index = environments.length - 1; index >= 1; index--) {
    const type = environments[index].type;
    const variable = environments[index].variables.get(name);
    if (variable === void 0) {
      if (inScope && type === "function") {
        break;
      }
      continue;
    }
    return variable;
  }
  for (let index = environments.length - 1; index >= 0; index--) {
    const variable = environments[index].variables.get(name);
    if (variable === void 0) {
      continue;
    }
    if (variable.type === "built-in" || variable.kind === "const") {
      return variable;
    }
  }
  return null;
};
var tryGetDotFunction = (environments, name, params) => {
  for (let index = environments.length - 1; index >= 0; index--) {
    for (let func of environments[index].functions.filter(
      (f) => f.name === name && f.kind === "dot"
    )) {
      if (params.length === func.parameterTypes.length && func.parameterTypes.every((toMatch, i) => {
        const type = params[i];
        return doesTypeMatch(type, toMatch);
      })) {
        return func;
      }
    }
  }
  return null;
};
var tryGetDefFunction = (environments, name, params) => {
  for (let index = environments.length - 1; index >= 0; index--) {
    for (let func of environments[index].functions.filter(
      (f) => f.name === name && f.kind === "def"
    )) {
      if (params.length === func.parameterTypes.length && func.parameterTypes.every((toMatch, i) => {
        const type = params[i];
        return doesTypeMatch(type, toMatch);
      })) {
        return func;
      }
    }
  }
  return null;
};
var tryGetBinaryOperator = (environments, name, params) => {
  for (let index = environments.length - 1; index >= 0; index--) {
    for (let func of environments[index].operators.filter(
      (f) => f.name === name && f.kind === "binary"
    )) {
      if (params.length === func.parameterTypes.length && func.parameterTypes.every((toMatch, i) => {
        const type = params[i];
        return doesTypeMatch(type, toMatch);
      })) {
        return func;
      }
    }
  }
  return null;
};
var tryGetUnaryOperator = (environments, name, params) => {
  for (let index = environments.length - 1; index >= 0; index--) {
    for (let func of environments[index].operators.filter(
      (f) => f.name === name && f.kind === "unary"
    )) {
      if (params.length === func.parameterTypes.length && func.parameterTypes.every((toMatch, i) => {
        const type = params[i];
        return doesTypeMatch(type, toMatch);
      })) {
        return func;
      }
    }
  }
  return null;
};
var tryGetReturnType = (environments) => {
  for (let index = environments.length - 1; index >= 0; index--) {
    const env = environments[index];
    if (env.type === "function") {
      if (env.returnType) {
        return typeStringToTypeToken(env.returnType);
      } else return null;
    }
  }
  return null;
};
var getArrayType = (environments, typeName2) => {
  const type = tryGetType(environments, typeName2) ?? {
    type: "built-in",
    data: typeName2
  };
  const arrayTypeName = `*${typeName2}`;
  const arrayType = environments[0].types.get(arrayTypeName);
  if (!arrayType) {
    const typeString = type.type === "user-defined" ? type.data.definition.value : type.data;
    const arrayType2 = {
      type: "built-in",
      data: `[${typeString}]`
    };
    environments[0].types.set(arrayTypeName, arrayType2);
  }
  return arrayTypeName;
};
var tryGetType = (environments, name) => {
  if (name.startsWith("@")) return environments[0].types.get("@") ?? null;
  for (let index = environments.length - 1; index >= 0; index--) {
    const type = environments[index].types.get(name);
    if (type !== void 0) {
      return type;
    }
  }
  if (name.startsWith("*")) {
    return environments[0].types.get(getArrayType(environments, name.slice(1))) ?? null;
  }
  return null;
};
var transformGenericType = (func, types) => {
  if (!func?.returnType) return "?";
  if (!func.returnType.includes("@")) return func.returnType;
  for (let index = 0; index < func.parameterTypes.length; index++) {
    const matchCount = howBaseTypeMatches(
      func.parameterTypes[index],
      func.returnType
    );
    if (matchCount == null) continue;
    if (matchCount == 0) return types[index];
    if (matchCount > 0) {
      return "*".repeat(matchCount) + types[index];
    } else {
      return types[index].slice(-matchCount);
    }
  }
  return "?";
};
var howBaseTypeMatches = (t1, t2) => {
  if (t1 === t2) return 0;
  if (t1.startsWith("*")) {
    const r = howBaseTypeMatches(t1.slice(1), t2);
    return r != null ? r - 1 : r;
  }
  if (t2.startsWith("*")) {
    const r = howBaseTypeMatches(t1, t2.slice(1));
    return r != null ? r + 1 : r;
  }
  return null;
};
var getAfterIndexType = (type, environments) => {
  if (type.startsWith("*")) return type.slice(1);
  if (type === "String") return "Char";
  const typeInfo = tryGetType(environments, type);
  if (!typeInfo || typeInfo.type === "built-in" || Array.isArray(typeInfo.data.definition.value))
    return null;
  return getAfterIndexType(typeInfo.data.definition.value, environments);
};
var isIntegerType = (type) => {
  return type === "Int" || isUnsignedIntegerType(type) || isSignedIntegerType(type);
};
var isUnsignedIntegerType = (type) => {
  return type === "UInt" || /^U\d+$/.test(type);
};
var isSignedIntegerType = (type) => {
  return type === "SInt" || /^S\d+$/.test(type);
};
var doesArrayTypeMatch = (type, toMatch) => {
  if (!type.startsWith("*") || !toMatch.startsWith("*")) return false;
  return doesTypeMatch(type.slice(1), toMatch.slice(1));
};
var doesTypeMatch = (type, toMatch) => {
  if (type === toMatch) return true;
  if (toMatch.startsWith("@")) return true;
  if (toMatch === "UInt" && isUnsignedIntegerType(type)) {
    return true;
  }
  if ((toMatch === "Int" || toMatch === "SInt") && isSignedIntegerType(type)) {
    return true;
  }
  return doesArrayTypeMatch(type, toMatch);
};
var filterOnlyConst = (environments) => {
  return environments.map((e, i) => {
    const operators = i === 0 ? e.operators : [];
    const types = i === 0 ? e.types : /* @__PURE__ */ new Map();
    const switchTypes = i === 0 ? e.switchTypes : /* @__PURE__ */ new Map();
    const variables = new Map(
      Array.from(e.variables.entries()).filter((e2) => e2[1].kind === "const")
    );
    return e.type === "function" ? {
      type: "function",
      switchTypes,
      returnType: null,
      functions: [],
      operators,
      types,
      variables
    } : {
      type: "scope",
      switchTypes,
      functions: [],
      operators,
      types,
      variables
    };
  });
};
var isEnumType = (type, environments) => {
  if (type === "Bool") return ["false", "true"];
  if (type === "TestResult") return ["pass", "fail", "win"];
  const typeData = tryGetType(environments, type);
  if (typeData?.type === "user-defined" && Array.isArray(typeData.data.definition.value)) {
    return typeData.data.definition.value;
  }
  return null;
};
var addDef = (name, description, returnType, parameterTypes) => {
  baseEnvironment.functions.push({
    type: "built-in",
    kind: "def",
    name,
    data: description,
    parameterTypes,
    returnType
  });
};
var addDot = (name, description, returnType, parameterTypes) => {
  baseEnvironment.functions.push({
    type: "built-in",
    kind: "dot",
    name,
    data: description,
    parameterTypes,
    returnType
  });
};
var addUnary = (name, description, returnType, parameterType) => {
  baseEnvironment.operators.push({
    type: "built-in",
    kind: "unary",
    name,
    data: description,
    parameterTypes: [parameterType],
    returnType
  });
};
var addBinary = (name, description, returnType, parameterTypes) => {
  baseEnvironment.operators.push({
    type: "built-in",
    kind: "binary",
    name,
    data: description,
    parameterTypes,
    returnType
  });
};
var addConst = (name, description, varType) => {
  baseEnvironment.variables.set(name, {
    type: "built-in",
    kind: "const",
    data: description,
    varType
  });
};
var addType = (name, description) => {
  const type = {
    type: "built-in",
    data: description
  };
  baseEnvironment.types.set(name, type);
  return name;
};
var addEnum = (name, description, values, boolType2) => {
  const type = addType(name, description);
  values.forEach((v) => {
    addConst(v, `A \`${v}\` value of enum ${name}`, type);
  });
  addBinary(
    "==",
    `Checks if the first ${name} value is equal to the second`,
    boolType2 ?? type,
    [type, type]
  );
  addBinary(
    "!=",
    `Checks if the first ${name} value is not equal to the second`,
    boolType2 ?? type,
    [type, type]
  );
  return type;
};
var boolType = addEnum("Bool", "A boolean value", ["false", "true"]);
addUnary("!", "Negates the boolean", boolType, boolType);
addBinary("||", "ORs two booleans", boolType, [boolType, boolType]);
addBinary("&&", "ANDs two booleans", boolType, [boolType, boolType]);
addEnum(
  "TestResult",
  "Describes whether the test passes, fails, or wins the level",
  ["pass", "fail", "win"],
  boolType
);
var anyType = addType("@", "Any type");
var stringType = addType("String", "A string type");
addBinary("+", "Adds two strings together", stringType, [
  stringType,
  stringType
]);
addBinary("==", "Checks if the first array is equal to the second", boolType, [
  stringType,
  stringType
]);
addBinary(
  "!=",
  "Checks if the first array is not equal to the second",
  boolType,
  [stringType, stringType]
);
var intType = addType("Int", "A type allowing any integer to be passed in");
var addIntOperations = (iType) => {
  addUnary("~", "Inverts the bits of the integer", iType, iType);
  addUnary("-", "Negates the integer", iType, iType);
  addBinary("+", "Adds two integers together", iType, [iType, iType]);
  addBinary("-", "Subtracts two integers together", iType, [iType, iType]);
  addBinary("*", "Multiplies two integers together", iType, [iType, iType]);
  addBinary("/", "Divides two integers together", iType, [iType, iType]);
  addBinary(
    "%",
    "Calculates the modulo of the first integer by the second one",
    iType,
    [iType, iType]
  );
  addBinary("&", "ANDs bits of two integers together", iType, [iType, iType]);
  addBinary("|", "ORs bits of two integers together", iType, [iType, iType]);
  addBinary("^", "XORs bits of two integers together", iType, [iType, iType]);
  addBinary(
    ">>",
    "Shifts the first integer right by the second integers value",
    iType,
    [iType, iType]
  );
  addBinary(
    "<<",
    "Shifts the first integer left by the second integers value",
    iType,
    [iType, iType]
  );
  addBinary(
    "rol",
    "Rotates the first integer left by the second integers value",
    iType,
    [iType, iType]
  );
  addBinary(
    "ror",
    "Rotates the first integer right by the second integers value",
    iType,
    [iType, iType]
  );
  addBinary(
    "asr",
    "Arithmetically shifts the first integer right by the second integers value",
    iType,
    [iType, iType]
  );
  addBinary(
    ">",
    "Checks if the first integer is larger than the second",
    boolType,
    [iType, iType]
  );
  addBinary(
    "<",
    "Checks if the first integer is smaller than the second",
    boolType,
    [iType, iType]
  );
  addBinary(
    "<s",
    "Checks if the first integer is smaller (signed) than the second",
    boolType,
    [iType, iType]
  );
  addBinary(
    "<u",
    "Checks if the first integer is smaller (unsigned) than the second",
    boolType,
    [iType, iType]
  );
  addBinary(
    ">=",
    "Checks if the first integer is larger or equal to the second",
    boolType,
    [iType, iType]
  );
  addBinary(
    "<=",
    "Checks if the first integer is smaller or equal to the second",
    boolType,
    [iType, iType]
  );
  addBinary(
    "!=",
    "Checks if the first integer is not equal to the second",
    boolType,
    [iType, iType]
  );
  addBinary(
    "==",
    "Checks if the first integer is equal to the second",
    boolType,
    [iType, iType]
  );
};
var seedType = addType(
  "Seed",
  "A type used for seeding the random generator"
);
addDef("get_random_seed", "pub def get_random_seed() Seed {", seedType, []);
addDef("next", "pub dot next($s: Seed) Int {", intType, [seedType]);
addDef("random", "pub def random(max: Int) Int {", intType, [intType]);
var sintType = addType(
  "SInt",
  "A type allowing any signed integer to be passed in"
);
var uintType = addType(
  "UInt",
  "A type allowing any unsigned integer to be passed in"
);
for (let width = 1; width <= 2048; width++) {
  const s = addType("S" + width, `A signed integer of width ${width}`);
  addIntOperations(s);
  const u = addType("U" + width, `An unsigned integer of width ${width}`);
  addIntOperations(u);
}
addIntOperations(sintType);
addIntOperations(uintType);
addIntOperations(intType);
var arr = getArrayType.bind(null, [baseEnvironment]);
addDot("find", "pub dot find(array: [@Any], value: @Any) Int {", intType, [
  arr(anyType),
  anyType
]);
addDot("len", "pub dot len(string: String) Int {", intType, [stringType]);
addDot("len", "pub dot len(array: [@Any]) Int {", intType, [arr(anyType)]);
addDot(
  "contains",
  "pub dot contains(array: [@Type], value: @Type) Bool {",
  boolType,
  [arr(anyType), anyType]
);
addDot("in", "pub dot in(value: @Type, array: [@Type]) Bool {", boolType, [
  anyType,
  arr(anyType)
]);
addDef("high", "pub dot high(a: [@Any]) Int {", intType, [arr(anyType)]);
addDef("sort", "pub def sort($arr: [@Any]) {", null, [arr(anyType)]);
addDef("quick_sort", "pub def quick_sort($arr: [@Any]) {", null, [
  arr(anyType)
]);
addDef("sample", "pub def sample(array: [@Any]) @Any {", anyType, [
  arr(anyType)
]);
addBinary("+", "Concatenates two arrays together", arr(anyType), [
  arr(anyType),
  arr(anyType)
]);
addBinary("==", "Checks if the first array is equal to the second", boolType, [
  arr(anyType),
  arr(anyType)
]);
addBinary(
  "!=",
  "Checks if the first array is not equal to the second",
  boolType,
  [arr(anyType), arr(anyType)]
);
addDef("_size", "pub def _size(data: @Any) Int {", intType, [anyType]);
addDef(
  "array",
  "pub def array(length: Int, value: @Any) [@Any] {",
  arr(anyType),
  [intType, anyType]
);
addDef("random", "pub def random(max: Int) Int {", intType, [intType]);
addDef("min", "pub def min(a: Int, b: Int) Int {", intType, [intType, intType]);
addDef("max", "pub def max(a: Int, b: Int) Int {", intType, [intType, intType]);
addDef("log10", "pub def log10(a: Int) Int {", intType, [intType]);
addDef("int", "pub def int(value: String) Int {", intType, [stringType]);
addDef("str", "pub def str(value: @Any) String {", stringType, [anyType]);
addDef("exit", "pub def exit() {", null, []);
addDef("exit", "pub def exit(code: Int) {", null, [intType]);
addDef("get_tick", "pub def get_tick() Int {", intType, []);
addDef("get_last_time", "pub def get_last_time() Int {", intType, []);
addDef(
  "get_register_value",
  "pub def get_register_value(register: Int) Int {",
  intType,
  [intType]
);
addDef("has_ram", "pub def has_ram() Bool {", boolType, []);
addDef("get_ram_value", "pub def get_ram_value(address: Int) Int {", intType, [
  intType
]);
addDef("get_ram_size", "pub def get_ram_size() Int {", intType, []);
addDef("get_delay_score", "pub def get_delay_score() Int {", intType, []);
addDef(
  "get_component_count",
  "pub def get_component_count() Int {",
  intType,
  []
);
addDef(
  "get_program_address",
  "pub def get_program_address() Int {",
  intType,
  []
);
addDef("get_program_output", "pub def get_program_output() Int {", intType, []);
addDef(
  "get_level_memory",
  "pub def get_level_memory(id: String) Int {",
  intType,
  [stringType]
);
addDef(
  "set_custom_input_text",
  "pub def set_custom_input_text(text: String) {",
  null,
  [stringType]
);
addDef(
  "ui_set_hidden",
  "pub def ui_set_hidden(id: String, hidden: Bool) {",
  null,
  [stringType, boolType]
);
addDef("ui_set_text", "pub def ui_set_text(id: String, text: String) {", null, [
  stringType,
  stringType
]);
addDef(
  "ui_set_position",
  "pub def ui_set_position(id: String, x: Int, y: Int) {",
  null,
  [stringType, intType, intType]
);
addDef("set_error", "pub def set_error(text: String) {", null, [stringType]);
addDef("output", "pub def output(text: String) {", null, [stringType]);
addDef("add_keyboard_value", "pub def add_keyboard_value(value: Int) {", null, [
  intType
]);
addDef(
  "has_time_component",
  "pub def has_time_component() Bool {",
  boolType,
  []
);
addDef(
  "has_keyboard_component",
  "pub def has_keyboard_component() Bool {",
  boolType,
  []
);
addDef(
  "has_console_component",
  "pub def has_console_component() Bool {",
  boolType,
  []
);
addDef(
  "get_assembler_register_count",
  "pub def get_assembler_register_count() Int {",
  intType,
  []
);
addDef("get_console_offset", "pub def get_console_offset() Int {", intType, []);
addDef(
  "get_assembler_width",
  "pub def get_assembler_width() Int {",
  intType,
  []
);
addDef(
  "get_latency_ram_is_busy",
  "pub def get_latency_ram_is_busy() Bool {",
  boolType,
  []
);
addDef("set_address_text", "pub def set_address_text(text: String) {", null, [
  stringType
]);
addDef("set_value_text", "pub def set_value_text(text: String) {", null, [
  stringType
]);
addDef("get_cycle_count", "pub def get_cycle_count() Int {", intType, []);
addDef("get_probe_value", "pub def get_probe_value() Int {", intType, []);
addDef("get_gate_score", "pub def get_gate_score() Int {", intType, []);
addDef("print", "pub def print(input: @Any) {", null, [anyType]);
addConst(
  "Z_STATE",
  "Constant denoting the `Hi-Z` state of the wire.\n\nEquivalent to `0x8000_0000_0000_0000`.",
  intType
);

// src/checks.ts
var useParser = (text, parser, path = "") => {
  const res = parser({ text, path, index: 0 });
  if ((0, import_parser_combinators7.isFailure)(res)) {
    throw new import_parser_combinators7.ParseError(
      `Parse error, expected ${[...res.history].pop()} at char ${res.ctx.index}`,
      res.ctx.text,
      res.ctx.index,
      res.history
    );
  }
  if (res.ctx.index !== res.ctx.text.length) {
    throw new import_parser_combinators7.ParseError(
      `Parse error at index ${res.ctx.index}`,
      res.ctx.text,
      res.ctx.index,
      []
    );
  }
  return res.value;
};
var performParsing = (document) => {
  const fullText = document.getText();
  const diags = [];
  const startTime = Date.now();
  let parseResult = null;
  try {
    parseResult = useParser(fullText, languageParser);
  } catch (p) {
    if (p instanceof import_parser_combinators7.ParseError) {
      const position = document.positionAt(p.index);
      diags.push(
        new SimplexDiagnostic(
          document.getWordRangeAtPosition(position) ?? new import_vscode3.Range(position, position),
          p.message,
          import_vscode3.DiagnosticSeverity.Error
        )
      );
    } else if (p instanceof Error) {
      log.appendLine(p.stack ?? p.message);
    } else log.appendLine("Error: " + p);
  }
  const issues = getRecoveryIssues();
  for (const issue of issues) {
    if (issue.type === "skipped") {
      diags.push(
        new SimplexDiagnostic(
          new import_vscode3.Range(
            document.positionAt(issue.index),
            document.positionAt(issue.index + issue.text.length)
          ),
          `Unknown characters found: \`${issue.text}\``,
          issue.kind === "warning" ? import_vscode3.DiagnosticSeverity.Warning : import_vscode3.DiagnosticSeverity.Error
        )
      );
    } else {
      diags.push(
        new SimplexDiagnostic(
          new import_vscode3.Range(
            document.positionAt(issue.index),
            document.positionAt(issue.index)
          ),
          `Missing ${issue.text}`,
          issue.kind === "warning" ? import_vscode3.DiagnosticSeverity.Warning : import_vscode3.DiagnosticSeverity.Error
        )
      );
    }
  }
  log.appendLine(`Time spent parsing: ${Date.now() - startTime}ms`);
  return [parseResult, diags];
};
var typeCheck = () => import_vscode4.workspace.getConfiguration("tcsi").get("showTypeCheckingErrors");
var explicitReturn = () => import_vscode4.workspace.getConfiguration("tcsi").get("warnOnMissingExplicitReturn");
if (typeCheck() == null) {
  try {
    import_vscode4.workspace.getConfiguration("tcsi").update("showTypeCheckingErrors", true);
  } catch (e) {
  }
}
var logging = false;
var logg = (v) => logging && log.appendLine(v);
var newScope = () => ({
  type: "scope",
  switchTypes: /* @__PURE__ */ new Map(),
  functions: [],
  operators: [],
  types: /* @__PURE__ */ new Map(),
  variables: /* @__PURE__ */ new Map()
});
var newFunction = (returnType) => ({
  type: "function",
  switchTypes: /* @__PURE__ */ new Map(),
  functions: [],
  operators: [],
  types: /* @__PURE__ */ new Map(),
  variables: /* @__PURE__ */ new Map(),
  returnType
});
var checkVariableExistence = (document, result, environments, diagnostics2) => {
  result.forEach((scope) => {
    switch (scope.type) {
      case "type-definition": {
        const kind = tryGetType(environments, scope.name.value);
        if (kind !== null) {
          diagnostics2.push(new SimplexDiagnostic(
            new import_vscode3.Range(
              document.positionAt(scope.name.start),
              document.positionAt(scope.name.end)
            ),
            `You should not redeclare types: '${scope.name.value}'`,
            import_vscode3.DiagnosticSeverity.Warning
          ));
        } else {
          const currentEnv = environments[environments.length - 1];
          currentEnv.types.set(scope.name.value, {
            type: "user-defined",
            data: scope
          });
          if (Array.isArray(scope.definition.value)) {
            scope.definition.value.forEach((v) => {
              currentEnv.variables.set(v, {
                type: "built-in",
                kind: "const",
                data: `A \`${v}\` value of enum ${scope.name.value}`,
                varType: scope.name.value
              });
            });
            currentEnv.operators.push({
              type: "built-in",
              kind: "binary",
              name: "==",
              data: `Checks if the first ${scope.name.value} value is equal to the second`,
              parameterTypes: [scope.name.value, scope.name.value],
              returnType: "Bool"
            });
            currentEnv.operators.push({
              type: "built-in",
              kind: "binary",
              name: "!=",
              data: `Checks if the first ${scope.name.value} value is not equal to the second`,
              parameterTypes: [scope.name.value, scope.name.value],
              returnType: "Bool"
            });
          } else {
            currentEnv.types.set(scope.name.value, {
              type: "user-defined",
              data: scope
            });
          }
          tokensData.push({
            definition: scope.definition,
            position: scope.name,
            info: {
              range: scope.definition
            }
          });
        }
        break;
      }
    }
  });
  result.forEach((scope) => {
    switch (scope.type) {
      case "function-declaration": {
        if (scope.definition.type === "function") {
          const paramTypes = scope.definition.parameters.map((param) => checkType(param.type, document, environments, diagnostics2) ?? "?");
          const kind = scope.definition.kind === "def" ? tryGetDefFunction(environments, scope.definition.name.value, paramTypes) : tryGetDotFunction(environments, scope.definition.name.value, paramTypes);
          if (kind !== null) {
            diagnostics2.push(new SimplexDiagnostic(
              new import_vscode3.Range(
                document.positionAt(scope.definition.name.start),
                document.positionAt(scope.definition.name.end)
              ),
              `You should not redeclare functions: '${scope.definition.name.value}'`,
              import_vscode3.DiagnosticSeverity.Warning
            ));
          } else {
            const currentEnv = environments[environments.length - 1];
            const returnType = checkType(scope.definition.returnType, document, environments, diagnostics2);
            currentEnv.functions.push({
              type: "user-defined",
              kind: scope.definition.kind,
              name: scope.definition.name.value,
              data: scope.definition.name,
              parameterTypes: paramTypes,
              returnType
            });
            tokensData.push({
              definition: scope.definition.name,
              position: scope.definition.name,
              info: {
                range: scope.definition.name
              }
            });
          }
        } else {
          const paramTypes = scope.definition.parameters.map((param) => checkType(param.type, document, environments, diagnostics2) ?? "?");
          const kind = scope.definition.kind === "binary" ? tryGetBinaryOperator(environments, scope.definition.name.value, paramTypes) : tryGetUnaryOperator(environments, scope.definition.name.value, paramTypes);
          if (kind !== null) {
            diagnostics2.push(new SimplexDiagnostic(
              new import_vscode3.Range(
                document.positionAt(scope.definition.name.start),
                document.positionAt(scope.definition.name.end)
              ),
              `You should not redeclare operators: '${scope.definition.name.value}'`,
              import_vscode3.DiagnosticSeverity.Warning
            ));
          } else {
            const currentEnv = environments[environments.length - 1];
            const returnType = checkType(scope.definition.returnType, document, environments, diagnostics2);
            currentEnv.operators.push({
              type: "user-defined",
              kind: scope.definition.kind,
              name: scope.definition.name.value,
              data: scope.definition.name,
              parameterTypes: paramTypes,
              returnType: returnType ?? "?"
            });
            tokensData.push({
              definition: scope.definition.name,
              position: scope.definition.name,
              info: {
                range: scope.definition.name
              }
            });
          }
        }
        break;
      }
    }
  });
  result.forEach((scope) => {
    switch (scope.type) {
      case "declaration": {
        diagnostics2.push(...processRValue(document, environments, scope.value.value));
        if (scope.kind.value === "const") {
          if (scope.name.value.name.search(/[a-z]/) >= 0) {
            diagnostics2.push(new SimplexDiagnostic(
              new import_vscode3.Range(
                document.positionAt(scope.name.start),
                document.positionAt(scope.name.end)
              ),
              `Constants have to use only uppercase letters`,
              import_vscode3.DiagnosticSeverity.Error
            ));
          }
        } else {
          if (scope.name.value.name.search(/[A-Z]/) >= 0) {
            diagnostics2.push(new SimplexDiagnostic(
              new import_vscode3.Range(
                document.positionAt(scope.name.start),
                document.positionAt(scope.name.end)
              ),
              `Variables have to use only lowercase letters`,
              import_vscode3.DiagnosticSeverity.Error
            ));
          }
        }
        const variable = tryGetVariable(true, environments, scope.name.value.name);
        if (variable !== null) {
          diagnostics2.push(new SimplexDiagnostic(
            new import_vscode3.Range(
              document.positionAt(scope.name.start),
              document.positionAt(scope.name.end)
            ),
            `You should not redeclare variables: '${scope.name.value.name}'`,
            import_vscode3.DiagnosticSeverity.Warning
          ));
        } else {
          const varType = getType(
            scope.value,
            document,
            scope.kind.value === "const" ? filterOnlyConst(environments) : environments,
            diagnostics2
          );
          environments[environments.length - 1].variables.set(scope.name.value.name, {
            type: "user-defined",
            kind: scope.kind.value,
            data: scope.name,
            varType
          });
          tokensData.push({
            definition: scope.name,
            position: scope.name,
            info: {
              range: {
                start: scope.kind.start,
                end: scope.name.end
              },
              type: varType
            }
          });
        }
        break;
      }
      case "modification": {
        diagnostics2.push(...processRValue(document, environments, scope.value.value));
        const left = getType(scope.name, document, environments, diagnostics2);
        const right = getType(scope.value, document, environments, diagnostics2);
        if (typeCheck() && left !== right) {
          if (!isIntegerType(left) || scope.value.value.type !== "number") {
            diagnostics2.push(new SimplexDiagnostic(
              new import_vscode3.Range(
                document.positionAt(scope.value.start),
                document.positionAt(scope.value.end)
              ),
              `Cannot assign a value of type ${typeTokenToTypeString(right)} to a variable of type ${typeTokenToTypeString(left)}`
            ));
          }
        }
        if (scope.name.value.type === "variable") {
          const variable = tryGetVariable(!scope.name.value.value.value.front.includes("."), environments, scope.name.value.value.value.name);
          if (variable === null) {
            const variableSecondTry = tryGetVariable(false, environments, scope.name.value.value.value.name);
            if (variableSecondTry != null) {
              return [
                new SimplexDiagnostic(
                  new import_vscode3.Range(
                    document.positionAt(scope.name.start),
                    document.positionAt(scope.name.end)
                  ),
                  `Cannot find name '${scope.name.value.value.value.name}' - maybe you should access it using '.'?`
                )
              ];
            } else {
              return [
                new SimplexDiagnostic(
                  new import_vscode3.Range(
                    document.positionAt(scope.name.start),
                    document.positionAt(scope.name.end)
                  ),
                  `Cannot find name '${scope.name.value.value.value.name}'`
                )
              ];
            }
          } else {
            tokensData.push({
              definition: variable.data,
              position: scope.name,
              info: {}
            });
            if (variable.kind !== "var") {
              diagnostics2.push(new SimplexDiagnostic(
                new import_vscode3.Range(
                  document.positionAt(scope.name.start),
                  document.positionAt(scope.name.end)
                ),
                `Cannot assign to '${scope.name.value.value.value.name}' because it is a constant`
              ));
            }
          }
        } else {
          const index = scope.name.value;
          diagnostics2.push(...processRValue(document, environments, index.parameter.value));
          diagnostics2.push(...processRValue(document, environments, index.value.value));
        }
        break;
      }
      case "return": {
        if (scope.value.value) {
          diagnostics2.push(...processRValue(document, environments, scope.value.value));
          const varType = getType(scope.value, document, environments, diagnostics2);
          const funcType = tryGetReturnType(environments);
          if (typeCheck() && varType !== funcType) {
            diagnostics2.push(new SimplexDiagnostic(
              new import_vscode3.Range(
                document.positionAt(scope.value.start),
                document.positionAt(scope.value.end)
              ),
              funcType ? `Returned type is not the function's declared return type - was ${typeTokenToTypeString(varType)} - should be ${typeTokenToTypeString(funcType)}` : `Returned ${typeTokenToTypeString(varType)}, but the function was declared to not return anything`
            ));
          }
        }
        break;
      }
      case "statements": {
        const nextEnvironments = [...environments, newScope()];
        checkVariableExistence(
          document,
          scope.statements,
          nextEnvironments,
          diagnostics2
        );
        break;
      }
      case "_reg_alloc_use": {
        diagnostics2.push(...checkVariable(scope.value, document, environments));
        break;
      }
      case "function-declaration": {
        if (scope.definition.type === "function") {
          if (scope.definition.kind === "dot") {
            if (scope.definition.parameters.length === 0) {
              diagnostics2.push(new SimplexDiagnostic(
                new import_vscode3.Range(
                  document.positionAt(scope.definition.name.end),
                  document.positionAt(scope.definition.returnType.start)
                ),
                `Dot function should have at least one parameter`
              ));
            }
          }
        } else {
          if (scope.definition.kind === "binary") {
            if (scope.definition.parameters.length > 2) {
              scope.definition.parameters.slice(2).forEach((param) => {
                diagnostics2.push(new SimplexDiagnostic(
                  new import_vscode3.Range(
                    document.positionAt(param.name.start),
                    document.positionAt(param.type.end)
                  ),
                  `Binary operators should have two parameters`
                ));
              });
            } else if (scope.definition.parameters.length < 2) {
              diagnostics2.push(new SimplexDiagnostic(
                new import_vscode3.Range(
                  document.positionAt(scope.definition.name.end),
                  document.positionAt(scope.definition.returnType.start)
                ),
                `Binary operators should have two parameters`
              ));
            }
          } else {
            if (scope.definition.parameters.length > 1) {
              scope.definition.parameters.slice(1).forEach((param) => {
                diagnostics2.push(new SimplexDiagnostic(
                  new import_vscode3.Range(
                    document.positionAt(param.name.start),
                    document.positionAt(param.type.end)
                  ),
                  `Unary operators should have one parameter`
                ));
              });
            } else if (scope.definition.parameters.length < 1) {
              diagnostics2.push(new SimplexDiagnostic(
                new import_vscode3.Range(
                  document.positionAt(scope.definition.name.end),
                  document.positionAt(scope.definition.returnType.start)
                ),
                `Unary operators should have one parameter`
              ));
            }
          }
          if (!scope.definition.name.value.startsWith("=") && scope.definition.name.value.endsWith("=")) {
            if (scope.definition.returnType.value) {
              diagnostics2.push(new SimplexDiagnostic(
                new import_vscode3.Range(
                  document.positionAt(scope.definition.returnType.start),
                  document.positionAt(scope.definition.returnType.end)
                ),
                `Assignment operators should not return anything`
              ));
            }
            if (scope.definition.parameters.length > 0) {
              if (scope.definition.parameters[0].name.value.front !== "$") {
                diagnostics2.push(new SimplexDiagnostic(
                  new import_vscode3.Range(
                    document.positionAt(scope.definition.parameters[0].name.start),
                    document.positionAt(scope.definition.parameters[0].name.end)
                  ),
                  `The first parameter of an assignment operator should be mutable`
                ));
              }
            }
          } else {
            if (!scope.definition.returnType.value) {
              diagnostics2.push(new SimplexDiagnostic(
                new import_vscode3.Range(
                  document.positionAt(scope.definition.returnType.start),
                  document.positionAt(scope.definition.returnType.end)
                ),
                `Missing return type`
              ));
            }
          }
        }
        const nextEnvironments = [...environments, newFunction(scope.definition.returnType.value)];
        scope.definition.parameters.forEach((parameter2) => {
          const env = nextEnvironments[nextEnvironments.length - 1];
          const variableName2 = parameter2.name.value;
          const varType = checkType(parameter2.type, document, environments, diagnostics2);
          if (typeCheck() && !varType) {
            diagnostics2.push(new SimplexDiagnostic(
              new import_vscode3.Range(
                document.positionAt(parameter2.type.start),
                document.positionAt(parameter2.type.end)
              ),
              `Missing type: '${parameter2.type.value}'`
            ));
          }
          if (variableName2.front === "$") {
            env.variables.set(variableName2.name, {
              type: "user-defined",
              kind: "var",
              data: parameter2.name,
              varType
            });
            tokensData.push({
              definition: parameter2.name,
              position: parameter2.name,
              info: {
                range: {
                  start: parameter2.name.start,
                  end: parameter2.type.end
                },
                type: varType ?? void 0
              }
            });
          } else {
            env.variables.set(variableName2.name, {
              type: "user-defined",
              kind: "const",
              data: parameter2.name,
              varType
            });
            tokensData.push({
              definition: parameter2.name,
              position: parameter2.name,
              info: {
                range: {
                  start: parameter2.name.start,
                  end: parameter2.type.end
                },
                type: varType ?? void 0
              }
            });
          }
        });
        checkVariableExistence(
          document,
          scope.statements,
          nextEnvironments,
          diagnostics2
        );
        if (explicitReturn() && scope.definition.returnType.value) {
          if (!doesReturn(document, scope.statements, nextEnvironments, diagnostics2)) {
            diagnostics2.push(new SimplexDiagnostic(
              new import_vscode3.Range(
                document.positionAt(scope.definition.returnType.start),
                document.positionAt(scope.definition.returnType.end)
              ),
              `A function with return type has to return a value`,
              import_vscode3.DiagnosticSeverity.Warning
            ));
          }
        }
        break;
      }
      case "if": {
        diagnostics2.push(...processRValue(document, environments, scope.value.value));
        const nextIfEnvironments = [...environments, newScope()];
        checkVariableExistence(
          document,
          scope.ifBlock,
          nextIfEnvironments,
          diagnostics2
        );
        const varType = getType(scope.value, document, environments, diagnostics2);
        if (typeCheck() && varType !== "Bool") {
          diagnostics2.push(new SimplexDiagnostic(
            new import_vscode3.Range(
              document.positionAt(scope.value.start),
              document.positionAt(scope.value.end)
            ),
            `An if block condition has to be a boolean type - was ${typeTokenToTypeString(varType)}`
          ));
        }
        scope.elifBlocks.forEach((elif) => {
          diagnostics2.push(...processRValue(document, environments, elif.value.value));
          const nextElifEnvironments = [...environments, newScope()];
          checkVariableExistence(
            document,
            elif.statements,
            nextElifEnvironments,
            diagnostics2
          );
          const varType2 = getType(elif.value, document, environments, diagnostics2);
          if (typeCheck() && varType2 !== "Bool") {
            diagnostics2.push(new SimplexDiagnostic(
              new import_vscode3.Range(
                document.positionAt(scope.value.start),
                document.positionAt(scope.value.end)
              ),
              `An elif block condition has to be a boolean type - was ${typeTokenToTypeString(varType2)}`
            ));
          }
        });
        const nextElseEnvironments = [...environments, newScope()];
        checkVariableExistence(
          document,
          scope.elseBlock,
          nextElseEnvironments,
          diagnostics2
        );
        break;
      }
      case "switch": {
        const varType = getType(scope.value, document, environments, diagnostics2);
        const caseValues = [];
        scope.cases.forEach((oneCase) => {
          if (typeof oneCase.caseName.value !== "string") {
            if (oneCase.caseName.value.type === "variable") {
              diagnostics2.push(...checkVariable(oneCase.caseName.value.value, document, environments));
            }
          }
          if (oneCase.caseName.value === "default") {
            if (typeCheck() && caseValues.includes(null)) {
              diagnostics2.push(new SimplexDiagnostic(
                new import_vscode3.Range(
                  document.positionAt(oneCase.caseName.start),
                  document.positionAt(oneCase.caseName.end)
                ),
                `The switch block already has a default case`
              ));
            }
            caseValues.push(null);
          } else {
            const caseName = oneCase.caseName;
            const caseType = getType(caseName, document, environments, diagnostics2);
            const caseValue = caseName.value.type === "variable" ? `v'${caseName.value.value.value.front}${caseName.value.value.value.name}` : caseName.value.type === "number" ? `n'${caseName.value.value}` : `s'${caseName.value.value}`;
            if (typeCheck()) {
              if (varType !== caseType) {
                if (!isIntegerType(varType) || caseName.value.type !== "number") {
                  diagnostics2.push(new SimplexDiagnostic(
                    new import_vscode3.Range(
                      document.positionAt(caseName.start),
                      document.positionAt(caseName.end)
                    ),
                    `The switch block condition is of type ${typeTokenToTypeString(varType)} but the case value is of type ${typeTokenToTypeString(caseType)}`
                  ));
                }
              }
              if (caseValues.includes(caseValue)) {
                diagnostics2.push(new SimplexDiagnostic(
                  new import_vscode3.Range(
                    document.positionAt(oneCase.caseName.start),
                    document.positionAt(oneCase.caseName.end)
                  ),
                  `This switch block already has this case specified`
                ));
              }
            }
            caseValues.push(caseValue);
          }
          const nextCaseEnvironments = [...environments, newScope()];
          checkVariableExistence(
            document,
            oneCase.statements,
            nextCaseEnvironments,
            diagnostics2
          );
        });
        diagnostics2.push(...processRValue(document, environments, scope.value.value));
        environments[environments.length - 1].switchTypes.set(`${scope.value.start}_${scope.value.end}`, [varType, caseValues]);
        break;
      }
      case "while": {
        diagnostics2.push(...processRValue(document, environments, scope.value.value));
        const nextEnvironments = [...environments, newScope()];
        checkVariableExistence(
          document,
          scope.statements,
          nextEnvironments,
          diagnostics2
        );
        const varType = getType(scope.value, document, environments, diagnostics2);
        if (typeCheck() && varType !== "Bool") {
          diagnostics2.push(new SimplexDiagnostic(
            new import_vscode3.Range(
              document.positionAt(scope.value.start),
              document.positionAt(scope.value.end)
            ),
            `A while block condition has to be a boolean type - was ${typeTokenToTypeString(varType)}`
          ));
        }
        break;
      }
      case "type-definition": {
        break;
      }
      default: {
        diagnostics2.push(...processRValue(document, environments, scope));
        break;
      }
    }
  });
};
var processRValue = (document, environments, rValue2) => {
  const results = [];
  switch (rValue2.type) {
    case "number":
    case "string": {
      break;
    }
    case "interpolated": {
      rValue2.inserts.forEach((i) => {
        results.push(...processRValue(document, environments, i.value.value));
      });
      break;
    }
    case "variable": {
      results.push(...checkVariable(rValue2.value, document, environments));
      break;
    }
    case "cast": {
      results.push(...processRValue(document, environments, rValue2.value.value));
      break;
    }
    case "array": {
      rValue2.values.forEach((v) => {
        results.push(...processRValue(document, environments, v.value));
      });
      break;
    }
    case "index": {
      results.push(...processRValue(document, environments, rValue2.value.value));
      results.push(...processRValue(document, environments, rValue2.parameter.value));
      break;
    }
    case "unary": {
      results.push(...processRValue(document, environments, rValue2.value.value));
      break;
    }
    case "binary": {
      results.push(...processRValue(document, environments, rValue2.left.value));
      results.push(...processRValue(document, environments, rValue2.right.value));
      break;
    }
    case "ternary": {
      results.push(...processRValue(document, environments, rValue2.condition.value));
      results.push(...processRValue(document, environments, rValue2.ifTrue.value));
      results.push(...processRValue(document, environments, rValue2.ifFalse.value));
      break;
    }
    case "dotMethod": {
      results.push(...processRValue(document, environments, rValue2.object.value));
      rValue2.parameters.forEach((p) => {
        results.push(...processRValue(document, environments, p.value));
      });
      const kind = tryGetDotFunction(
        environments,
        rValue2.value.value,
        [rValue2.object, ...rValue2.parameters].map((p) => getType(p, document, environments, results))
      );
      if (kind === null) {
        results.push(
          new SimplexDiagnostic(
            new import_vscode3.Range(
              document.positionAt(rValue2.value.start),
              document.positionAt(rValue2.value.end)
            ),
            `Cannot find name '${rValue2.value.value}'`
          )
        );
      } else {
        tokensData.push({
          definition: kind.data,
          position: rValue2.value,
          info: {}
        });
      }
      break;
    }
    case "function": {
      rValue2.parameters.forEach((p) => {
        results.push(...processRValue(document, environments, p.value));
      });
      getType({
        start: rValue2.value.start,
        end: (rValue2.parameters[rValue2.parameters.length - 1]?.end ?? rValue2.value.end + 1) + 1,
        value: rValue2
      }, document, environments, results);
      const kind = tryGetDefFunction(
        environments,
        rValue2.value.value,
        rValue2.parameters.map((p) => getType(p, document, environments, results))
      );
      if (kind !== null) {
        tokensData.push({
          definition: kind.data,
          position: rValue2.value,
          info: {
            type: kind.returnType ?? void 0
          }
        });
      }
      break;
    }
    case "parenthesis": {
      results.push(...processRValue(document, environments, rValue2.value.value));
      break;
    }
    default: {
      const x = rValue2;
      throw x;
    }
  }
  return results;
};
var checkVariable = (nameToken, document, environments) => {
  const kind = tryGetVariable(
    !nameToken.value.front.includes("."),
    environments,
    nameToken.value.name
  );
  if (kind === null) {
    const secondKind = tryGetVariable(false, environments, nameToken.value.name);
    if (secondKind != null) {
      return [
        new SimplexDiagnostic(
          new import_vscode3.Range(
            document.positionAt(nameToken.start),
            document.positionAt(nameToken.end)
          ),
          `Cannot find name '${nameToken.value.name}' - maybe you should access it using '.'?`
        )
      ];
    } else {
      return [
        new SimplexDiagnostic(
          new import_vscode3.Range(
            document.positionAt(nameToken.start),
            document.positionAt(nameToken.end)
          ),
          `Cannot find name '${nameToken.value.name}'`
        )
      ];
    }
  } else {
    tokensData.push({
      definition: kind.data,
      position: nameToken,
      info: {
        type: kind.varType ?? "?"
      }
    });
  }
  return [];
};
var checkType = (typeToken, document, environments, diagnostics2) => {
  if (!typeToken.value) return null;
  const typeName2 = typeStringToTypeToken(typeToken.value);
  const envType = tryGetType(environments, typeName2);
  if (!envType) {
    diagnostics2.push(new SimplexDiagnostic(
      new import_vscode3.Range(
        document.positionAt(typeToken.start),
        document.positionAt(typeToken.end)
      ),
      `Cannot find type: '${typeToken.value}'`
    ));
  }
  return typeName2;
};
var doesReturn = (document, statements, environments, diagnostics2) => {
  for (let index = statements.length - 1; index >= 0; index--) {
    const statement = statements[index];
    switch (statement.type) {
      case "return": {
        if (statement.value.value) {
          return true;
        } else {
          diagnostics2.push(new SimplexDiagnostic(
            new import_vscode3.Range(
              document.positionAt(statement.value.start),
              document.positionAt(statement.value.end)
            ),
            `A return in a function with specified return type must return a value`,
            import_vscode3.DiagnosticSeverity.Warning
          ));
        }
        break;
      }
      case "if": {
        if (doesReturn(document, statement.ifBlock, environments, diagnostics2) && doesReturn(document, statement.elseBlock, environments, diagnostics2) && statement.elifBlocks.every((b) => doesReturn(document, b.statements, environments, diagnostics2))) {
          return true;
        }
        break;
      }
      case "switch": {
        if (statement.cases.every((c) => doesReturn(document, c.statements, environments, diagnostics2))) {
          if (statement.cases.some((c) => c.caseName.value === "default")) {
            return true;
          }
          const currentEnv = environments[environments.length - 1];
          const switchData = currentEnv.switchTypes.get(`${statement.value.start}_${statement.value.end}`);
          if (switchData) {
            const enumData = isEnumType(switchData[0], environments);
            if (enumData) {
              if (switchData[1].every((s) => s?.startsWith("v"))) {
                if (new Set(switchData[1]).size === enumData.length) {
                  return true;
                } else {
                  diagnostics2.push(new SimplexDiagnostic(
                    new import_vscode3.Range(
                      document.positionAt(statement.value.start),
                      document.positionAt(statement.value.end)
                    ),
                    `The switch block over an enum does not check all the cases. Did you miss a default case?`,
                    import_vscode3.DiagnosticSeverity.Warning
                  ));
                }
              }
            }
          }
        }
      }
    }
  }
  return false;
};
var getType = (value, document, environments, diagnostics2) => {
  const rValue2 = value.value;
  switch (rValue2.type) {
    case "number":
      logg(`Number: Int`);
      return "Int";
    case "string":
    case "interpolated":
      logg(`String: String`);
      return "String";
    case "parenthesis": {
      const type = getType(rValue2.value, document, environments, diagnostics2);
      logg(`Parenthesis: ${type}`);
      return type;
    }
    case "unary": {
      const type = getType(rValue2.value, document, environments, diagnostics2);
      const operator = tryGetUnaryOperator(environments, rValue2.operator, [type]);
      if (typeCheck() && !operator) {
        diagnostics2.push(new SimplexDiagnostic(
          new import_vscode3.Range(
            document.positionAt(rValue2.value.start - 1),
            document.positionAt(rValue2.value.start)
          ),
          `Cannot find unary operator ${rValue2.operator} for type ${typeTokenToTypeString(type)}`
        ));
      }
      logg(`Unary: ${operator?.returnType ?? "?"}`);
      return transformGenericType(operator, [type]);
    }
    case "binary": {
      const leftType = getType(rValue2.left, document, environments, diagnostics2);
      const rightType = getType(rValue2.right, document, environments, diagnostics2);
      let operator = tryGetBinaryOperator(environments, rValue2.operator, [leftType, rightType]);
      if (!operator && isIntegerType(leftType) && rValue2.right.value.type === "number") {
        operator = tryGetBinaryOperator(environments, rValue2.operator, [leftType, leftType]);
      }
      if (!operator && isIntegerType(rightType) && rValue2.left.value.type === "number") {
        operator = tryGetBinaryOperator(environments, rValue2.operator, [rightType, rightType]);
      }
      if (typeCheck() && !operator) {
        diagnostics2.push(new SimplexDiagnostic(
          new import_vscode3.Range(
            document.positionAt(rValue2.left.end),
            document.positionAt(rValue2.right.start)
          ),
          `Cannot find binary operator ${rValue2.operator} for types ${typeTokenToTypeString(leftType)} and ${typeTokenToTypeString(rightType)}`
        ));
      }
      logg(`Binary: ${operator?.returnType ?? "?"}`);
      return transformGenericType(operator, [leftType, rightType]);
    }
    case "ternary": {
      const conditionType = getType(rValue2.condition, document, environments, diagnostics2);
      const ifTrueType = getType(rValue2.ifTrue, document, environments, diagnostics2);
      const ifFalseType = getType(rValue2.ifFalse, document, environments, diagnostics2);
      if (typeCheck() && conditionType !== "Bool") {
        diagnostics2.push(new SimplexDiagnostic(
          new import_vscode3.Range(
            document.positionAt(rValue2.condition.start),
            document.positionAt(rValue2.condition.end)
          ),
          `A ternary condition has to be a boolean type - was ${typeTokenToTypeString(conditionType)}`
        ));
      }
      if (typeCheck() && ifTrueType !== ifFalseType) {
        diagnostics2.push(new SimplexDiagnostic(
          new import_vscode3.Range(
            document.positionAt(rValue2.ifFalse.start),
            document.positionAt(rValue2.ifFalse.end)
          ),
          `Both ternary branches must have the same type - was ${typeTokenToTypeString(ifTrueType)} and ${typeTokenToTypeString(ifFalseType)}`
        ));
      }
      logg(`Ternary: ${ifTrueType}`);
      return ifTrueType;
    }
    case "dotMethod": {
      const paramTypes = [
        getType(rValue2.object, document, environments, diagnostics2),
        ...rValue2.parameters.map((param) => getType(param, document, environments, diagnostics2))
      ];
      const dotFunction = tryGetDotFunction(environments, rValue2.value.value, paramTypes);
      dotFunction?.parameterTypes.forEach((type, index) => {
        const actualType = paramTypes[index];
        const pos = index === 0 ? rValue2.object : rValue2.parameters[index - 1];
        if (!actualType) {
          if (typeCheck()) {
            diagnostics2.push(new SimplexDiagnostic(
              new import_vscode3.Range(
                document.positionAt(pos.start),
                document.positionAt(pos.end)
              ),
              `Too many parameters - Function takes ${dotFunction.parameterTypes.length - 1} parameters`
            ));
          }
        } else {
          if (typeCheck() && !doesTypeMatch(actualType, type)) {
            diagnostics2.push(new SimplexDiagnostic(
              new import_vscode3.Range(
                document.positionAt(pos.start),
                document.positionAt(pos.end)
              ),
              `Invalid function parameter type - was ${typeTokenToTypeString(actualType)} - should be ${typeTokenToTypeString(type)}`
            ));
          }
        }
      });
      logg(`Dot Method: ${dotFunction?.returnType ?? "?"}`);
      return transformGenericType(dotFunction, paramTypes);
    }
    case "function": {
      const paramTypes = rValue2.parameters.map((param) => getType(param, document, environments, diagnostics2));
      const func = tryGetDefFunction(environments, rValue2.value.value, paramTypes);
      if (typeCheck() && !func) {
        diagnostics2.push(
          new SimplexDiagnostic(
            new import_vscode3.Range(
              document.positionAt(rValue2.value.start),
              document.positionAt(rValue2.value.end)
            ),
            `Cannot find function '${rValue2.value.value}(${paramTypes.map(typeTokenToTypeString).join(", ")})'`
          )
        );
      }
      func?.parameterTypes.forEach((type, index) => {
        const actualType = paramTypes[index];
        const pos = rValue2.parameters[index];
        if (!actualType) {
          if (typeCheck()) {
            diagnostics2.push(new SimplexDiagnostic(
              new import_vscode3.Range(
                document.positionAt(pos.start),
                document.positionAt(pos.end)
              ),
              `Too many parameters - Function takes ${func.parameterTypes.length} parameters`
            ));
          }
        } else {
          if (typeCheck() && !doesTypeMatch(actualType, type)) {
            diagnostics2.push(new SimplexDiagnostic(
              new import_vscode3.Range(
                document.positionAt(pos.start),
                document.positionAt(pos.end)
              ),
              `Invalid function parameter type - was ${typeTokenToTypeString(actualType)} - should be ${typeTokenToTypeString(type)}`
            ));
          }
        }
      });
      logg(`Def Method: ${func?.returnType ?? "?"}`);
      return transformGenericType(func, paramTypes);
    }
    case "cast": {
      getType(rValue2.value, document, environments, diagnostics2);
      logg(`Cast: ${rValue2.to.value}`);
      return typeStringToTypeToken(rValue2.to.value);
    }
    case "array": {
      const valuesTypes = rValue2.values.map((v) => [v, getType(v, document, environments, diagnostics2)]);
      const type = valuesTypes[0];
      if (typeCheck() && !type) {
        diagnostics2.push(new SimplexDiagnostic(
          new import_vscode3.Range(
            document.positionAt(value.start),
            document.positionAt(value.end)
          ),
          `Cannot infer the array type because it has no values`
        ));
      }
      const typeName2 = type?.[1] ?? "?";
      if (valuesTypes.some(([token2, t]) => {
        if (t !== typeName2) {
          if (typeCheck()) {
            diagnostics2.push(new SimplexDiagnostic(
              new import_vscode3.Range(
                document.positionAt(token2.start),
                document.positionAt(token2.end)
              ),
              `Array type inferred as ${typeTokenToTypeString(typeName2)}, but encountered value of type ${typeTokenToTypeString(t)}`
            ));
          }
          return true;
        }
        return false;
      })) {
        logg(`Array: *?`);
        return "*?";
      }
      logg(`Array: *${typeName2}`);
      return `*${typeName2}`;
    }
    case "variable": {
      const variableData = tryGetVariable(false, environments, rValue2.value.value.name);
      if (typeCheck() && (!variableData?.varType || variableData.varType.endsWith("?"))) {
        diagnostics2.push(new SimplexDiagnostic(
          new import_vscode3.Range(
            document.positionAt(rValue2.value.start),
            document.positionAt(rValue2.value.end)
          ),
          `Unknown variable type`
        ));
      }
      logg(`Variable: *${variableData?.varType ?? "?"}`);
      return variableData?.varType ?? "?";
    }
    case "index": {
      const parameterType = getType(rValue2.parameter, document, environments, diagnostics2);
      const variableType = getType(rValue2.value, document, environments, diagnostics2);
      if (typeCheck() && !isIntegerType(parameterType)) {
        diagnostics2.push(new SimplexDiagnostic(
          new import_vscode3.Range(
            document.positionAt(rValue2.parameter.start),
            document.positionAt(rValue2.parameter.end)
          ),
          `An index parameter has to be an integer type - was ${typeTokenToTypeString(parameterType)}`
        ));
      }
      const afterIndexType = getAfterIndexType(variableType, environments);
      if (typeCheck() && !afterIndexType) {
        diagnostics2.push(new SimplexDiagnostic(
          new import_vscode3.Range(
            document.positionAt(rValue2.value.start),
            document.positionAt(rValue2.value.end)
          ),
          `An indexed value has to be an array type - was ${typeTokenToTypeString(variableType)}`
        ));
      }
      logg(`Index: ${afterIndexType ?? "?"}`);
      return afterIndexType ?? "?";
    }
    default: {
      const x = rValue2;
      throw x;
    }
  }
};

// src/test.ts
var import_vscode6 = require("vscode");

// src/extension.ts
var import_vscode5 = require("vscode");
var selector = { language: "si", scheme: "file" };
var renameProvider = {
  prepareRename(document, position) {
    const data = getPositionInfo(document, position);
    if (!data) return Promise.reject();
    if (typeof data.definition === "string") return Promise.reject();
    return new import_vscode5.Range(
      document.positionAt(data.current.start),
      document.positionAt(data.current.end)
    );
  },
  provideRenameEdits(document, position, newName) {
    const data = getPositionInfo(document, position);
    if (!data) return;
    if (typeof data.definition === "string") return;
    const edits = new import_vscode5.WorkspaceEdit();
    for (const { start, end } of data.all) {
      edits.replace(
        document.uri,
        new import_vscode5.Range(document.positionAt(start), document.positionAt(end)),
        newName
      );
    }
    return edits;
  }
};
var declarationProvider = {
  provideDeclaration(document, position) {
    const data = getPositionInfo(document, position);
    if (!data) return;
    const currentStartPosition = document.positionAt(data.current.start);
    const currentEndPosition = document.positionAt(data.current.end);
    if (typeof data.definition === "string") return;
    const definitionStartPosition = document.positionAt(data.definition.start);
    const definitionEndPosition = document.positionAt(data.definition.end);
    const definitionLine = document.lineAt(definitionStartPosition);
    const link = {
      targetUri: document.uri,
      originSelectionRange: new import_vscode5.Range(currentStartPosition, currentEndPosition),
      targetSelectionRange: new import_vscode5.Range(
        definitionStartPosition,
        definitionEndPosition
      ),
      targetRange: definitionLine.range
    };
    return [link];
  }
};
var hoverProvider = {
  provideHover(document, position) {
    const data = getPositionInfo(document, position);
    if (!data) return;
    const range = new import_vscode5.Range(
      document.positionAt(data.current.start),
      document.positionAt(data.current.end)
    );
    const label = new import_vscode5.MarkdownString();
    if (data.info.type) {
      label.appendCodeblock(
        `${document.getText(range)}: ${typeTokenToTypeString(
          data.info.type ?? "?"
        )}`
      );
    } else {
      label.appendCodeblock(document.getText(range));
    }
    label.appendMarkdown("---");
    if (typeof data.definition === "string") {
      label.appendCodeblock("\n" + data.definition, "si");
      return new import_vscode5.Hover(
        label,
        new import_vscode5.Range(
          document.positionAt(data.current.start),
          document.positionAt(data.current.end)
        )
      );
    }
    if (!data.info.range) return;
    const startPosition = document.positionAt(data.info.range.start);
    const line = document.lineAt(startPosition.line);
    label.appendCodeblock("\n" + line.text.trim(), "si");
    return new import_vscode5.Hover(label, range);
  }
};
var diagnosticsPerFile = {};
var deduplicateDiagnostics = (diags) => {
  const key = (d) => `${d.message}(${d.range.start.line}:${d.range.start.character},${d.range.end.line}:${d.range.end.character})`;
  const container = {};
  diags.forEach((d) => {
    const k = key(d);
    if (!(k in container)) {
      container[k] = d;
    }
  });
  return Object.values(container);
};
var tokenProvider = {
  provideDocumentSemanticTokens(document) {
    log.clear();
    tokensData.length = 0;
    getRecoveryIssues().length = 0;
    diagnostics.clear();
    const tokensBuilder = new import_vscode5.SemanticTokensBuilder(legend);
    const [parseResult, diags] = performParsing(document);
    if (parseResult) {
      checkVariableExistence(
        document,
        parseResult,
        [
          baseEnvironment,
          {
            type: "scope",
            switchTypes: /* @__PURE__ */ new Map(),
            functions: [],
            operators: [],
            types: /* @__PURE__ */ new Map(),
            variables: /* @__PURE__ */ new Map()
          }
        ],
        diags
      );
    }
    log.appendLine(`Tokens: ${tokensData.length}`);
    diagnosticsPerFile[document.uri.toString()] = deduplicateDiagnostics(diags);
    Object.entries(diagnosticsPerFile).forEach(([key, value]) => {
      diagnostics.set(import_vscode5.Uri.parse(key, true), value);
    });
    return tokensBuilder.build();
  }
};
import_vscode5.languages.registerDocumentSemanticTokensProvider(
  selector,
  tokenProvider,
  legend
);
import_vscode5.languages.registerDeclarationProvider(selector, declarationProvider);
import_vscode5.languages.registerHoverProvider(selector, hoverProvider);
import_vscode5.languages.registerRenameProvider(selector, renameProvider);

// src/test.ts
var diagnosticParser = (0, import_parser_combinators8.map)(
  (0, import_parser_combinators8.seq)(
    (0, import_parser_combinators8.str)("//#"),
    import_parser_combinators8.spaces,
    (0, import_parser_combinators8.map)(
      (0, import_parser_combinators8.seq)(
        (0, import_parser_combinators8.seq)(
          import_parser_combinators8.intP,
          (0, import_parser_combinators8.str)(":"),
          import_parser_combinators8.intP
        ),
        (0, import_parser_combinators8.seq)(
          import_parser_combinators8.spaces,
          (0, import_parser_combinators8.str)("-"),
          import_parser_combinators8.spaces
        ),
        (0, import_parser_combinators8.seq)(
          import_parser_combinators8.intP,
          (0, import_parser_combinators8.str)(":"),
          import_parser_combinators8.intP
        ),
        (0, import_parser_combinators8.seq)(
          import_parser_combinators8.spacesPlus,
          (0, import_parser_combinators8.str)("-"),
          (0, import_parser_combinators8.any)(
            (0, import_parser_combinators8.str)("Error"),
            (0, import_parser_combinators8.str)("Warning"),
            (0, import_parser_combinators8.str)("Information"),
            (0, import_parser_combinators8.str)("Hint")
          )
        ),
        (0, import_parser_combinators8.seq)(
          import_parser_combinators8.spacesPlus,
          (0, import_parser_combinators8.str)("-"),
          (0, import_parser_combinators8.regex)(/.+/, "Message")
        )
      ),
      ([[sl, _, sc], __, [el, ___, ec], [____, _____, severity], [______, _______, message]]) => ({
        start: {
          line: sl,
          character: sc
        },
        end: {
          line: el,
          character: ec
        },
        message,
        severity: severity === "Error" ? import_vscode6.DiagnosticSeverity.Error : severity === "Warning" ? import_vscode6.DiagnosticSeverity.Warning : severity === "Information" ? import_vscode6.DiagnosticSeverity.Information : import_vscode6.DiagnosticSeverity.Hint
      })
    )
  ),
  ([_, __, diag]) => diag
);
var generateMockDocument = (path, text, textSplitted) => {
  return {
    uri: import_vscode6.Uri.file(path),
    fileName: (0, import_path.basename)(path),
    isUntitled: false,
    languageId: "si",
    version: 1,
    isDirty: false,
    isClosed: false,
    eol: import_vscode6.EndOfLine.LF,
    lineCount: text.split("\n").length,
    save: () => Promise.resolve(false),
    lineAt: (lineOrPosition) => {
      const lineNumber = typeof lineOrPosition === "number" ? lineOrPosition : lineOrPosition.line;
      const lineText = textSplitted[lineNumber];
      const nonWhiteSpaceIndex = lineText.search(/\S/);
      return {
        range: new import_vscode6.Range(
          lineNumber,
          0,
          lineNumber,
          lineText.length
        ),
        text: lineText,
        isEmptyOrWhitespace: nonWhiteSpaceIndex === -1,
        rangeIncludingLineBreak: new import_vscode6.Range(
          lineNumber,
          0,
          lineNumber,
          lineText.length + 1
        ),
        lineNumber,
        firstNonWhitespaceCharacterIndex: nonWhiteSpaceIndex === -1 ? lineText.length : nonWhiteSpaceIndex
      };
    },
    offsetAt: (position) => {
      let index = 0;
      for (let lineNumber = 0; lineNumber < textSplitted.length; lineNumber++) {
        if (position.line === lineNumber) {
          index += textSplitted[lineNumber].length;
        } else {
          index += position.character;
        }
      }
      return index;
    },
    positionAt: (offset) => {
      for (let lineNumber = 0; lineNumber < textSplitted.length; lineNumber++) {
        if (offset > textSplitted[lineNumber].length + 1) {
          offset -= textSplitted[lineNumber].length + 1;
        } else {
          return new import_vscode6.Position(lineNumber, offset);
        }
      }
      return new import_vscode6.Position(textSplitted.length - 1, textSplitted[textSplitted.length - 1].length - 1);
    },
    getText: (range) => {
      if (!range) return text;
      throw "unsupported";
    },
    getWordRangeAtPosition: (position) => {
      return new import_vscode6.Range(position, position);
    },
    validatePosition: () => {
      throw "unsupported";
    },
    validateRange: () => {
      throw "unsupported";
    }
  };
};
(0, import_fs.readdirSync)((0, import_path.join)((0, import_process.cwd)(), "../../tests"), { recursive: true, encoding: "utf-8" }).filter((fileName) => fileName.endsWith(".si")).forEach((fileName) => {
  const path = (0, import_path.join)((0, import_process.cwd)(), "../../tests", fileName);
  const fileLines = (0, import_fs.readFileSync)(path, { encoding: "utf-8" }).split("\n").map((line) => line.replaceAll("\r", ""));
  const diagnosticLines = fileLines.filter((line) => line.startsWith("//#"));
  const codeLines = fileLines.filter((line) => !line.startsWith("//#"));
  const codeText = codeLines.join("\n");
  suite(fileName, () => {
    if (diagnosticLines.length === 0) {
      test("Should have no diagnostics", () => {
        const document = generateMockDocument(path, codeText, codeLines);
        log.clear();
        tokensData.length = 0;
        getRecoveryIssues().length = 0;
        let [parseResult, diags] = performParsing(document);
        diags = deduplicateDiagnostics(diags);
        if (parseResult) {
          checkVariableExistence(
            document,
            parseResult,
            [
              baseEnvironment,
              {
                type: "scope",
                switchTypes: /* @__PURE__ */ new Map(),
                functions: [],
                operators: [],
                types: /* @__PURE__ */ new Map(),
                variables: /* @__PURE__ */ new Map()
              }
            ],
            diags
          );
        }
        diags.forEach((diag) => console.error("Leftover: " + JSON.stringify(diag)));
        (0, import_assert.default)(diags.length === 0, "There should have been no diagnostics");
      });
    } else {
      test(`Should have correct diagnostics (${diagnosticLines.length})`, () => {
        const diagnostics2 = diagnosticLines.map((line) => (0, import_parser_combinators8.ParseText)(line, diagnosticParser));
        const document = generateMockDocument(path, codeText, codeLines);
        log.clear();
        tokensData.length = 0;
        getRecoveryIssues().length = 0;
        let [parseResult, diags] = performParsing(document);
        diags = deduplicateDiagnostics(diags);
        if (parseResult) {
          checkVariableExistence(
            document,
            parseResult,
            [
              baseEnvironment,
              {
                type: "scope",
                switchTypes: /* @__PURE__ */ new Map(),
                functions: [],
                operators: [],
                types: /* @__PURE__ */ new Map(),
                variables: /* @__PURE__ */ new Map()
              }
            ],
            diags
          );
        }
        let error = false;
        diagnostics2.forEach((expected) => {
          const foundDiagnosticIndex = diags.findIndex((provided) => {
            return provided.message.trim() === expected.message.trim() && provided.severity === expected.severity && provided.range.start.line === expected.start.line && provided.range.start.character === expected.start.character && provided.range.end.line === expected.end.line && provided.range.end.character === expected.end.character;
          });
          if (foundDiagnosticIndex < 0) {
            console.error("Expected: " + JSON.stringify(expected));
            error = true;
          } else {
            diags = diags.filter((_, i) => i !== foundDiagnosticIndex);
          }
        });
        diags.forEach((diag) => console.error("Leftover: " + JSON.stringify(diag)));
        (0, import_assert.default)(!error && diags.length === 0, `The diagnostics should all be specified`);
      });
    }
  });
});
//# sourceMappingURL=test.js.map
