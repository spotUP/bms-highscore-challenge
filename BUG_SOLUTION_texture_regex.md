# SOLUTION FOUND - Texture Regex Corrupting Function Signatures

## The Bug

One of the texture function regex replacements in `fixWebGLIncompatibilities()` is matching and corrupting function signatures that contain multiple comma-separated parameters.

## Evidence

Function has ALL parameters at START of method:
```
[fixWebGLIncompatibilities] AT START OF METHOD: float HHLP_GetMaskCenteredOnValue(float in_value, float value_to_match, float threshold)
```

But LOSES parameters before reaching `convertStorageQualifiers()`:
```
[convertStorageQualifiers] Processing HHLP line: float HHLP_GetMaskCenteredOnValue(float in_value)
```

## The Culprit

The texture replacement regexes (lines 3633-3654) use patterns like:
```javascript
fixed = fixed.replace(/\btexture\s*\(([^,]+),\s*([^,]+),\s*[^)]+\)/g, 'texture2D($1, $2)');
```

This pattern matches:
- Word boundary + "texture"
- Opening paren
- First param (anything except comma)
- Comma
- Second param (anything except comma)
- Comma
- Third param (anything up to closing paren)

**Problem**: This could match function signatures if they happen to have "texture" followed by parentheses and commas!

## The Fix

Add **function signature protection** to prevent these regexes from matching function declarations.

### Option 1: Use Negative Lookbehind

```javascript
// Only match texture( that's NOT preceded by a function declaration pattern
fixed = fixed.replace(/(?<!float|vec[234]|void|mat[234]|int|uint)\s+\btexture\s*\(([^,]+),\s*([^,]+),\s*[^)]+\)/g, 'texture2D($1, $2)');
```

### Option 2: Skip Lines with Function Declarations (RECOMMENDED)

Process line-by-line and skip function declaration lines:

```javascript
// Process line by line to avoid corrupting function signatures
const lines = fixed.split('\n');
const processedLines = lines.map(line => {
  // Skip function declaration lines
  if (line.trim().match(/^(void|vec[234]|float|bool|mat[234]|int|uint)\s+\w+\s*\(/)) {
    return line;
  }

  // Apply texture replacements only to non-function lines
  let processed = line;
  processed = processed.replace(/\btexture\s*\(([^,]+),\s*([^,]+),\s*[^)]+\)/g, 'texture2D($1, $2)');
  processed = processed.replace(/\btexture\s*\(/g, 'texture2D(');
  // ... other texture replacements

  return processed;
});
fixed = processedLines.join('\n');
```

### Option 3: More Specific Pattern (SIMPLEST)

Ensure the regex doesn't match at line start (where function declarations are):

```javascript
// Use lookbehind to ensure we're not at the start of a line (where function declarations are)
fixed = fixed.replace(/(?<!^|\n)\btexture\s*\(([^,]+),\s*([^,]+),\s*[^)]+\)/gm, 'texture2D($1, $2)');
```

## Implementation

Replace lines 3633-3654 in `fixWebGLIncompatibilities()` with Option 2 (line-by-line processing) for safety.

## Test

After fix, verify:
```
[convertStorageQualifiers] Processing HHLP line: float HHLP_GetMaskCenteredOnValue(float in_value, float value_to_match, float threshold)
```

All 3 parameters should be present!
