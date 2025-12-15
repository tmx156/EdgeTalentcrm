# SalesAPE Webhook Setup - Quick Reference

## Webhook URL
```
https://edgetalentcrm-production.up.railway.app/api/salesape-webhook/update
```

## Authentication
**Currently:** No authentication required (open endpoint)

## Request Format
- **Method:** POST
- **Content-Type:** application/json

## Required Field
- `CRM_ID` (string) - The lead's unique identifier in our CRM

## Field Mappings

### Status Fields
| Your Field Name | Our Field Name | Type | Description |
|----------------|----------------|------|-------------|
| Airtable Record ID | `Airtable_Record_ID` | string | Your Airtable record ID |
| CRM ID | `CRM_ID` | string | **REQUIRED** - Lead ID from CRM |
| Status | `SalesAPE_Status` | string | Current status (e.g., "User Engaged", "Goal Hit") |
| Initial Message Sent | `SalesAPE_Initial_Message_Sent` | boolean | true/false |
| User Engaged | `SalesAPE_User_Engaged` | boolean | true/false |
| Goal Presented | `SalesAPE_Goal_Presented` | boolean | true/false |
| Goal Hit | `SalesAPE_Goal_Hit` | boolean | **IMPORTANT** - When true, CRM marks lead as "Booked" |
| Follow-ups Ended | `Follow_Ups_Ended` | boolean | true/false |
| Opted Out | `Not_Interested_Opted_Out` | boolean | true/false |

### Booking Fields (when booking is made)
| Your Field Name | Our Field Name | Type | Format |
|----------------|----------------|------|--------|
| Booking Date | `Booking_Date` | string | YYYY-MM-DD (e.g., "2024-01-15") |
| Booking Time | `Booking_Time` | string | HH:MM 24-hour (e.g., "14:30") |
| Event Type | `Event_Type` | string | "Meeting Booked" |
| Calendar Link | `Calendar_Link` | string | Full URL |

### Conversation Summary Fields (optional)
| Your Field Name | Our Field Name | Type | Description |
|----------------|----------------|------|-------------|
| Post Summary Flag | `Post_Conversation_Summary` | boolean | Set to true when sending summary |
| Summary | `Conversation_Summary` | string | Brief summary text |
| Full Transcript | `Full_Conversation` | string | Complete conversation |
| Portal Link | `Portal_Link` | string | Link to view in your portal |

## Example Payload

### Basic Status Update
```json
{
  "Airtable_Record_ID": "recABC123",
  "CRM_ID": "550e8400-e29b-41d4-a716-446655440000",
  "SalesAPE_Status": "User Engaged",
  "SalesAPE_Initial_Message_Sent": true,
  "SalesAPE_User_Engaged": true,
  "SalesAPE_Goal_Presented": false,
  "SalesAPE_Goal_Hit": false
}
```

### Booking Made (Goal Hit)
```json
{
  "Airtable_Record_ID": "recABC123",
  "CRM_ID": "550e8400-e29b-41d4-a716-446655440000",
  "SalesAPE_Status": "Goal Hit",
  "SalesAPE_Goal_Hit": true,
  "Booking_Date": "2024-01-15",
  "Booking_Time": "14:30",
  "Event_Type": "Meeting Booked"
}
```

## Response Format

### Success (200 OK)
```json
{
  "success": true,
  "message": "Lead updated successfully",
  "leadId": "550e8400-e29b-41d4-a716-446655440000",
  "bookingReceived": true,
  "statusUpdated": true
}
```

### Error (400 Bad Request)
```json
{
  "error": "CRM_ID is required"
}
```

## Important Notes

1. **CRM_ID is REQUIRED** - Every webhook must include this field
2. **Goal Hit = Booking** - When `SalesAPE_Goal_Hit` is `true`, the CRM automatically marks the lead as "Booked"
3. **Date Format** - Use YYYY-MM-DD format for dates
4. **Time Format** - Use 24-hour HH:MM format for times
5. **Idempotent** - Safe to send the same update multiple times

## Testing

### Health Check
```
GET https://edgetalentcrm-production.up.railway.app/api/salesape-webhook/health
```

### Test Endpoint
```
GET https://edgetalentcrm-production.up.railway.app/api/salesape-webhook/test-log
```

## Full Documentation
See `SALESAPE_WEBHOOK_DOCUMENTATION.md` for complete documentation with all details, error handling, and best practices.

