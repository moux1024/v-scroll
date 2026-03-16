# Test Project - Functional Utility Library

A functional utility library following strict JavaScript coding style guidelines.

## Features

- **Data Fetching**: Simulated API calls with timeout and retry logic
- **Pure Data Processing**: No side effects, immutable operations
- **Error Handling**: Comprehensive error formatting and recovery strategies

## Coding Style

This project strictly follows these conventions:

- Functions defined as `const funcname = () => {}`
- Constants: UPPERCASE_WITH_UNDERSCORES
- Variables: lowercase_with_underscores
- Functions: camelCase (e.g., `getUserData`, `processData`)
- Multiple `const` declarations merged into single line
- Import specific functions, not entire modules
- Use `await`, avoid `.then()`
- Pure functions only, no classes
- `export default` directly exports function/variable

## Structure

```
src/
├── index.js      # Main entry point
├── utils.js      # Utility functions
└── handlers.js   # Data handlers
```

## Usage

```javascript
import lib from './src/index.js'

const result = await lib.getData('/endpoint')
```
