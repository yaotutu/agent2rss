#!/bin/bash

# Test script for markdown file upload functionality
echo "Testing markdown file upload functionality..."

# Start the server in the background
echo "Starting server..."
bun run dev &
SERVER_PID=$!
sleep 3  # Wait for server to start

# Test 1: Check if server is running
echo "Checking if server is running..."
if curl -s http://localhost:8765/health | grep -q "healthy"; then
    echo "✓ Server is running"
else
    echo "✗ Server is not responding"
    kill $SERVER_PID 2>/dev/null
    exit 1
fi

# Test 2: Create a test channel
echo "Creating test channel..."
RESPONSE=$(curl -s -X POST http://localhost:8765/api/channels \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -d '{"name":"Test Channel","description":"Test channel for file upload"}')

TOKEN=$(echo $RESPONSE | grep -o '"token":"[^"]*' | cut -d '"' -f 4)
CHANNEL_ID=$(echo $RESPONSE | grep -o '"id":"[^"]*' | cut -d '"' -f 4)

if [ -n "$TOKEN" ] && [ -n "$CHANNEL_ID" ]; then
    echo "✓ Test channel created: $CHANNEL_ID"
else
    echo "✗ Failed to create test channel"
    echo "Response: $RESPONSE"
    kill $SERVER_PID 2>/dev/null
    exit 1
fi

# Test 3: Upload markdown file
echo "Uploading markdown file..."
UPLOAD_RESPONSE=$(curl -s -X POST "http://localhost:8765/api/channels/$CHANNEL_ID/posts/upload" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@test_upload.md")

if echo $UPLOAD_RESPONSE | grep -q "success.*true"; then
    echo "✓ Markdown file uploaded successfully"
    POST_ID=$(echo $UPLOAD_RESPONSE | grep -o '"id":"[^"]*' | cut -d '"' -f 4)
    echo "  - Post ID: $POST_ID"
else
    echo "✗ Failed to upload markdown file"
    echo "Response: $UPLOAD_RESPONSE"
    kill $SERVER_PID 2>/dev/null
    exit 1
fi

# Test 4: Check RSS feed
echo "Checking RSS feed..."
RSS_RESPONSE=$(curl -s "http://localhost:8765/channels/$CHANNEL_ID/rss.xml")
if echo $RSS_RESPONSE | grep -q "测试文章标题"; then
    echo "✓ RSS feed contains uploaded content"
else
    echo "✗ RSS feed does not contain uploaded content"
    echo "RSS Response: $RSS_RESPONSE"
    kill $SERVER_PID 2>/dev/null
    exit 1
fi

# Cleanup: Delete test channel
echo "Cleaning up test channel..."
DELETE_RESPONSE=$(curl -s -X DELETE "http://localhost:8765/api/channels/$CHANNEL_ID" \
  -H "Authorization: Bearer $TOKEN")

if echo $DELETE_RESPONSE | grep -q "success.*true"; then
    echo "✓ Test channel deleted"
else
    echo "✗ Failed to delete test channel"
fi

# Stop the server
kill $SERVER_PID 2>/dev/null
echo "✓ Server stopped"

echo ""
echo "🎉 All tests passed! File upload functionality is working correctly."
echo ""
echo "Summary:"
echo "- New endpoint: POST /api/channels/:channelId/posts/upload"
echo "- Accepts multipart/form-data with file field"
echo "- Supports Markdown files (.md, .markdown)"
echo "- Maintains same auth mechanism as existing endpoints"
echo "- Uses same content processing pipeline"
echo "- Returns same response format as existing endpoints"