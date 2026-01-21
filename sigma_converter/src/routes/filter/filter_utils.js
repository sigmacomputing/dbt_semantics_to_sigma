/**
 * combine two filters with and condition
 * @param {string} existingFilter - existing filter string
 * @param {string} newFilter - new filter string to add
 * @returns {string} combined filter string
 */
function combineFilters(existingFilter, newFilter) {
  if (!existingFilter) {
    return newFilter;
  }
  if (!newFilter) {
    return existingFilter;
  }
  return `(${existingFilter}) and ${newFilter}`;
}

/**
 * rebuild a filtered formula with a combined filter
 * @param {string} aggFunc - aggregation function name (e.g., "countdistinctif")
 * @param {string} measureExpr - measure expression (e.g., "mql_id") or null for countif
 * @param {string} combinedFilter - combined filter string
 * @returns {string} rebuilt formula string
 */
function rebuildFilteredFormula(aggFunc, measureExpr, combinedFilter) {
  // special case for countif - it doesn't have a measure expression
  if (aggFunc === 'countif') {
    return `${aggFunc}(${combinedFilter})`;
  }
  
  // for aggregations other than countif, format is aggFunc([expr],filter)
  return `${aggFunc}([${measureExpr}],${combinedFilter})`;
}

module.exports = {
  combineFilters,
  rebuildFilteredFormula
};

