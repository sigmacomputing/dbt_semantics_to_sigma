const { parseDimensionReference, DIMENSION_REF_PATTERN } = require('../metrics/dimension_parser');

/**
 * convert dbt filter expression to Sigma filter syntax
 * @param {string} filterStr - filter string from dbt
 * @param {string} modelName - current semantic model name
 * @returns {string} Sigma filter expression
 */
function convertFilterToSigma(filterStr, modelName) {
  //normalize whitespace and remove Jinja template syntax
  let converted = filterStr
    .replace(/\{\{|\}\}/g, '') // remove Jinja syntax
    .replace(/\s+/g, ' ') // normalize whitespace
    .trim();
  
  // replace Dimension('modelname__dimensionname') with [dimensionname]
  // this handles the following operators: =, !=, <=, >=, <, >, in, not in
  // examples:
  // {{ Dimension('order__is_food_order') }} = True -> [food_order] = True
  // {{ Dimension('order__is_food_order') }} = 1 -> [food_order] = 1
  // {{ Dimension('order__is_food_order') }} = 'abc' -> [food_order] = 'abc'
  // {{ Dimension('order__amount') }} <= 100 -> [amount] <= 100
  // {{ Dimension('order__amount') }} >= 50 -> [amount] >= 50
  // {{ Dimension('order__status') }} != 'cancelled' -> [status] != 'cancelled'
  converted = converted.replace(DIMENSION_REF_PATTERN, (match, dimRef) => {
    const { dimensionName } = parseDimensionReference(dimRef);
    return `[${dimensionName}]`;
  });
  
  // convert "in" conditions to arraycontains
  // pattern: [dimension] in ('value1','value2',...) or [dimension] in ("value1","value2",...)
  converted = converted.replace(/\[([^\]]+)\]\s+in\s+\(([^)]+)\)/gi, (match, dimension, values) => {
    // Take the entire values string and put it directly in array()
    return `arraycontains(array(${values}),[${dimension}])`;
  });
  
  // convert "not in" conditions
  converted = converted.replace(/\[([^\]]+)\]\s+not\s+in\s+\(([^)]+)\)/gi, (match, dimension, values) => {
    // Take the entire values string and put it directly in array()
    return `not(arraycontains(array(${values}),[${dimension}]))`;
  });
  
  // convert "is not null" conditions
  // pattern: [dimension] is not null
  converted = converted.replace(/\[([^\]]+)\]\s+is\s+not\s+null/gi, (match, dimension) => {
    return `isnotnull([${dimension}])`;
  });
  
  // convert "is null" conditions
  // pattern: [dimension] is null
  converted = converted.replace(/\[([^\]]+)\]\s+is\s+null/gi, (match, dimension) => {
    return `isnull([${dimension}])`;
  });
  
  // convert "not ilike" conditions
  // pattern: [dimension] not ilike 'pattern' or [dimension] not ilike "pattern"
  converted = converted.replace(/\[([^\]]+)\]\s+not\s+ilike\s+(['"])([^'"]*)\2/gi, (match, dimension, quote, pattern) => {
    return `not(ilike([${dimension}],${quote}${pattern}${quote}))`;
  });
  
  // convert "ilike" conditions
  // pattern: [dimension] ilike 'pattern' or [dimension] ilike "pattern"
  converted = converted.replace(/\[([^\]]+)\]\s+ilike\s+(['"])([^'"]*)\2/gi, (match, dimension, quote, pattern) => {
    return `ilike([${dimension}],${quote}${pattern}${quote})`;
  });
  
  return converted;
}

module.exports = {
  convertFilterToSigma
};

