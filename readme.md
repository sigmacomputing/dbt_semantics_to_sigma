# dbt Semantics to Sigma Data Model Converter

## Overview
This system implements a layer-by-layer processing workflow for converting dbt semantic models to Sigma data models based on dependency relationships defined in a DAG (Directed Acyclic Graph). The system supports both initial processing of all models and incremental updates for changed files.

## Key Features

### 1. Processing Modes
- **Initial Mode**: Processes all semantic models in the source directory
- **Update Mode**: Processes only changed files and their dependents based on dependency graph
- **Command Line Arguments**: Update mode accepts changed file paths as command line arguments

### 2. Layer-by-Layer Processing
- **Sequential Processing**: Models are processed layer by layer, ensuring dependencies are resolved before dependent models are processed
- **DAG-Based Ordering**: Uses topological sorting to determine the correct processing order
- **Dependency Resolution**: Each layer waits for all dependencies from previous layers to be completed
- **Incremental DAG Building**: In update mode, builds DAG only for changed files and their dependents

### 3. Sigma API Integration
- **Create Data Model**: Creates new Sigma data models via API (`/v3alpha/dataModels/spec`)
- **Update Data Model**: Updates existing data models via API (`/v3alpha/dataModels/{id}/spec`)
- **Get Data Model**: Retrieves data model specifications from Sigma API
- **Test Mode**: Supports test mode with placeholder functions when `TEST_FLAG=true`
- **ID Management**: Automatically retrieves existing data model IDs from sigma_model files in update mode

### 4. File Management
- **Output Generation**: Creates processed YAML files in the output directory
- **Sigma Model Storage**: Saves data model specs from Sigma API to sigma_model folder
- **Foreign Entity References**: Uses IDs from sigma_model files for foreign entity relationships
- **Git Integration**: Optionally commits changes to git repository when `FROM_CI_CD=true`

### 5. Dependency Handling
- **Foreign Entity Lookup**: Automatically resolves foreign entity references using sigma_model files
- **Relationship Configuration**: Creates proper relationship configurations between primary and foreign entities
- **ID Propagation**: Ensures foreign entities reference the correct data model and table IDs

## File Structure

```
src/
├── main.js                # Main entry point and execution script
├── routes/
│   ├── converter/
│   │   ├── layer_processor.js      # Main processing class
│   │   ├── convert_semantics.js    # Semantic model conversion
│   │   └── build_dag.js            # DAG construction
│   ├── sigma_api/
│   │   ├── create_data_model.js   # Create data model API
│   │   ├── update_data_model.js   # Update data model API
│   │   └── get_data_model.js      # Get data model API
│   └── ...
│
sigma_model/               # Generated Sigma model files (from API)
├── wd_account.yml
├── wd_opportunity.yml
└── ...
```

## Usage

### Basic Usage (Initial Mode)
```bash
node src/main.js
```

### Update Mode (Process Changed Files)
```bash
node src/main.js file1.yml file2.yml ...
```

The system will:
1. Build DAG for changed files and their dependents
2. Process only affected models in the correct layer order
3. Update existing data models or create new ones as needed

### Secrets
The converter requires the following Action secrets:
- `API_CLIENT_ID`: Client ID for Sigma API Key
- `API_SECRET`: Secret for Sigma API Key
- `CONNECTION_ID`: Sigma connection ID
- `DB`: Database name conatining the dbt generated views/tables used by the semantic models
- `SCHEMA`: Schema name conatining the dbt generated views/tables used by the semantic models
- `GIT_USER`: The converter retrieves the data models it creates in Sigma and checks them into the repository. Git user name to be used for commits.
- `GIT_EMAIL`: Git user email to be used for commits.
- `SIGMA_DOMAIN`: The name of your Sigma org.
- `SIGMA_FOLDER_ID`: Sigma folder ID where the converter creates data models.

### Variables
The converter requires the following Action variables:
- `API_URL`: Sigma API base URL e.g. https://api.sigmacomputing.com
- `MODE`: has to be set as `initial` when using for the first time and `update` afterwards

### action.yml Variables
The following variables need to be configured in the action.yml file.
- `paths`: Path to location of dbt semantic model yml files
- `DAG_FILE`: Path to DAG JSON file
- `TIME_SPINE_FILE`: Path to time spine models file
- `SOURCE_DIR`: Directory containing source semantic models
- `SIGMA_MODEL_DIR`: Directory for Sigma model files
- `USER_FRIENDLY_COLUMN_NAMES`: Set to `true` to convert dimension names to user-friendly format. This needs to match the Sigma connection configuration.

## Processing Flow

### Initial Mode
1. **Build DAG**: Analyze all semantic models and build dependency graph
2. **Export DAG**: Save DAG to JSON file
3. **Process Layer 1**: Handle all models with no dependencies
   - Convert semantic models to Sigma format
   - Create new data models via Sigma API (or placeholder if test mode)
   - Retrieve data model spec from Sigma API
   - Save to sigma_model folder
4. **Process Layer 2+**: Handle models with dependencies
   - Use sigma_model IDs for foreign entities
   - Create proper relationship configurations
   - Create new data models via Sigma API
   - Retrieve and save data model specs
5. **Complete**: Generate processing summary and results

### Update Mode
1. **Build DAG for Changed Files**: Analyze changed files and their dependents
   - Only processes files that changed and models that depend on them
   - Builds minimal DAG for affected models
2. **Export DAG**: Save DAG to JSON file
3. **Process Affected Layers**: Process models in dependency order
   - For existing models: Retrieve existing dataModelId from sigma_model files
   - Update existing data models via Sigma API (or placeholder if test mode)
   - For new models: Create new data models
   - Retrieve and save updated data model specs
   - Optionally commit to git if `FROM_CI_CD=true`
4. **Complete**: Generate processing summary and results

## Key Components

### Main Entry Point (`main.js`)
- `main()`: Main execution function
- Handles command line arguments for update mode
- Validates mode and configuration
- Orchestrates DAG building and processing

### LayerProcessor Class
- `processAllLayers()`: Main processing method that processes all layers sequentially
- `processLayer()`: Process all models in a single layer
- `processDbtModel()`: Process individual models
- `getExistingDataModelId()`: Retrieve existing data model ID from sigma_model files
- `saveDataModelSpecToSigmaFolder()`: Save data model spec as YAML
- `saveDataModelSpecInRepo()`: Save and commit to git repository

### DAG Building (`build_dag.js`)
- `buildDAG()`: Build dependency graph from semantic models
  - Supports analyzing all files (initial mode)
  - Supports analyzing specific files and dependents (update mode)
- `exportDAG()`: Export DAG to JSON file

### Sigma API Integration
- `createDataModelInSigma()`: Create new data model via Sigma API
- `updateDataModelInSigma()`: Update existing data model via Sigma API
- `getDataModelFromSigma()`: Retrieve data model specification from Sigma API
- Test mode support with placeholder functions

### Semantic Model Conversion (`convert_semantics.js`)
- `convertSemantics()`: Convert dbt semantic model to Sigma data model format
- Handles dimensions, measures, metrics, and entities
- Processes foreign entity relationships
- Adds time spine relationships

### Dependency Resolution
- Automatic foreign entity lookup from sigma_model files
- Proper ID propagation for relationship configurations
- Support for multiple foreign entities per model
- DAG-based dependency tracking

## Example Output

### Processing Summary
```
=== PROCESSING COMPLETE ===
Total Models: 33
Processed: 33
Successful: 33
Failed: 0
Layers: 4
```

### Layer Results
```
Layer 1: ✓ 20 models processed
Layer 2: ✓ 2 models processed  
Layer 3: ✓ 7 models processed
Layer 4: ✓ 4 models processed
```

### Sigma Model Files
Each sigma_model file contains:
- `id`: Unique GUID for the data model
- `name`: Model name
- `entity`: "datamodel"
- `pages`: Model structure with elements, columns, metrics, joins
- Foreign entity references with proper IDs


## Error Handling

- Comprehensive error handling for file operations
- Graceful failure handling with detailed error messages
- Processing continues even if individual models fail
- Detailed logging of success/failure status
- Validation of mode and required parameters
- Error handling for Sigma API calls with detailed error messages

## Mode-Specific Behavior

### Initial Mode
- Processes all semantic models in source directory
- Creates new data models in Sigma
- Generates new GUIDs for all models
- Full dependency graph analysis

### Update Mode
- Processes only changed files and their dependents
- Retrieves existing data model IDs from sigma_model files
- Updates existing data models instead of creating new ones
- Minimal dependency graph analysis (only affected models)
- Requires changed file paths as command line arguments

## Test Mode

When `TEST_FLAG=true`:
- Uses placeholder functions instead of real Sigma API calls
- Generates dummy GUIDs for data models
- Copies processed files directly to sigma_model folder
- Useful for testing conversion logic without API calls

## CI/CD Integration

When `FROM_CI_CD=true`:
- Automatically commits changes to git repository
- Configures git user if not already set
- Commits data model specs to sigma_model folder
- Uses environment variables for git user configuration

