#!/bin/bash

# Test Gravity Forms Webhook with Gender: Female using curl
# Usage: ./test_gravity_forms_webhook_curl.sh

API_URL="${API_URL:-http://localhost:5000}"
ENDPOINT="${API_URL}/api/gravity-forms-webhook/submit"

echo "🧪 TESTING GRAVITY FORMS WEBHOOK WITH GENDER: FEMALE"
echo "=================================================="
echo ""
echo "📤 Sending POST request to: ${ENDPOINT}"
echo ""

curl -X POST "${ENDPOINT}" \
  -H "Content-Type: application/json" \
  -d '{
    "1": "Jane Doe",
    "Name": "Jane Doe",
    "7": "jane.doe@example.com",
    "Email": "jane.doe@example.com",
    "15": "07700900123",
    "Telephone Number": "07700900123",
    "11": "28",
    "Age": "28",
    "5": "SW1A 1AA",
    "Postcode": "SW1A 1AA",
    "Gender": "Female",
    "12": "Female",
    "source_url": "https://edgetalent.co.uk/test-form/",
    "id": "test-'$(date +%s)'"
  }' \
  -w "\n\nHTTP Status: %{http_code}\n" \
  -s | jq '.' 2>/dev/null || cat

echo ""
echo "✅ Test completed!"
echo "   Check your database to verify the lead was created with Gender: Female"

