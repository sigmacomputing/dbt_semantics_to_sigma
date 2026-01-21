/**
 * converts CASE statement to Sigma IF syntax
 * 
 * SQL CASE syntax: CASE WHEN condition1 THEN result1 WHEN condition2 THEN result2 ELSE default END
 * Sigma IF syntax: if(condition1, result1, condition2, result2, default)
 * 
 * examples:
 *   input:  CASE WHEN x = y THEN z ELSE w END
 *   output: if(x = y, z, w)
 * 
 *   input:  CASE WHEN a < b THEN c WHEN d > e THEN f ELSE g END
 *   output: if(a < b, c, d > e, f, g)
 * 
 *   input:  CASE WHEN col1 = 'value' THEN concat(col2, col3) ELSE 'default' END
 *   output: if([col1] = 'value', [col2] & [col3], 'default')
 * 
 * @param {string} expr - CASE expression (e.g., CASE WHEN x=y THEN z WHEN a<b THEN c ELSE d END)
 * @param {Function} convertExpressionToSigma - recursive function to convert nested expressions
 * @returns {string} Sigma formula (e.g., if(x=y,z,a<b,c,d))
 */
function convertCase(expr, convertExpressionToSigma) {
  // step 1: check if this expression contains a CASE statement
  // uses word boundary (\b) to avoid matching "case" inside other words like "showcase"
  // example: "CASE WHEN x=1 THEN y END" → matches, "showcase" → doesn't match
  const caseMatch = expr.match(/\bcase\b/i);
  if (!caseMatch) {
    return null; // not a CASE statement, return null to indicate no conversion needed
  }

  // step 2: normalize whitespace to handle multiline and inconsistent spacing
  // converts multiple spaces/tabs/newlines to single space and trims edges
  // example: "CASE\n  WHEN\n    x=1\n  THEN\n    y\n  END" → "CASE WHEN x=1 THEN y END"
  let normalized = expr.replace(/\s+/g, ' ').trim();
  
  // step 3: find the positions of CASE and END keywords
  // using toLowerCase() for case-insensitive matching
  // lastIndexOf('end') handles nested CASE statements (finds the outermost END)
  // example: "CASE WHEN x=1 THEN CASE WHEN y=2 THEN 3 END END" → finds outer END
  const caseIndex = normalized.toLowerCase().indexOf('case');
  const endIndex = normalized.toLowerCase().lastIndexOf('end');
  
  // step 4: validate that END keyword exists
  // if no END found, the CASE statement is malformed
  // example: "CASE WHEN x=1 THEN y" → returns null (missing END)
  if (endIndex === -1) {
    return null; 
  }

  // step 5: extract the body between CASE and END (contains WHEN/THEN/ELSE clauses)
  // caseIndex + 4 skips "CASE" (4 characters), endIndex is the start of "END"
  // example: "CASE WHEN x=1 THEN y END" → extracts "WHEN x=1 THEN y"
  const caseBody = normalized.substring(caseIndex + 4, endIndex).trim();
  
  // step 6: initialize arrays to collect parsed conditions and results
  // conditions: array of WHEN condition expressions (e.g., ["x = y", "a < b"])
  // results: array of THEN result expressions (e.g., ["z", "c"])
  // elseResult: the ELSE clause result (e.g., "d") or null if no ELSE
  const conditions = [];
  const results = [];
  let elseResult = null;
  
  // step 7: parse WHEN/THEN/ELSE clauses manually to handle nested functions
  // we use a lowercase version for keyword matching, but preserve original case for expressions
  let pos = 0; // current parsing position in the case body
  const body = caseBody.toLowerCase(); // lowercase version for keyword searching
  
  // step 8: loop through the case body to find all WHEN/THEN pairs
  // example: "WHEN x=1 THEN y WHEN a=2 THEN b ELSE c"
  //   - first iteration: finds WHEN x=1 THEN y
  //   - second iteration: finds WHEN a=2 THEN b
  //   - then finds ELSE c
  while (pos < body.length) {
    // step 8a: find the next WHEN keyword starting from current position
    // example: body = "when x=1 then y when a=2 then b", pos = 0
    //   → whenIndex = 0 (first "when")
    const whenIndex = body.indexOf('when', pos);
    if (whenIndex === -1) break; // no more WHEN clauses found, exit loop
    
    // step 8b: find the matching THEN keyword for this WHEN
    // this is complex because the condition between WHEN and THEN may contain:
    //   - nested parentheses: WHEN func(x, y) THEN z
    //   - string literals: WHEN col = 'value' THEN result
    //   - nested CASE statements: WHEN CASE ... END THEN result
    // we track depth (parentheses) and inString (quoted strings) to find the correct THEN
    let thenIndex = -1;
    let depth = 0;        // tracks nested parentheses depth
    let inString = false; // flag indicating we're inside a quoted string
    let stringChar = null; // the quote character (' or ") that opened the string
    
    // step 8c: scan forward from WHEN to find the matching THEN
    // example: "WHEN func(x, y) = 1 THEN z"
    //   - at 'f': depth=0, not in string → continue
    //   - at '(': depth=1, not in string → increment depth
    //   - at ')': depth=0, not in string → decrement depth
    //   - at 't': depth=0, check if "then" → found THEN
    for (let i = whenIndex + 4; i < body.length; i++) {
      const char = body[i];
      
      // handle string literals: track when we enter/exit quoted strings
      // example: "WHEN col = 'test value' THEN result"
      //   - at first ': inString = true, stringChar = '
      //   - inside string: continue accumulating
      //   - at second ': inString = false, stringChar = null
      if (!inString && (char === '"' || char === "'")) {
        inString = true;
        stringChar = char;
      } else if (inString && char === stringChar) {
        inString = false;
        stringChar = null;
      } 
      // handle parentheses: track nesting depth (only when not in a string)
      // example: "WHEN func(x, nested(y)) THEN z"
      //   - at first (: depth = 1
      //   - at second (: depth = 2
      //   - at first ): depth = 1
      //   - at second ): depth = 0
      else if (!inString) {
        if (char === '(') depth++;
        else if (char === ')') depth--;
        // when depth is 0 and we find "then", we've found the matching THEN
        // example: "WHEN x = 1 THEN y" → at 't', depth=0, substring="then" → found
        else if (depth === 0 && body.substring(i, i + 4) === 'then') {
          thenIndex = i;
          break;
        }
      }
    }
    
    // step 8d: validate that THEN was found
    // if no THEN found, the CASE statement is malformed
    // example: "WHEN x=1" → thenIndex = -1, break
    if (thenIndex === -1) break;
    
    // step 8e: extract the condition expression (between WHEN and THEN)
    // whenIndex + 4 skips "WHEN" (4 characters), thenIndex is the start of "THEN"
    // example: "WHEN x = 1 THEN y" → conditionStr = "x = 1"
    // then recursively convert it (handles nested functions, column references, etc.)
    // example: "WHEN concat(col1, col2) = 'test' THEN y"
    //   → conditionStr = "concat(col1, col2) = 'test'"
    //   → condition = "[col1] & [col2] = 'test'" (after recursive conversion)
    const conditionStr = caseBody.substring(whenIndex + 4, thenIndex).trim();
    const condition = convertExpressionToSigma(conditionStr);
    
    // step 8f: find the next boundary (WHEN, ELSE, or END) to determine where the result ends
    // the result is everything between THEN and the next boundary
    // example: "THEN y WHEN a=2 THEN b"
    //   → nextWhenIndex = position of second "when"
    //   → result = "y" (everything between "then" and next "when")
    let nextWhenIndex = body.indexOf('when', thenIndex + 4);
    let elseIndex = body.indexOf('else', thenIndex + 4);
    let caseEndIndex = body.indexOf('end', thenIndex + 4);
    
    // step 8g: determine the earliest boundary (next WHEN, ELSE, or END)
    // this tells us where the current THEN result ends
    // example: "THEN y WHEN a=2 THEN b ELSE c END"
    //   → nextWhenIndex = 10, elseIndex = 25, caseEndIndex = 30
    //   → nextBoundary = 10 (earliest is next WHEN)
    let nextBoundary = body.length; // default to end of string if no boundary found
    if (nextWhenIndex !== -1 && nextWhenIndex < nextBoundary) nextBoundary = nextWhenIndex;
    if (elseIndex !== -1 && elseIndex < nextBoundary) nextBoundary = elseIndex;
    if (caseEndIndex !== -1 && caseEndIndex < nextBoundary) nextBoundary = caseEndIndex;
    
    // step 8h: extract the result expression (between THEN and next boundary)
    // thenIndex + 4 skips "THEN" (4 characters), nextBoundary is the start of next clause
    // example: "THEN y WHEN a=2" → resultStr = "y"
    // then recursively convert it (handles nested functions, column references, etc.)
    // example: "THEN concat(col1, col2)" → result = "[col1] & [col2]"
    const resultStr = caseBody.substring(thenIndex + 4, nextBoundary).trim();
    const result = convertExpressionToSigma(resultStr);
    
    // step 8i: store the parsed condition and result
    // example: conditions = ["x = 1"], results = ["y"]
    conditions.push(condition);
    results.push(result);
    
    // step 8j: move parsing position to the next boundary for next iteration
    pos = nextBoundary;
    
    // step 8k: if we hit ELSE, extract it and break (ELSE is always the last clause)
    // example: "ELSE 'default' END" → elseStr = "'default'"
    // note: ELSE extends to the end of caseBody (END is outside caseBody, already extracted)
    if (elseIndex !== -1 && elseIndex === nextBoundary) {
      const elseStr = caseBody.substring(elseIndex + 4).trim();
      elseResult = convertExpressionToSigma(elseStr);
      break; // no more WHEN clauses after ELSE
    }
  }
  
  // step 9: validate that at least one WHEN clause was found
  // if no WHEN clauses, the CASE statement is malformed
  // example: "CASE ELSE x END" → conditions.length = 0, return null
  if (conditions.length === 0) {
    return null; // no WHEN clauses found
  }

  // step 10: build the Sigma IF formula
  // Sigma IF syntax: if(condition1, result1, condition2, result2, ..., else_result)
  // pairs each condition with its result, then appends else_result if present
  // example: conditions = ["x = 1", "a < 2"], results = ["y", "b"], elseResult = "c"
  //   → ifArgs = ["x = 1", "y", "a < 2", "b", "c"]
  //   → result = "if(x = 1, y, a < 2, b, c)"
  const ifArgs = [];
  for (let i = 0; i < conditions.length; i++) {
    ifArgs.push(conditions[i]); // add condition
    ifArgs.push(results[i]);    // add corresponding result
  }
  if (elseResult) {
    ifArgs.push(elseResult); // add ELSE result if present
  }
  
  const result = `if(${ifArgs.join(',')})`;
  
  // step 11: replace the original CASE statement in the normalized expression
  // preserves any text before CASE and after END
  // example: "col1 + CASE WHEN x=1 THEN y END + col2"
  //   → normalized.substring(0, caseIndex) = "col1 + "
  //   → result = "if(x=1, y)"
  //   → normalized.substring(endIndex + 3) = " + col2"
  //   → final = "col1 + if(x=1, y) + col2"
  return normalized.substring(0, caseIndex) + 
         result + 
         normalized.substring(endIndex + 3);
}

module.exports = {
  convertCase
};

