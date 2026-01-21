const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });

const { convertToUserFriendlyName } = require('../utils/convertToUserFriendlyName');
const { convertColumnReferences } = require('../utils/convertColumnReferences');
const { convertCase } = require('../utils/convertCase');
const { convertConcat } = require('../utils/convertConcat');
const { convertSplitPart } = require('../utils/convertSplitPart');

// check if user-friendly column names are enabled (converts underscores to spaces)
// example: my_column → my column when flag is true
const userFriendlyColumnNameFlag = process.env.USER_FRIENDLY_COLUMN_NAMES;

/**
 * converts SQL expression to Sigma formula syntax
 * @param {string} expr - SQL expression
 * @returns {string} Sigma formula
 */
function convertExpressionToSigma(expr) {
  if (!expr || typeof expr !== 'string') {
    return null;
  }

  let converted = expr.trim();
  
  // Normalize whitespace and handle multiline
  converted = converted.replace(/\s+/g, ' ').trim();
  
  let changed = true;
  let iterations = 0;
  const maxIterations = 10; // Prevent infinite loops
  
  // Apply conversions iteratively until no more changes
  while (changed && iterations < maxIterations) {
    changed = false;
    iterations++;
    
    const before = converted;
    
    // Convert CASE first because it may contain other functions
    const caseResult = convertCase(converted, convertExpressionToSigma);
    if (caseResult && caseResult !== converted) {
      converted = caseResult;
      changed = true;
      continue;
    }
    
    // Convert CONCAT (may appear inside CASE results or standalone)
    const concatResult = convertConcat(converted, convertExpressionToSigma);
    if (concatResult && concatResult !== converted) {
      converted = concatResult;
      changed = true;
      continue;
    }
    
    // Convert SPLIT_PART (may appear inside CASE, CONCAT, or standalone)
    const splitPartResult = convertSplitPart(converted, convertExpressionToSigma);
    if (splitPartResult && splitPartResult !== converted) {
      converted = splitPartResult;
      changed = true;
      continue;
    }
    
    // If no function conversions happened, break
    if (before === converted) {
      break;
    }
  }
  
  // Convert any remaining column references
  converted = convertColumnReferences(converted);
  
  return converted;
}

/**
 * builds the formula for a dimension column
 * @param {Object|string} dimension - the dimension object or expression string
 * @param {string} semanticModelName - the name of the semantic model
 * @param {string} userFriendlyDimensionName - the user-friendly name of the dimension (optional if dimension is a string)
 * @returns {string} the formula for the dimension
 */
function buildDimensionFormula(dimension, semanticModelName, userFriendlyDimensionName) {

  if (dimension.expr && dimension.expr !== dimension.name) {
    return convertExpressionToSigma(dimension.expr);
  }
  
  // if dimension type is time, use date_trunc with granularity
  if (dimension.type === 'time' && dimension.type_params?.time_granularity) {
    const granularity = dimension.type_params.time_granularity;
    return `DateTrunc('${granularity}', [${semanticModelName}/${userFriendlyDimensionName}])`;
  }
  
  // default formula format
  return `[${semanticModelName}/${userFriendlyDimensionName}]`;
}

/**
 * builds a Sigma column formula for an entity's expression
 * @param {Object} entity - the entity object
 * @param {string} semanticModelName - the name of the semantic model
 * @returns {string} the formula for the entity's expression
 */
function buildEntityExpressionFormula(entity, semanticModelName) {

  if (entity.expr) {
    return convertExpressionToSigma(entity.expr);
  }

  if (!entity.expr) {

    const userFriendlyName = userFriendlyColumnNameFlag === 'true' 
    ? convertToUserFriendlyName(entity.name) 
    : entity.name;
    
    return `[${semanticModelName}/${userFriendlyName}]`;

  }

  return `[${semanticModelName}/${entity.name}]`;
}

module.exports = {
  convertExpressionToSigma,
  buildDimensionFormula,
  buildEntityExpressionFormula
};

