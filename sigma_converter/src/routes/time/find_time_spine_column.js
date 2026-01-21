/**
 * finds the time_spine column that matches the given granularity
 * @param {Map} timeSpineGranularityMap - Map created in step 2.5 with granularity as key
 * @param {string} granularity - the time granularity to match (e.g., 'day', 'month', 'quarter')
 * @returns {Object|null} - Object with column name, time_spine info, and model, or null if not found
 */
function findTimeSpineColumn(timeSpineGranularityMap, granularity) {

  try {
    // Search the map for the granularity
    const timeSpineData = timeSpineGranularityMap.get(granularity);
    
    if (!timeSpineData) {
      console.warn(`No time_spine found matching granularity: ${granularity}`);
      return null;
    }

    const { standardGranularityColumn, model } = timeSpineData;
    
    if (!model) {
      console.warn(`Time spine model not found for granularity: ${granularity}`);
      return null;
    }

    return {
      columnName: standardGranularityColumn,
      timeSpineName: model.name || 'time_spine',
      granularity: granularity,
      model: model
    };

  } catch (error) {
    console.error(`Error finding time spine column: ${error.message}`);
    return null;
  }

}

module.exports = {
  findTimeSpineColumn
};

