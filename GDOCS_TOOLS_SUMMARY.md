# Google Docs Tools Summary

## Overview
Comprehensive Google Docs tool suite with 15 tools for creating, editing, and managing documents.

## Tool Categories

### Document Management (2 tools)
- `gdocs_create` - Create a new Google Doc with optional title and initial content
- `gdocs_get` - Get document content as plain text or structured JSON

### Text Operations (4 tools)
- `gdocs_append_text` - Append text at the end of a document
- `gdocs_insert_text` - Insert text at a specific index
- `gdocs_replace_text` - Find and replace text throughout the document
- `gdocs_delete_content` - Delete content between two indexes

### Document Structure (3 tools)
- `gdocs_get_outline` - Get all headings to understand document structure
- `gdocs_insert_table` - Insert a table at a specific location
- `gdocs_insert_image` - Insert image from URL into document

### Formatting & Styling (2 tools)
- `gdocs_apply_style` - Apply paragraph style (HEADING_1-6, NORMAL_TEXT, TITLE, SUBTITLE) to a range

### Named Ranges (2 tools)
- `gdocs_get_named_ranges` - Get all named ranges in the document
- `gdocs_create_named_range` - Create a named range for a selection

### Collaboration & Export (2 tools)
- `gdocs_add_comment` - Add a comment to a range of text
- `gdocs_export_pdf` - Export document as PDF (returns download URL and base64 data)
- `gdocs_word_count` - Return word, character, and paragraph count

## Implementation Details
- All tools extend `BaseGoogleTool`
- Uses Google Docs API v1
- Proper error handling and logging with `[DOCS]` prefix
- Zod validation for all inputs
- Factory functions for each tool
- Main export function: `createDocsTools(userId)`

## Total Tools: 15
