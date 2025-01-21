# Change Log

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