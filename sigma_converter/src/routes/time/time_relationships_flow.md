# Time Dimension Processing Flow

This document describes the flow for processing time dimensions in dbt semantic models and adding corresponding time_spine elements to Sigma data models.

## Overview

The time dimension processor extracts aggregation time dimensions from dbt semantic models and creates corresponding time_spine table elements in the Sigma data model. This enables time-based analysis and filtering in Sigma.

## Architecture

The time dimension processing is broken down into modular functions:

```
routes/time/
├── index.js                          # Main export file
├── extract_agg_time_dimensions.js    # Step 1: Extract agg_time_dimension values
├── find_time_granularity.js          # Step 2: Find time_granularity for dimensions
├── find_time_spine_column.js         # Step 3: Find matching time_spine column
└── add_time_relationships.js         # Step 4: Orchestrate and add to target data
```

## Processing Flow

### Step 1: Extract Aggregation Time Dimensions

**File**: `extract_agg_time_dimensions.js`  
**Function**: `extractAggTimeDimensions(semanticModel)`

**Purpose**: Collects all unique `agg_time_dimension` values from the semantic model.

**Process**:
1. Check `semanticModel.defaults.agg_time_dimension` (if present)
2. Check all `semanticModel.measures[].agg_time_dimension` (if present)
3. Return array of unique dimension names

**Example Input**:
```yaml
semantic_models:
  - name: wd_opportunity
    defaults:
      agg_time_dimension: opportunity_close_date
    measures:
      - name: sum_opportunity_amount
        agg_time_dimension: opportunity_close_date
      - name: sum_qualified_amount
        agg_time_dimension: opportunity_qualified_date
```

**Example Output**:
```javascript
['opportunity_close_date', 'opportunity_qualified_date']
```

---

### Step 2: Find Time Granularity

**File**: `find_time_granularity.js`  
**Function**: `findTimeGranularity(semanticModel, dimensionName)`

**Purpose**: Retrieves the `time_granularity` for a given dimension name.

**Process**:
1. Search `semanticModel.dimensions` for matching dimension name
2. Verify dimension type is `time`
3. Extract `type_params.time_granularity` value
4. Return granularity (e.g., 'day', 'month', 'quarter', 'year') or `null`

**Example Input**:
```yaml
dimensions:
  - name: opportunity_close_date
    type: time
    type_params:
      time_granularity: day
```

**Example Output**:
```javascript
'day'
```

---

### Step 3: Find Time Spine Column

**File**: `find_time_spine_column.js`  
**Function**: `findTimeSpineColumn(modelsFilePath, granularity)`

**Purpose**: Finds the appropriate time_spine column from `_models.yml` that matches the granularity.

**Process**:
1. Read and parse `_models.yml` file
2. Find the `time_spine` model
3. Get `standard_granularity_column` (typically `fiscal_date`)
4. Check `custom_granularities` for exact granularity match
5. Check if `standard_granularity_column` matches the granularity
6. If granularity is 'day' and no match found, default to `standard_granularity_column`
7. Return object with column name, time_spine name, and granularity

**Example Input** (`_models.yml`):
```yaml
models:
  - name: time_spine
    time_spine:
      standard_granularity_column: fiscal_date
      custom_granularities:
        - name: wd_fiscal_quarter
          column_name: fiscal_quarter_name
    columns:
      - name: fiscal_date
        granularity: day
      - name: fiscal_quarter_name
        granularity: quarter
```

**Example Output** (for granularity: 'day'):
```javascript
{
  columnName: 'fiscal_date',
  timeSpineName: 'time_spine',
  granularity: 'day'
}
```

---

### Step 4: Add Time Dimensions to Target Data

**File**: `add_time_relationships.js`  
**Function**: `addTimeRelationships(targetData, semanticModel, modelsFilePath, options)`

**Purpose**: Orchestrates the entire process and adds time_spine elements and relationships to the Sigma data model.

**Process**:

1. **Extract Aggregation Time Dimensions**
   - Call `extractAggTimeDimensions()` to get all unique `agg_time_dimension` values
   - If none found, return targetData unchanged

2. **Find Primary Entity**
   - Locate primary entity from `semanticModel.entities`
   - Required for creating relationships

3. **Process Each Aggregation Time Dimension**
   For each unique `agg_time_dimension`:
   
   a. **Find Granularity**
      - Call `findTimeGranularity()` to get the time granularity
      - Skip if granularity not found
   
   b. **Check for Duplicates**
      - Track added time_spines by granularity
      - Skip if this granularity already processed
   
   c. **Find Time Spine Column**
      - Call `findTimeSpineColumn()` to get matching column info
      - Skip if no matching column found
   
   d. **Create Time Spine Element**
      - Generate unique element ID: `time_spine_{granularity}`
      - Create warehouse-table source element with:
        - Connection ID, database, schema
        - Table name: `TIME_SPINE` (uppercase)
      - Add to `targetData.pages[0].elements`
   
   e. **Create Relationship**
      - Find the dimension in semantic model
      - Create relationship between primary entity and time_spine element
      - Relationship keys:
        - Source: `${semanticModel.name}__${dimension.name}`
        - Target: `${timeSpineElementId}__${timeSpineInfo.columnName}`
      - Relationship type: `N:1`
      - Add to primary entity's relationships array

4. **Return Updated Target Data**

**Example Output Structure**:
```yaml
pages:
  - elements:
      - id: wd_opportunity
        name: wd_opportunity
        relationships:
          - id: wd_opportunity__time_spine_day
            name: wd_opportunity__time_spine_day
            targetElementId: time_spine_day
            keys:
              - sourceColumnId: wd_opportunity__opportunity_close_date
                targetColumnId: time_spine_day__fiscal_date
            relationshipType: N:1
      - id: time_spine_day
        name: time_spine
        kind: table
        source:
          name: time_spine
          kind: warehouse-table
          connectionId: $connectionId
          path:
            - $db
            - $schema
            - TIME_SPINE
```

## Integration Point

The time dimension processing is integrated into `convert_semantics.js`:

```javascript
// After foreign entity processing
if (options.modelsFilePath) {
  targetData = addTimeRelationships(targetData, semanticModel, options.modelsFilePath, {
    connectionId: options.connectionId,
    db: options.db,
    schema: options.schema
  });
}
```

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Semantic Model YAML                      │
│  - defaults.agg_time_dimension                              │
│  - measures[].agg_time_dimension                            │
│  - dimensions[] (with type: time)                           │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
        ┌──────────────────────────────┐
        │ extractAggTimeDimensions()    │
        │ Returns: ['dim1', 'dim2']     │
        └──────────────┬───────────────┘
                       │
                       ▼
        ┌──────────────────────────────┐
        │ For each dimension:           │
        │ findTimeGranularity()         │
        │ Returns: 'day', 'month', etc. │
        └──────────────┬───────────────┘
                       │
                       ▼
        ┌──────────────────────────────┐
        │ findTimeSpineColumn()         │
        │ Reads: _models.yml            │
        │ Returns: column info          │
        └──────────────┬───────────────┘
                       │
                       ▼
        ┌──────────────────────────────┐
        │ addTimeRelationships()           │
        │ - Creates time_spine element  │
        │ - Creates relationship        │
        │ - Adds to targetData          │
        └──────────────┬───────────────┘
                       │
                       ▼
        ┌──────────────────────────────┐
        │        Target Data            │
        │  (Sigma Data Model)            │
        └──────────────────────────────┘
```

## Key Concepts

### Aggregation Time Dimension
The dimension used for time-based aggregation in measures. Can be specified:
- At the model level in `defaults.agg_time_dimension`
- Per measure in `measures[].agg_time_dimension`

### Time Granularity
The granularity level of a time dimension:
- `day` - Daily granularity
- `week` - Weekly granularity
- `month` - Monthly granularity
- `quarter` - Quarterly granularity
- `year` - Yearly granularity

### Time Spine
A reference table containing all time periods at various granularities. Used for:
- Time-based filtering
- Time-based grouping
- Handling missing dates in fact tables

### Relationship Type
Time spine relationships are always `N:1` (many-to-one):
- Multiple fact table rows can map to one time spine row
- Example: Multiple opportunities can close on the same date

## Error Handling

The processor includes error handling for:
- Missing `_models.yml` file
- Missing `time_spine` model in `_models.yml`
- Missing `standard_granularity_column`
- Dimensions without `time_granularity`
- Missing dimensions in semantic model
- Missing primary entity

All errors are logged as warnings and processing continues for other dimensions.

## Example: Complete Flow

**Input Semantic Model**:
```yaml
semantic_models:
  - name: wd_opportunity
    defaults:
      agg_time_dimension: opportunity_close_date
    dimensions:
      - name: opportunity_close_date
        type: time
        type_params:
          time_granularity: day
    measures:
      - name: sum_amount
        agg: sum
        expr: amount
        agg_time_dimension: opportunity_close_date
```

**Processing Steps**:
1. Extract: `['opportunity_close_date']`
2. Find granularity: `'day'`
3. Find time_spine column: `{ columnName: 'fiscal_date', ... }`
4. Add element and relationship to target data

**Result**: A `time_spine_day` element is added to the Sigma data model with a relationship linking `wd_opportunity.opportunity_close_date` to `time_spine.fiscal_date`.

