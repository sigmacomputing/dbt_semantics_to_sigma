/**
 * parses function arguments from a string, handling nested functions and strings
 * concat(col1, 'hello,world', concat(col2,col3)) -> [col1, 'hello,world', concat(col2,col3)]
 * @param {string} argsStr - string containing the arguments (without outer parentheses)
 * @returns {string[]} array of parsed argument strings
 */
function parseFunctionArguments(argsStr) {

  // array to store the parsed arguments
  const args = [];
  // current argument being processed
  let currentArg = '';
  // flag to indicate if we are inside a quoted string
  let inString = false;
  // the quote character
  let stringChar = null;
  // depth of nested parentheses
  let parenDepth = 0;
  
  // character by character pasrsing
  for (let i = 0; i < argsStr.length; i++) {

    // get the current character
    const char = argsStr[i];
    
    // if we are not already inside a quoted string and the current character is a quote, set the inString flag to true and store the quote character
    if (!inString && (char === '"' || char === "'")) {
      inString = true;
      stringChar = char;
      currentArg += char;
    } 
    // if we are inside a quoted string and the current character is the same as the quote character, set the inString flag to false and clear the quote character
    else if (inString && char === stringChar) {
      inString = false;
      stringChar = null;
      currentArg += char;
    } 
    // if we are not inside a quoted string and the current character is an opening parenthesis, increment the depth and add the character to the current argument
    else if (!inString && char === '(') {
      parenDepth++;
      currentArg += char;
    } 
    // if we are not inside a quoted string and the current character is a closing parenthesis, decrement the depth and add the character to the current argument
    else if (!inString && char === ')') {
      parenDepth--;
      currentArg += char;
    } 
    // if we are not inside a quoted string and the depth is 0, this comma separates arguments
    // save the current argument and reset currentArg
    else if (!inString && parenDepth === 0 && char === ',') {
      args.push(currentArg.trim());
      currentArg = '';
    } 
    // add the character to the current argument
    else {
      currentArg += char;
    }
  }
  // if there is any remaining argument, add it to the arguments array
  if (currentArg.trim()) {
    args.push(currentArg.trim());
  }
  
  return args;
}

module.exports = {
  parseFunctionArguments
};

