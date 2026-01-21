const { buildSigmaMeasureFormula } = require('./formula/build_sigma_formula');


/**
 * parse expression to extract each part of the expression
 * @param {string} expr - expression string (e.g., "revenue - cost")
 * @returns {Array<string>} array of parts of the expression
 */
function parseExprParts(expr) {
  if (!expr || typeof expr !== 'string') {
    return [];
  }

  // extract parts: sequences of word characters (letters, digits, underscores) that are not part of operators or numbers
  // - not starting with a digit
  // - not part of a number (no digits before a decimal point)
  // - not operators (+, -, *, /, etc.)
  const partPattern = /\b[a-zA-Z_][a-zA-Z0-9_]*\b/g;
  const parts = expr.match(partPattern) || [];
  
  // remove duplicates and return
  return [...new Set(parts)];
}


/**
 * find metric used in the expression in type_params.metrics by name or alias
 * @param {Array} typeParamMetrics - array of metrics in type_params.metrics
 * @param {string} exprPart - part of the expression to match
 * @returns {Object|null} matching metric in type_params.metrics or null
 */
function findMetricInTypeParams(typeParamMetrics, exprPart) {
  if (!typeParamMetrics || !Array.isArray(typeParamMetrics)) {
    return null;
  }

  // try to use alias first
  // this is to handle cases where the same metric is referenced by different aliases
  for (const metricRef of typeParamMetrics) {
    if (metricRef.alias === exprPart) {
      return metricRef;
    }
  }

  // if no alias match, try to match by name
  for (const metricRef of typeParamMetrics) {
    if (metricRef.name === exprPart) {
      return metricRef;
    }
  }

  return null;
}



/**
 * convert metric expression by replacing each part of the expression with the corresponding Sigma formula
 * @param {string} expr - expression string (e.g., "revenue - cost")
 * @param {Array} typeParamMetrics - array of metrics in type_params
 * @param {Object} semanticModel - semantic model object
 * @param {Array} allMetrics - array of all metrics from source data (for resolving metric references)
 * @param {Object} convertedMetrics - map of already converted metrics (name -> formula)
 * @returns {string|null} converted formula or null if conversion fails
 */
function convertExpression(expr, typeParamMetrics, semanticModel, allMetrics = [], convertedMetrics = {}) {

  if (!expr || typeof expr !== 'string') {
    return null;
  }

  // parse identifiers from expr
  const parts = parseExprParts(expr);
  
  if (parts.length === 0) {
    return null;
  }

  // build mapping of part to formula
  const formulas = {};
  
  for (const part of parts) {
    // find metric in type_params that matches this part
    const typeParamMetric = findMetricInTypeParams(typeParamMetrics, part);
    
    if (!typeParamMetric) {
      // part not found in type_params - this might be an error
      console.warn(`Warning: Part '${part}' in expr '${expr}' not found in type_params.metrics`);
      return null;
    }

    // build formula for this metric reference
    // Note: convertMetricToSigma is passed to handle circular dependency
    const formula = buildSigmaMeasureFormula(typeParamMetric, semanticModel, allMetrics, convertedMetrics, convertMetricToSigma);
    
    if (!formula) {
      // measure/metric not found in semantic model or source data
      console.warn(`Warning: Measure/metric '${typeof typeParamMetric === 'string' ? typeParamMetric : typeParamMetric.name}' not found in semantic model measures or metrics`);
      return null;
    }

    formulas[part] = formula;
  }

  let convertedExpr = expr;
  for (const part of parts) {
    const formula = formulas[part];
    // replace each part with its corresponding formula, using word boundaries to avoid partial matches
    const regex = new RegExp(`\\b${part}\\b`, 'g');
    convertedExpr = convertedExpr.replace(regex, formula);
  }

  return convertedExpr;

}


/**
 * convert dbt metric to Sigma metric format
 * @param {Object} metric - dbt metric object
 * @param {Object} semanticModel - current semantic model object
 * @param {Array} allMetrics - array of all metrics from source data (for resolving metric references)
 * @param {Object} convertedMetrics - map of already converted metrics (name -> formula)
 * @returns {Object} Sigma metric object
 */
function convertMetricToSigma(metric, semanticModel, allMetrics = [], convertedMetrics = {}) {

  // description is an optional field in dbt metrics
  const sigmaMetric = {
    id: `${metric.name}`,
    name: metric.name,
    description: metric.description || metric.label || metric.name
  };

  // handle simple metrics (type: simple)
  if (metric.type === 'simple' && metric.type_params?.measure) {

    // create a synthetic expression and typeParamMetrics to reuse convertExpression
    const measureName = metric.type_params.measure;
    const expr = measureName; // Expression is just the measure name
    const typeParamMetrics = [{
      name: measureName,
      ...(metric.filter && { filter: metric.filter })
    }];
    
    // use convertExpression which will call buildSigmaMeasureFormula internally
    sigmaMetric.formula = convertExpression(expr, typeParamMetrics, semanticModel, allMetrics, convertedMetrics);
    
    // copy formula object from measure name to metric name in convertedMetrics
    // this is needed because buildSigmaMeasureFormula stores the formula object under the measure name,
    // but we need it under the metric name for filter combination
    if (convertedMetrics[measureName] && convertedMetrics[measureName].aggFunc !== undefined) {
      convertedMetrics[metric.name] = convertedMetrics[measureName];
    }

  }

  // handle derived metrics
  if (metric.type === 'derived' && metric.type_params) {
    const { expr, metrics: typeParamMetrics } = metric.type_params;

    if (expr && typeParamMetrics && Array.isArray(typeParamMetrics) && typeParamMetrics.length > 0) {
      // parse expr and convert to Sigma formula
      sigmaMetric.formula = convertExpression(expr, typeParamMetrics, semanticModel, allMetrics, convertedMetrics);
    }
  }

  // handle ratio metrics (type: ratio)
  if (metric.type === 'ratio' && metric.type_params) {
    const { numerator, denominator } = metric.type_params;

    if (numerator && denominator) {
      // numerator & denominator can be simply the names of the metrics or objects with a name, filter, alias property
      // buildSigmaMeasureFormula handles both strings and objects
      const numeratorFormula = buildSigmaMeasureFormula(numerator, semanticModel, allMetrics, convertedMetrics, convertMetricToSigma);
      const denominatorFormula = buildSigmaMeasureFormula(denominator, semanticModel, allMetrics, convertedMetrics, convertMetricToSigma);

      if (numeratorFormula && denominatorFormula) {
        // create ratio formula: numerator / denominator
        sigmaMetric.formula = `(${numeratorFormula}) / (${denominatorFormula})`;
      } else {
        // extract names for error message
        const numeratorName = typeof numerator === 'string' ? numerator : numerator.name;
        const denominatorName = typeof denominator === 'string' ? denominator : denominator.name;
        console.warn(`Warning: Could not build formula for ratio metric '${metric.name}'. Numerator: ${numeratorName}, Denominator: ${denominatorName}`);
      }
    }
  }

  // store the converted formula and structured data in the map
  if (sigmaMetric.formula) {
    // for simple metrics, formula object is already stored by buildSigmaMeasureFormula (line 205 or 350)
    // for derived metrics with filters, formula object is stored by buildSigmaMeasureFormula (line 245-252)
    // for derived metrics without filters or with complex expressions, store just the formula as fallback
    // for ratio metrics, store just the formula as fallback
    if (!convertedMetrics[metric.name]) {
      convertedMetrics[metric.name] = { formula: sigmaMetric.formula };
    }
    // if formula object already exists (from buildSigmaMeasureFormula), it's already stored correctly
  }

  return sigmaMetric;
}

module.exports = {
  convertMetricToSigma
};

