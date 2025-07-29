# Change Log

## [0.6.19]
- Changed `rol`, `ror` and `asr_64` to be functions instead of binary operators

## [0.6.18]
- Fixed matching of generic types between the function and it's assumptions

## [0.6.17]
- Enabled parsing of the top level statements just like statements inside a function

## [0.6.16]
- Fixed issue with renaming function sometimes removing function arguments

## [0.6.15]
- Fixed issue with nested blocks not checking for returns, breaks and infinite loops

## [0.6.14]
- Added support for multiple arguments for `_reg_alloc_use`

## [0.6.13]
- Added a warning when casting enums to signed integers

## [0.6.12]
- Made the function calls check the defined assumptions

## [0.6.11]
- Added infinite while loop checks for conditions without variable modifications in loop body

## [0.6.10]
- Added simple infinite while loop checks
- Added warning about casting between different-sized integer arrays

## [0.6.9]
- Improved inlay hints behavior when switching between files

## [0.6.8]
- Fixed parsing of standalone function calls

## [0.6.7]
- Fixed parsing of variable modification statements

## [0.6.6]
- Added support for checking simple expressions in switch cases for duplicated cases
- Added hints and code actions for simplifying simple expressions

## [0.6.5]
- Added basic support for r-values in switch cases

## [0.6.4]
- Improved parsing performance

## [0.6.3]
- Allowed defining assumptions for function existence

## [0.6.2]
- Fixed descriptions when hovering over types
- Fixed hover description for `_default` built-in function

## [0.6.1]
- Fixed issues with parsing negative number literals

## [0.6.0]
- Added support for `break` and `continue` keywords

## [0.5.15]
- Added `get_ssd_size` built-in method support

## [0.5.14]
- Fixed binary operator support in some edge cases

## [0.5.13]
- Added support for 2-character unary operators and 3-character binary operators
- Added support for assigning different integer types

## [0.5.12]
- Added `get_assembler_little_endian` built-in method support
- Added status bar information item about parsing (whether it parsed correctly and time taken)
- Made the hover information more succinct
- Made the language extension hold some type information from previous parse when the new one fails
- Added support for all single-character unary operators
- Added dot method code completions for numeric and string literals, function calls and variables

## [0.5.11]
- Added a setting to show inlay type hints for declarations (defaults to `true`)

## [0.5.10]
- The extension will now try to provide a guess for def and dot functions, for types and variables.

## [0.5.9]
- Full support for typechecking the `_default` method
- Added basic call_conv block support
- Added basic extern support
- Added `_default`, `asm`, `x86_64`, `aarch64` and `windows_x64` to keywords
- Added support for inline assigning of values to casted and indexed arrays

## [0.5.8]

- Added `_default` method - currently not working fully as it doesn't have support for referencing types
- Added support for underscores in base-10 integers
- Added support for comments in enum declarations

## [0.5.7]

- Added `clz` and `ctz` functions definitions

## [0.5.6]

- Enum definitions now accept newlines

## [0.5.5]

- Added basic asm block support

## [0.5.4]

- Added push, pop and memory_copy methods
- Added support for multiple function calls in series in an expression

## [0.5.3]

- Added SSD and Dual-Load RAM special functions

## [0.5.2]

- Made variables accept uppercase letters if it's not the first letter
- Added checks for casting and assigning constants that will not fit

## [0.5.1]

- Fixed invalid-typed built-in methods
- Added some other methods and types (File, Char, etc.)
- Added === operator
- Added support for underscores in hex literals

## [0.5.0]

- Added switch cases type checking
- Added switch cases exhaustiveness checking for enum values

## [0.4.5]

- Fixed Bool type to be false/true

## [0.4.4]

- Added support for enum type declarations
- Added missing operators for TestResult and String
- Added deduplication of diagnostic messages

## [0.4.3]

- Better handling of liquid numeric constants
- Named the source of the diagnostic errors and warnings
- Added operators for various integer types
- Added `_size` built-in function
- Improved cross-integer-type matching mechanics
- The extension now remembers diagnostics for previously-opened files

## [0.4.2]

- Fixed parsing order for operators-between-ternaries scenario
- Fixed false positives when parsing inline r-values

## [0.4.1]

- Added a few missing operations to integers and arrays
- Fixed generic type inference for functions and operations
- Probable fix to missing type-checking setting

## [0.4.0]

- Added type-checking on most things (toggleable by an option, on by default)
- Missing type-checking for switch cases
- Added basic generic engine

## [0.3.4]

- Functions declared below the current functions are still regarded as in-scope
- `var` and `let` variables defined outside the current function have to be accessed with `.` in front of them
- Added an option to check for explicit returns in functions with return type

## [0.3.3]

- Fixed variable modifications being parsed sooner than they should
- Added check for dot method having no parameters

## [0.3.2]

- Allowed all r-values to be used as separate statements to allow chaining function calls and casts in one statement

## [0.3.1]

- Added advanced parsing
- Added full definition scope checking
- Added full go-to-definition and renaming support
- Added most of built-in functions and constants

## [0.3.0]

- Added basic parsing
- Added basic semantic error checking

## [0.2.4]

- Added base parser for the full language (currently off)
- Changed language's display name as we now know the language is named `Simplex`

## [0.2.3]

- Function parameters are properly resolved between functions, and even if they contains a dollar sign
- Dot and Def functions named the same are resolved separately

## [0.2.2]

- Added support for "Go to Declaration" and "Rename" for type aliases

## [0.2.1]

- Added support for "Go to Declaration" for functions and parameters
- Fixed broken images on plugin page

## [0.2.0]

- Added generic types highlighting
- Added support for renaming functions and parameters

## [0.1.1]

- Added type keyword highlighting

## [0.1.0]

- Fixed comments and added pub keyword highlighting

## [0.0.1]

- Initial release of the extension