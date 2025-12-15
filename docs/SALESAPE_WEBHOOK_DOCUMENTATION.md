# SalesAPE Webhook Integration Documentation

## Overview
This document provides complete setup instructions for integrating SalesAPE with the Edge Talent CRM webhook system.

---

## Webhook Endpoint

**URL:** `https://edgetalentcrm-production.up.railway.app/api/salesape-webhook/update`

**Method:** `POST`

**Content-Type:** `application/json`

---

## Authentication

**Current Status:** No authentication required (open endpoint)

The webhook endpoint is currently open and accepts requests from any source. For production use, we recommend implementing authentication. If you require authentication, please contact us to set up API key authentication or webhook signature verification.

---

## Request Format

### Headers
```
Content-Type: application/json
```

### Request Body Structure
The webhook expects a JSON payload with the following fields:

```json
{
  "Airtable_Record_ID": "string",
  "CRM_ID": "string (REQUIRED)",
  "SalesAPE_Status": "string",
  "SalesAPE_Initial_Message_Sent": "boolean",
  "SalesAPE_User_Engaged": "boolean",
  "SalesAPE_Goal_Presented": "boolean",
  "SalesAPE_Goal_Hit": "boolean",
  "Follow_Ups_Ended": "boolean",
  "Not_Interested_Opted_Out": "boolean",
  "Post_Conversation_Summary": "boolean",
  "Conversation_Summary": "string",
  "Full_Conversation": "string",
  "Portal_Link": "string",
  "Booking_Date": "string (ISO 8601 date)",
  "Booking_Time": "string (HH:MM format)",
  "Event_Type": "string",
  "Calendar_Link": "string (URL)"
}
```

---

## Field Mappings & Descriptions

### Required Fields

| Field Name | Type | Description | Example |
|------------|------|-------------|---------|
| `CRM_ID` | string | **REQUIRED** - The unique identifier of the lead in the CRM. This is used to match the webhook update to the correct lead record. | `"550e8400-e29b-41d4-a716-446655440000"` |

### Status & Progress Fields

| Field Name | Type | Description | Example |
|------------|------|-------------|---------|
| `Airtable_Record_ID` | string | The Airtable record ID for this lead in SalesAPE's system | `"recABC123xyz"` |
| `SalesAPE_Status` | string | Current status/stage of the lead in SalesAPE workflow | `"User Engaged"`, `"Goal Hit"`, `"Queued"`, etc. |
| `SalesAPE_Initial_Message_Sent` | boolean | Whether the initial message has been sent to the lead | `true` or `false` |
| `SalesAPE_User_Engaged` | boolean | Whether the user has engaged/responded to messages | `true` or `false` |
| `SalesAPE_Goal_Presented` | boolean | Whether the booking goal/CTA has been presented to the lead | `true` or `false` |
| `SalesAPE_Goal_Hit` | boolean | **IMPORTANT** - Whether the lead has booked an appointment. When `true`, the CRM will automatically update the lead status to "Booked" | `true` or `false` |
| `Follow_Ups_Ended` | boolean | Whether follow-up messages have been completed/ended | `true` or `false` |
| `Not_Interested_Opted_Out` | boolean | Whether the lead has opted out or indicated they're not interested | `true` or `false` |

### Conversation & Summary Fields

| Field Name | Type | Description | Example |
|------------|------|-------------|---------|
| `Post_Conversation_Summary` | boolean | Flag indicating if conversation summary fields are being sent | `true` or `false` |
| `Conversation_Summary` | string | Brief summary of the conversation (sent when `Post_Conversation_Summary` is `true`) | `"Lead expressed interest in booking..."` |
| `Full_Conversation` | string | Complete conversation transcript (sent when `Post_Conversation_Summary` is `true`) | Full transcript text |
| `Portal_Link` | string | Link to view the conversation in SalesAPE portal (sent when `Post_Conversation_Summary` is `true`) | `"https://salesape.com/portal/conv-123"` |

### Booking Information Fields

| Field Name | Type | Description | Example |
|------------|------|-------------|---------|
| `Booking_Date` | string | Date of the booked appointment (ISO 8601 format: YYYY-MM-DD) | `"2024-01-15"` |
| `Booking_Time` | string | Time of the booked appointment (24-hour format: HH:MM) | `"14:30"` |
| `Event_Type` | string | Type of event/booking (typically "Meeting Booked") | `"Meeting Booked"` |
| `Calendar_Link` | string | URL to the booking/calendar page (if applicable) | `"https://www.edgetalentdiary.co.uk/book/tanya-booking"` |

---

## Response Format

### Success Response (200 OK)
```json
{
  "success": true,
  "message": "Lead updated successfully",
  "leadId": "550e8400-e29b-41d4-a716-446655440000",
  "bookingReceived": true,
  "statusUpdated": true
}
```

### Error Responses

#### 400 Bad Request - Missing CRM_ID
```json
{
  "error": "CRM_ID is required"
}
```

#### 500 Internal Server Error
```json
{
  "error": "Internal server error",
  "message": "Error details here"
}
```

---

## Example Payloads

### Example 1: Initial Message Sent
```json
{
  "Airtable_Record_ID": "recABC123xyz",
  "CRM_ID": "550e8400-e29b-41d4-a716-446655440000",
  "SalesAPE_Status": "Initial Message Sent",
  "SalesAPE_Initial_Message_Sent": true,
  "SalesAPE_User_Engaged": false,
  "SalesAPE_Goal_Presented": false,
  "SalesAPE_Goal_Hit": false
}
```

### Example 2: User Engaged
```json
{
  "Airtable_Record_ID": "recABC123xyz",
  "CRM_ID": "550e8400-e29b-41d4-a716-446655440000",
  "SalesAPE_Status": "User Engaged",
  "SalesAPE_Initial_Message_Sent": true,
  "SalesAPE_User_Engaged": true,
  "SalesAPE_Goal_Presented": false,
  "SalesAPE_Goal_Hit": false
}
```

### Example 3: Goal Hit (Booking Made)
```json
{
  "Airtable_Record_ID": "recABC123xyz",
  "CRM_ID": "550e8400-e29b-41d4-a716-446655440000",
  "SalesAPE_Status": "Goal Hit",
  "SalesAPE_Initial_Message_Sent": true,
  "SalesAPE_User_Engaged": true,
  "SalesAPE_Goal_Presented": true,
  "SalesAPE_Goal_Hit": true,
  "Booking_Date": "2024-01-15",
  "Booking_Time": "14:30",
  "Event_Type": "Meeting Booked",
  "Calendar_Link": "https://www.edgetalentdiary.co.uk/book/tanya-booking"
}
```

### Example 4: Conversation Summary
```json
{
  "Airtable_Record_ID": "recABC123xyz",
  "CRM_ID": "550e8400-e29b-41d4-a716-446655440000",
  "SalesAPE_Status": "Conversation Complete",
  "SalesAPE_Goal_Hit": true,
  "Post_Conversation_Summary": true,
  "Conversation_Summary": "Lead expressed strong interest and booked appointment for January 15th at 2:30 PM.",
  "Full_Conversation": "AI: Hello! I'm reaching out from Edge Talent...\nLead: Hi, I'm interested...\n[Full transcript]",
  "Portal_Link": "https://salesape.com/portal/conv-12345"
}
```

### Example 5: Opted Out
```json
{
  "Airtable_Record_ID": "recABC123xyz",
  "CRM_ID": "550e8400-e29b-41d4-a716-446655440000",
  "SalesAPE_Status": "Opted Out",
  "Not_Interested_Opted_Out": true,
  "Follow_Ups_Ended": true
}
```

---

## CRM Behavior & Automatic Actions

### When `SalesAPE_Goal_Hit` is `true`:
- Lead status is automatically updated to **"Booked"** in the CRM
- `is_confirmed` flag is set to `true`
- If `Booking_Date` is provided, it's saved to the lead's `date_booked` field
- If `Booking_Time` is provided, it's saved to the lead's `time_booked` field
- Real-time notifications are sent to CRM users

### Status Flow Tracking:
The CRM tracks the following status progression:
1. **Queued** → Lead sent to SalesAPE, waiting for AI to start
2. **Initial Message Sent** → First message delivered
3. **User Engaged** → Lead has responded
4. **Goal Presented** → Booking CTA shown to lead
5. **Goal Hit** → Lead booked an appointment
6. **Opted Out** → Lead declined/opted out
7. **Follow-ups Ended** → Conversation completed

---

## Testing the Webhook

### Health Check Endpoint
You can verify the webhook is accessible:
```
GET https://edgetalentcrm-production.up.railway.app/api/salesape-webhook/health
```

Response:
```json
{
  "status": "healthy",
  "configured": true,
  "webhookUrl": "https://edgetalentcrm-production.up.railway.app/api/salesape-webhook/update",
  "note": "Configure SalesApe to send webhooks to the webhookUrl above"
}
```

### Test Endpoint
```
GET https://edgetalentcrm-production.up.railway.app/api/salesape-webhook/test-log
```

---

## Error Handling

### Common Errors

1. **Missing CRM_ID**
   - **Error:** `400 Bad Request`
   - **Response:** `{ "error": "CRM_ID is required" }`
   - **Solution:** Always include `CRM_ID` in the webhook payload

2. **Invalid CRM_ID**
   - **Error:** `500 Internal Server Error`
   - **Response:** `{ "error": "Failed to update lead" }`
   - **Solution:** Ensure the `CRM_ID` matches an existing lead in the CRM

3. **Network/Timeout Errors**
   - The webhook has a 15-second timeout
   - If your request takes longer, it will fail
   - Consider sending updates asynchronously

---

## Best Practices

1. **Always Include CRM_ID**: This is the only required field and is essential for matching updates to leads.

2. **Send Updates Incrementally**: Send webhooks as status changes occur, rather than waiting to send all updates at once.

3. **Include Booking Details**: When `SalesAPE_Goal_Hit` is `true`, always include `Booking_Date` and `Booking_Time` if available.

4. **Handle Retries**: If you receive a 500 error, implement exponential backoff retry logic.

5. **Idempotency**: The webhook is idempotent - sending the same update multiple times is safe.

---

## Integration Flow

### Complete Integration Flow:

1. **CRM Sends Lead to SalesAPE**
   - CRM sends lead data to SalesAPE's Airtable
   - Includes: Name, Phone, Email, CRM ID, Calendar Link
   - SalesAPE receives lead and starts AI conversation

2. **SalesAPE Updates CRM via Webhook**
   - As conversation progresses, SalesAPE sends status updates
   - CRM updates lead status in real-time
   - CRM users see live updates in dashboard

3. **Booking Made**
   - When lead books, SalesAPE sends webhook with `SalesAPE_Goal_Hit: true`
   - CRM automatically marks lead as "Booked"
   - Booking details are saved
   - CRM sends confirmation to SalesAPE (optional)

4. **Conversation Complete**
   - SalesAPE sends final summary with conversation transcript
   - CRM stores summary for reference
   - Lead status is finalized

---

## Support & Contact

For technical support or questions about this integration:
- Check the health endpoint for system status
- Review error responses for troubleshooting
- Contact Edge Talent CRM support for assistance

---

## Version History

- **v1.0** (Current) - Initial webhook implementation
  - Supports status updates
  - Supports booking notifications
  - Supports conversation summaries

---

## Additional Notes

- The webhook endpoint is rate-limited to prevent abuse
- All timestamps should be in ISO 8601 format
- Dates should be in YYYY-MM-DD format
- Times should be in 24-hour HH:MM format
- The CRM will log all webhook requests for debugging purposes

