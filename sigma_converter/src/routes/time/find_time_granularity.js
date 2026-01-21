/**
 * finds the time_granularity for a given dimension name in a semantic model
 * @param {Object} semanticModel - the semantic model object
 * @param {string} dimensionName - name of the dimension
 * @returns {string|null} - the time_granularity value or null if not found
 */
function findTimeGranularity(semanticModel, dimensionName) {
  if (!semanticModel.dimensions) {
    return null;
  }

  const dimension = semanticModel.dimensions.find(dim => dim.name === dimensionName);
  if (!dimension || dimension.type !== 'time') {
    return null;
  }

  return dimension.type_params?.time_granularity || null;
}

module.exports = {
  findTimeGranularity
};

