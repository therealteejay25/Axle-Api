# Google Slides Tools Summary

## Overview
Comprehensive Google Slides tool suite with 14 tools for creating, editing, and managing presentations.

## Tool Categories

### Presentation Management (2 tools)
- `gslides_create` - Create a new presentation with title
- `gslides_get` - Get presentation metadata and slide count

### Slide Management (6 tools)
- `gslides_get_slide` - Get a specific slide's content and elements
- `gslides_list_slides` - List all slides with their IDs and titles
- `gslides_add_slide` - Add a new slide with a layout (BLANK, TITLE, TITLE_AND_BODY, etc.)
- `gslides_delete_slide` - Delete a slide
- `gslides_duplicate_slide` - Duplicate a slide
- `gslides_move_slide` - Reorder a slide to a new position

### Content Operations (3 tools)
- `gslides_update_text` - Update text in a specific shape/element on a slide
- `gslides_replace_text` - Find and replace text across all slides
- `gslides_insert_image` - Insert an image from URL onto a slide

### Slide Styling (1 tool)
- `gslides_set_slide_background` - Set background color or image of a slide

### Export & Preview (2 tools)
- `gslides_get_thumbnail` - Get a thumbnail image URL for a slide
- `gslides_export_pdf` - Export entire presentation as PDF

## Implementation Details
- All tools extend `BaseGoogleTool`
- Uses Google Slides API v1
- Proper error handling and logging with `[SLIDES]` prefix
- Zod validation for all inputs
- Factory functions for each tool
- Main export function: `createSlidesTools(userId)`
- Supports EMU (English Metric Units) for positioning and sizing

## Total Tools: 14
