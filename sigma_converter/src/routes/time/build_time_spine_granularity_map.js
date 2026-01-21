const yaml = require('js-yaml');
const fs = require('fs');

/**
 * Creates a map from timeSpineFile containing for each model under models:
 *   - standard_granularity_column
 *   - the granularity of the standard_granularity_column
 *   - the entire model
 *   granularity should be the key for the map
 * @param {string} timeSpineFile - Path to the time spine file (_models.yml)
 * @returns {Map} - Map with granularity as key -> { standardGranularityColumn, model }
 */
function buildTimeSpineGranularityMap(timeSpineFile) {
  const timeSpineGranularityMap = new Map(); // granularity -> { standardGranularityColumn, model }
  
  try {
    if (fs.existsSync(timeSpineFile)) {
      const timeSpineData = yaml.load(fs.readFileSync(timeSpineFile, 'utf8'));
      
      if (timeSpineData.models) {
        timeSpineData.models.forEach(model => {
          const standardGranularityColumn = model.time_spine.standard_granularity_column;
          
          // find the granularity of the standard_granularity_column
          const standardColumn = model.columns?.find(col => col.name === standardGranularityColumn);
          if (standardColumn && standardColumn.granularity) {
            const granularity = standardColumn.granularity;
            
            // store in map with granularity as key
            timeSpineGranularityMap.set(granularity, {
              standardGranularityColumn: standardGranularityColumn,
              model: model
            });
          }
        });
      }
    } else {
      console.warn(`Time spine file not found at ${timeSpineFile}`);
    }
  } catch (error) {
    console.error(`Error reading time spine file: ${error.message}`);
  }
  
  return timeSpineGranularityMap;
}

module.exports = {
  buildTimeSpineGranularityMap
};

