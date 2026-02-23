# Google Sheets Tools Summary

## Overview
Comprehensive Google Sheets tool suite with 25 tools for creating, editing, and managing spreadsheets.

## Tool Categories

### Spreadsheet Management (1 tool)
- `gsheets_create` - Create a new spreadsheet with optional title and sheets

### Data Operations (7 tools)
- `gsheets_get_values` - Read values from a range (A1 notation)
- `gsheets_batch_get` - Read multiple ranges at once
- `gsheets_update_values` - Write values to a range
- `gsheets_batch_update` - Write to multiple ranges in one call
- `gsheets_append_values` - Append rows to the end of a sheet
- `gsheets_clear_range` - Clear values from a range
- `gsheets_get_formulas` - Get formulas (not values) from a range

### Sheet Management (5 tools)
- `gsheets_get_sheet_names` - List all sheets/tabs in a spreadsheet
- `gsheets_add_sheet` - Add a new sheet/tab
- `gsheets_delete_sheet` - Delete a sheet/tab
- `gsheets_rename_sheet` - Rename a sheet/tab
- `gsheets_duplicate_sheet` - Duplicate a sheet within the spreadsheet

### Data Manipulation (2 tools)
- `gsheets_find_replace` - Find and replace values across the sheet
- `gsheets_sort_range` - Sort a range by a column

### Formatting (4 tools)
- `gsheets_format_range` - Apply formatting (bold, color, alignment, number format) to a range
- `gsheets_auto_resize_columns` - Auto-resize columns to fit content
- `gsheets_freeze_rows` - Freeze top N rows
- `gsheets_merge_cells` - Merge a range of cells

### Advanced Features (6 tools)
- `gsheets_add_chart` - Create a chart from a data range
- `gsheets_filter_view` - Create a filter view
- `gsheets_protect_range` - Protect a range from editing
- `gsheets_validate_range` - Add data validation to a range (dropdown, number, date)
- `gsheets_add_conditional_format` - Add conditional formatting rules
- `gsheets_export_csv` - Export a sheet as CSV text

## Implementation Details
- All tools extend `BaseGoogleTool`
- Uses Google Sheets API v4
- Proper error handling and logging with `[SHEETS]` prefix
- Zod validation for all inputs
- Factory functions for each tool
- Main export function: `createSheetsTools(userId)`

## Total Tools: 25
