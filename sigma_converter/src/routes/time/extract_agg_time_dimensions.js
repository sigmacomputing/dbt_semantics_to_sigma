/**
 * extracts all unique agg_time_dimension values from a semantic model
 * these will either be present under semantic_models::defaults or semantic_models::measures::agg_time_dimension
 * @param {Object} semanticModel - the semantic model object
 * @returns {Array<string>} - array of unique agg_time_dimension names
 */
function extractAggTimeDimensions(semanticModel) {
  const aggTimeDimensions = new Set();

  // default agg_time_dimension for semantic model
  if (semanticModel.defaults?.agg_time_dimension) {
    aggTimeDimensions.add(semanticModel.defaults.agg_time_dimension);
  }

  // agg_time_dimension for each measure in the semantic model
  if (semanticModel.measures) {
    semanticModel.measures.forEach(measure => {
      if (measure.agg_time_dimension) {
        aggTimeDimensions.add(measure.agg_time_dimension);
      }
    });
  }

  return Array.from(aggTimeDimensions);
}

module.exports = {
  extractAggTimeDimensions
};

