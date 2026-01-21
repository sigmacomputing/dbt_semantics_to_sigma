const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });

const { convertToUserFriendlyName } = require('../dimensions/utils/convertToUserFriendlyName');

// Shared regex pattern for matching Dimension('dimension_ref') in filter strings
const DIMENSION_REF_PATTERN = /Dimension\(['"]([^'"]+)['"]\)/g;

/**
 * Find all dimension references in a string
 * @param {string} str - string to search for dimension references
 * @returns {Array<string>} array of dimension reference strings (e.g., 'modelname__dimensionname')
 */
function findDimensionReferences(str) {
  const matches = str.match(DIMENSION_REF_PATTERN);
  if (!matches) {
    return [];
  }
  return matches.map(m => m.match(/['"]([^'"]+)['"]/)[1]);
}

/**
 * parse dimension reference string (format: modelname__dimensionname)
 * @param {string} dimRef - dimension reference string
 * @returns {Object} object with modelName and dimensionName
 */
function parseDimensionReference(dimRef) {

  const parts = dimRef.split('__');

  userFriendlyColumnNameFlag = process.env.USER_FRIENDLY_COLUMN_NAMES;

  if (parts.length >= 2) {

    // if process.env.USER_FRIENDLY_COLUMN_NAMES is true, convert the dimension name to a user friendly name
    userFriendlyDimensionName = userFriendlyColumnNameFlag === 'true' 
    ? convertToUserFriendlyName(parts[1]) 
    : parts[1];

    return {
      modelName: parts[0],
      dimensionName: userFriendlyDimensionName
    };

  }

  // if no __ separator, assume it's just a dimension name in current model

  userFriendlyDimensionName = userFriendlyColumnNameFlag === 'true' 
  ? convertToUserFriendlyName(dimRef) 
  : dimRef;

  return {
    modelName: null,
    dimensionName: userFriendlyDimensionName
  };

}

/**
 * each metric has a type_params property that contains an array of input metrics
 * each input metric may have a filter property that contains a dimension reference
 * extract all dimension references from the filter property of each input metric
 * the format is {{ Dimension('modelname__dimensionname') }} in ('value1','value2',...)
 * @param {Object} metric - metric object
 * @returns {Array<string>} array of dimension reference strings
 */
function extractDimensionReferences(metric) {
  const refs = [];
  
  // check filters within metric references
  if (metric.type_params?.metrics) {
    for (const refMetric of metric.type_params.metrics) {
      if (refMetric.filter) {
        const filterStr = typeof refMetric.filter === 'string' 
          ? refMetric.filter 
          : JSON.stringify(refMetric.filter);
        const dimRefs = findDimensionReferences(filterStr);
        if (dimRefs.length > 0) {
          refs.push(...dimRefs);
        }
      }
    }
  }
  
  return refs;

}

module.exports = {
  DIMENSION_REF_PATTERN,
  findDimensionReferences,
  parseDimensionReference,
  extractDimensionReferences
};

