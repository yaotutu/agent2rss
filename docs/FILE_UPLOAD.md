# Markdown File Upload Feature

## Overview

The Agent2RSS service now supports uploading markdown files directly to create posts. This feature allows users to easily publish content without needing to structure JSON payloads, making it especially convenient for environments without Node.js or advanced scripting capabilities.

## New API Endpoint

### POST `/api/channels/:channelId/posts/upload`

Upload a markdown file to create a new post in the specified channel.

#### Request Format

- Method: `POST`
- Content-Type: `multipart/form-data`
- Authentication: Standard Bearer Token in Authorization header

#### Form Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | File | Yes | Markdown file (.md or .markdown) |
| `title` | String | No | Custom title (defaults to first # heading from file) |
| `link` | String | No | Custom link (auto-generated if omitted) |
| `contentType` | String | No | 'auto', 'markdown', or 'html' (defaults to 'auto') |
| `theme` | String | No | Theme name to apply (overrides channel default) |
| `description` | String | No | Custom description (auto-generated if omitted) |
| `author` | String | No | Author name |
| `tags` | String | No | Comma-separated tags (e.g., "tech,ai,news") |

#### Example Usage

Using curl:
```bash
curl -X POST "http://localhost:8765/api/channels/{channel-id}/posts/upload" \
  -H "Authorization: Bearer {channel-token}" \
  -F "file=@article.md" \
  -F "title=Custom Title" \
  -F "tags=technology,ai"
```

#### Response

Same format as the existing POST `/api/channels/:channelId/posts` endpoint:

```json
{
  "success": true,
  "message": "Post created successfully in channel \"{channelId}\" from uploaded file \"{fileName}\"",
  "post": {
    "id": "post-id",
    "title": "Post Title",
    "channel": "channel-id",
    "pubDate": "2024-01-01T00:00:00.000Z"
  }
}
```

#### Error Responses

- `400`: Invalid file type (must be .md or .markdown) or empty file content
- `401`: Missing or invalid authorization token
- `404`: Channel not found
- `500`: Server error during file processing

## Authentication

The file upload endpoint uses the same authentication mechanism as the existing API:
- Channel token: For publishing to a specific channel
- Super admin token: For publishing to any channel

## File Requirements

- File extension must be `.md` or `.markdown`
- File content must be valid UTF-8 encoded text
- File size limitations are determined by the server configuration

## Content Processing

Uploaded files are processed using the same pipeline as existing content:
- Markdown to HTML conversion using configured theme
- Automatic title extraction from first H1 heading
- Summary generation from content
- Link auto-generation if not specified
- Tag processing and validation