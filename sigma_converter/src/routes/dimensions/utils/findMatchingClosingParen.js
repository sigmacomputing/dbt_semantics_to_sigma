/**
 * finds the matching closing parenthesis for a given opening parenthesis
 * The function needs to extract the arguments inside CONCAT(...). 
 * with nested calls like concat(col1, concat(col2, col3), col4), a simple search for the first ) would stop too early. The depth counter ensures it finds the correct closing ).
 * @param {string} expr - expression string
 * @param {number} startPos - position after the opening parenthesis
 * @returns {number} position of the matching closing parenthesis, or -1 if not found
 */
function findMatchingClosingParen(expr, startPos) {

  // initialize depth to track nested parentheses
  let depth = 0;

  // initialize end position to start position
  let endPos = startPos;

  // loop through the expression starting from the start position
  for (let i = startPos; i < expr.length; i++) {

    // if the current character is an opening parenthesis, increment the depth
    if (expr[i] === '(') depth++;
    // if the current character is a closing parenthesis
    else if (expr[i] === ')') {
      // if the depth is 0, we have found the matching closing parenthesis, set the end position to the current position and return it
      // otherwise, decrement the depth
      if (depth === 0) {
        endPos = i;
        return endPos;
      }
      depth--;
    }
  }
  return -1; // no matching closing parenthesis found
}

module.exports = {
  findMatchingClosingParen
};

