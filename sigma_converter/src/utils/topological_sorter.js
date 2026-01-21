/**
 * topological sort algorithm for semantic models based on entity dependencies
 * layer 1 contains models that have no dependencies
 * layer 2 contains models that depend on entities from layer 1
 * layer 3 contains models that depend on entities from layers 1 and/or 2
 */
class TopologicalSorter {
  constructor(dependencies) {
    this.dependencies = dependencies;
    this.layers = [];
    this.processed = new Set();
  }

  /**
   * perform topological sort and organize models into layers
   * @returns {Array} array of layers, where each layer contains models that can be processed together
   */
  sort() {
    this.layers = [];
    this.processed = new Set();
    
    // find all models that have no dependencies (layer 1)
    const layer1 = [];
    for (const [modelName, depInfo] of this.dependencies) {
      if (depInfo.dependsOn.length === 0) {
        layer1.push({
          name: modelName,
          fileName: depInfo.modelInfo.fileName,
          primaryEntity: depInfo.modelInfo.primaryEntity,
          foreignEntities: depInfo.modelInfo.foreignEntities
        });
        this.processed.add(modelName);
      }
    }

    if (layer1.length > 0) {
      this.layers.push({
        layer: 1,
        models: layer1,
        description: 'Models with only primary entities (no foreign dependencies).'
      });
    }

    // build subsequent layers
    let currentLayer = 2;
    let previousLayerModels = new Set(layer1.map(m => m.name));

    while (this.processed.size < this.dependencies.size) {
      const currentLayerModels = [];
      
      for (const [modelName, depInfo] of this.dependencies) {
        if (this.processed.has(modelName)) {
          continue;
        }

        // check if all dependencies are in previous layers
        const allDependenciesResolved = depInfo.dependsOn.every(dep => 
          previousLayerModels.has(dep)
        );

        if (allDependenciesResolved) {
          currentLayerModels.push({
            name: modelName,
            fileName: depInfo.modelInfo.fileName,
            primaryEntity: depInfo.modelInfo.primaryEntity,
            foreignEntities: depInfo.modelInfo.foreignEntities
          });
          this.processed.add(modelName);
        }
      }

      if (currentLayerModels.length === 0) {
        // check for circular dependencies
        const remainingModels = Array.from(this.dependencies.keys())
          .filter(name => !this.processed.has(name));
        
        if (remainingModels.length > 0) {
          console.warn(`Warning: Circular dependencies detected for models: ${remainingModels.join(', ')}.`);
          // add remaining models to current layer to break the cycle
          for (const modelName of remainingModels) {
            const depInfo = this.dependencies.get(modelName);
            currentLayerModels.push({
              name: modelName,
              fileName: depInfo.modelInfo.fileName,
              primaryEntity: depInfo.modelInfo.primaryEntity,
              foreignEntities: depInfo.modelInfo.foreignEntities
            });
            this.processed.add(modelName);
          }
        } else {
          break;
        }
      }

      if (currentLayerModels.length > 0) {
        this.layers.push({
          layer: currentLayer,
          models: currentLayerModels,
          description: `Models that depend only on entities from layers 1-${currentLayer - 1}`
        });
        
        // Update previous layer models for next iteration
        currentLayerModels.forEach(model => {
          previousLayerModels.add(model.name);
        });
      }

      currentLayer++;
    }

    return this.layers;
  }

  /**
   * get a summary of the topological sort results
   * @returns {Object} Summary information
   */
  getSummary() {
    const totalModels = this.dependencies.size;
    const processedModels = this.processed.size;
    const totalLayers = this.layers.length;

    const summary = {
      totalModels,
      processedModels,
      totalLayers,
      layers: this.layers.map(layer => ({
        layer: layer.layer,
        modelCount: layer.models.length,
        models: layer.models.map(m => ({
          name: m.name,
          fileName: m.fileName,
          primaryEntity: m.primaryEntity,
          foreignEntities: m.foreignEntities
        }))
      }))
    };

    return summary;
  }

  /**
   * print a formatted summary of the topological sort
   */
  printSummary() {
    console.log('\n=== TOPOLOGICAL SORT SUMMARY ===');
    console.log(`Total models: ${this.dependencies.size}`);
    console.log(`Total layers: ${this.layers.length}`);
    console.log(`Processed models: ${this.processed.size}`);
    
    console.log('\n=== LAYER BREAKDOWN ===');
    this.layers.forEach(layer => {
      console.log(`\nLayer ${layer.layer}: ${layer.models.length} models`);
      console.log(`Description: ${layer.description}`);
      layer.models.forEach(model => {
        console.log(`  - ${model.name} (${model.fileName})`);
        console.log(`    Primary: ${model.primaryEntity}`);
        if (model.foreignEntities.length > 0) {
          const foreignEntityNames = model.foreignEntities.map(fe => 
            typeof fe === 'string' ? fe : fe.name
          );
          console.log(`    Foreign: ${foreignEntityNames.join(', ')}`);
        }
      });
    });
  }
}

module.exports = TopologicalSorter;
