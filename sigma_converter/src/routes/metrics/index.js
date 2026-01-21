/**
 * Metrics module - handles conversion and analysis of dbt metrics to Sigma format
 */

const { canAddMetricToModel } = require('./metric_analyzer');
const { convertMetricToSigma } = require('./metric_converter');
const { convertFilterToSigma } = require('../filter/filter_converter');
const { parseDimensionReference, extractDimensionReferences } = require('./dimension_parser');
const { buildMeasureFormula } = require('./formula/build_formula_object');

module.exports = {
  canAddMetricToModel,
  convertMetricToSigma,
  convertFilterToSigma,
  buildMeasureFormula,
  parseDimensionReference,
  extractDimensionReferences
};

