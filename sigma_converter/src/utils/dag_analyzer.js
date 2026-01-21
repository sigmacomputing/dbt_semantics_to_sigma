const yaml = require('js-yaml');
const fs = require('fs');
const path = require('path');

/**
 * analyzes semantic model files to create a DAG
 */
class SemanticModelAnalyzer {
  constructor() {
    this.models = new Map();
    this.dependencies = new Map();
    this.entityToFileMap = new Map(); // maps entity name to file where it's defined as primary/unique
  }

  /**
   * build a map of entity names to the files where they are defined as primary or unique
   * @param {string} directoryPath - path to directory containing semantic model files
   */
  buildEntityToFileMap(directoryPath) {
    this.entityToFileMap.clear();
    const files = fs.readdirSync(directoryPath)
      .filter(file => file.endsWith('.yml') && file !== '_models.yml')
      .map(file => path.join(directoryPath, file));

    files.forEach(filePath => {
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        const data = yaml.load(content);
        const fileName = path.basename(filePath, '.yml');
        
        if (data.semantic_models) {
          data.semantic_models.forEach(semanticModel => {
            if (semanticModel.entities) {
              semanticModel.entities.forEach(entity => {
                // record where entities are defined as primary or unique
                if (entity.type === 'primary' || entity.type === 'unique') {
                  this.entityToFileMap.set(entity.name, {
                    fileName: fileName,
                    semanticModelName: semanticModel.name
                  });
                }
              });
            }
          });
        }
      } catch (error) {
        // silently skip files that can't be parsed during entity mapping
      }
    });
  }

  /**
   * parse a semantic model YAML file and extract entity information for all semantic models
   * @param {string} filePath - path to the semantic model YAML file
   * @returns {Array<Object>} array of parsed model information objects
   */
  parseSemanticModel(filePath) {
    try {

      const content = fs.readFileSync(filePath, 'utf8');
      const data = yaml.load(content);
      
      if (!data.semantic_models || data.semantic_models.length === 0) {
        throw new Error(`No semantic models found in ${filePath}.`);
      }

      const fileName = path.basename(filePath, '.yml');
      const modelInfos = [];
      
      // process each semantic model in the file
      data.semantic_models.forEach(semanticModel => {
        const modelInfo = {
          fileName,
          name: semanticModel.name,
          description: semanticModel.description,
          primaryEntity: null,
          foreignEntities: [],
          allEntities: []
        };

        // extract entities
        if (semanticModel.entities) {
          semanticModel.entities.forEach(entity => {
            modelInfo.allEntities.push(entity.name);
            
            if (entity.type === 'primary') {
              modelInfo.primaryEntity = entity.name;
            } else if (entity.type === 'foreign') {
              // store foreign entity as object with name, expr, and file
              const foreignEntityDef = {
                name: entity.name,
                expr: entity.expr || null
              };
              
              // find the file where this entity is defined as primary or unique
              const definitionInfo = this.entityToFileMap.get(entity.name);
              if (definitionInfo) {
                foreignEntityDef.file = definitionInfo.fileName;
                foreignEntityDef.semanticModelName = definitionInfo.semanticModelName;
              } else {
                // if not found, set to null (entity might be defined elsewhere or not yet processed)
                foreignEntityDef.file = null;
                foreignEntityDef.semanticModelName = null;
              }
              
              modelInfo.foreignEntities.push(foreignEntityDef);
            }
          });
        }

        modelInfos.push(modelInfo);
      });

      return modelInfos;

    } catch (error) {
      console.error(`Error parsing ${filePath}:`, error.message);
      throw error;
    }
  }

  /**
   * analyze all semantic model files in a directory
   * @param {string} directoryPath - path to directory containing semantic model files
   * @returns {Map} map of model names to model information
   */
  analyzeDirectory(directoryPath) {
    // first, build entity-to-file mapping
    console.log('Building entity-to-file mapping...');
    this.buildEntityToFileMap(directoryPath);
    
    const files = fs.readdirSync(directoryPath)
      .filter(file => file.endsWith('.yml') && file !== '_models.yml')
      .map(file => path.join(directoryPath, file));

    console.log(`Found ${files.length} semantic model files to analyze.`);

    files.forEach(filePath => {
      try {
        const modelInfos = this.parseSemanticModel(filePath);
        modelInfos.forEach(modelInfo => {
          this.models.set(modelInfo.name, modelInfo);
          console.log(`✓ Analyzed: ${modelInfo.name} (${modelInfo.fileName}).`);
        });
      } catch (error) {
        console.error(`✗ Failed to analyze ${filePath}:`, error.message);
      }
    });

    return this.models;
  }

  /**
   * analyze specific semantic model files and their dependents
   * @param {Array<string>} filePaths - array of paths to semantic model files
   * @param {string} directoryPath - path to directory containing all semantic model files (needed to find dependents)
   * @returns {Map} map of model names to model information
   */
  analyzeFiles(filePaths, directoryPath) {
    console.log(`Analyzing ${filePaths.length} specific semantic model file(s).`);

    // step 1: first analyze all files in directory to build complete dependency graph
    console.log('Building complete dependency graph from all files...');
    // temporarily populate models with all files to build dependency graph
    this.models = new Map();
    // use existing analyzeDirectory method to analyze all files
    this.analyzeDirectory(directoryPath);

    // step 2: use existing buildDependencyGraph() to build the dependency graph
    const dependencies = this.buildDependencyGraph();

    // step 3: identify models in changed files
    const changedModelNames = new Set();
    const modelToFileMap = new Map(); // map model name to file path
    
    filePaths.forEach(filePath => {
      if (!fs.existsSync(filePath)) {
        console.error(`✗ File not found: ${filePath}`);
        return;
      }

      try {
        const modelInfos = this.parseSemanticModel(filePath);
        modelInfos.forEach(modelInfo => {
          changedModelNames.add(modelInfo.name);
          modelToFileMap.set(modelInfo.name, filePath);
        });
      } catch (error) {
        console.error(`✗ Failed to parse ${filePath}:`, error.message);
      }
    });

    // step 4: find all dependents (transitive closure) of changed models
    const modelsToInclude = new Set(changedModelNames);
    const filesToAnalyze = new Set(filePaths);

    // recursively find all dependents for a model by traversing the dependency graph
    const findDependents = (modelName) => {
      const depInfo = dependencies.get(modelName);
      if (!depInfo) return;

      depInfo.dependents.forEach(dependent => {
        if (!modelsToInclude.has(dependent)) {
          modelsToInclude.add(dependent);
          // find which file contains this dependent model
          const dependentModelInfo = this.models.get(dependent);
          if (dependentModelInfo) {
            const dependentFilePath = path.join(directoryPath, `${dependentModelInfo.fileName}.yml`);
            if (fs.existsSync(dependentFilePath)) {
              filesToAnalyze.add(dependentFilePath);
              modelToFileMap.set(dependent, dependentFilePath);
              // recursively find dependents of this dependent
              findDependents(dependent);
            }
          }
        }
      });
    };

    // find all dependents for each changed model
    changedModelNames.forEach(modelName => {
      findDependents(modelName);
    });

    console.log(`Found ${filesToAnalyze.size} files to analyze (${filePaths.length} changed + ${filesToAnalyze.size - filePaths.length} dependents)`);

    // step 5: clear models and only analyze files we need (changed + dependents)
    this.models.clear();
    
    filesToAnalyze.forEach(filePath => {
      try {
        const modelInfos = this.parseSemanticModel(filePath);
        modelInfos.forEach(modelInfo => {
          this.models.set(modelInfo.name, modelInfo);
          const isChanged = changedModelNames.has(modelInfo.name);
          const marker = isChanged ? '[CHANGED]' : '[DEPENDENT]';
          console.log(`✓ Analyzed: ${modelInfo.name} (${modelInfo.fileName}) ${marker}`);
        });
      } catch (error) {
        console.error(`✗ Failed to analyze ${filePath}:`, error.message);
      }
    });

    return this.models;
  }

  /**
   * build dependency graph for topological sorting
   * @returns {Map} map of model names to their dependencies
   */
  buildDependencyGraph() {
    this.dependencies.clear();

    for (const [modelName, modelInfo] of this.models) {
      // extract entity names from foreignEntities (which are now objects)
      const foreignEntityNames = modelInfo.foreignEntities.map(fe => 
        typeof fe === 'string' ? fe : fe.name
      );
      
      this.dependencies.set(modelName, {
        modelInfo,
        dependsOn: foreignEntityNames,
        dependents: []
      });
    }

    // build reverse dependencies (dependents)
    for (const [modelName, depInfo] of this.dependencies) {
      depInfo.dependsOn.forEach(dependency => {
        if (this.dependencies.has(dependency)) {
          this.dependencies.get(dependency).dependents.push(modelName);
        }
      });
    }

    return this.dependencies;
  }

  /**
   * get all analyzed models
   * @returns {Map} map of model names to model information
   */
  getModels() {
    return this.models;
  }

  /**
   * get dependency graph
   * @returns {Map} map of model names to dependency information
   */
  getDependencies() {
    return this.dependencies;
  }
}

module.exports = SemanticModelAnalyzer;
