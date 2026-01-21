const SemanticModelAnalyzer = require('../../utils/dag_analyzer');
const TopologicalSorter = require('../../utils/topological_sorter');

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });

/**
 * main function to analyze semantic models and create topological sort
 * @param {string} modelsDirectoryPath - path to the directory containing semantic models
 * @param {Array<string>} [specificFiles] - optional array of specific file paths to analyze (for update mode)
 * @returns {Object} topological sort results
 */
function buildDAG(modelsDirectoryPath, specificFiles = null) {
  console.log('Starting semantic model analysis...');
  
  // step 1: analyze semantic model files
  const analyzer = new SemanticModelAnalyzer();
  let models;
  
  if (specificFiles && specificFiles.length > 0) {
    // update mode: analyze specific files and their dependents
    console.log(`Analyzing specific files (update mode):`);
    specificFiles.forEach(file => console.log(`  - ${file}`));
    models = analyzer.analyzeFiles(specificFiles, modelsDirectoryPath);
  } else {
    // initial mode: analyze all files in directory
    console.log(`Analyzing directory: ${modelsDirectoryPath}`);
    models = analyzer.analyzeDirectory(modelsDirectoryPath);
  }
  
  console.log(`\nSuccessfully analyzed ${models.size} semantic models.`);

  // step 2: build dependency graph
  console.log('\nBuilding dependency graph...');
  const dependencies = analyzer.buildDependencyGraph();
  
  // step 3: perform topological sort
  console.log('\nPerforming topological sort...');
  const sorter = new TopologicalSorter(dependencies);
  const layers = sorter.sort();
  
  // step 4: print summary
  sorter.printSummary();
  
  // step 5: return results
  const summary = sorter.getSummary();
  
  return {
    layers: summary.layers,
    summary: {
      totalModels: summary.totalModels,
      processedModels: summary.processedModels,
      totalLayers: summary.totalLayers
    }
  };
}

/**
 * export results to JSON file
 * @param {Object} results - analysis results
 * @param {string} outputPath - path to output JSON file
 */
function exportDAG(results, outputPath) {
  const fs = require('fs');
  
  try {
    fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
    console.log(`\nResults exported to: ${outputPath}`);
  } catch (error) {
    console.error('Error exporting results:', error.message);
    throw error;
  }
}

// main execution if run directly
if (require.main === module) {
  const modelsDirectoryPath = process.env.SOURCE_DIR;
  const dagFilePath = process.env.DAG_FILE;
  
  try {
    const results = buildDAG(modelsDirectoryPath);
    exportDAG(results, dagFilePath);
    
    console.log('\n=== DAG CREATION COMPLETE ===');
    
  } catch (error) {
    console.error('DAG creation failed:', error.message);
    process.exit(1);
  }
}

module.exports = {
  buildDAG: buildDAG,
  exportDAG: exportDAG
};
