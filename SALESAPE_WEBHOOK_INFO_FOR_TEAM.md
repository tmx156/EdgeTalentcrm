# SalesApe Webhook Configuration Details

## 🎯 Quick Summary

Send this webhook URL and configuration to the SalesApe team so they can integrate with your CRM.

---

## 📍 Webhook URL

**Production URL:**
```
https://edgetalentcrm-production.up.railway.app/api/salesape-webhook/update
```

**Method:** `POST`  
**Content-Type:** `application/json`

---

## 🔐 Authentication

**No authentication required** for the webhook endpoint (it's designed to receive updates from SalesApe).

---

## 📤 What to Send SalesApe

### Email/Message Template:

```
Subject: EdgeTalent CRM - Webhook Integration Details

Hi SalesApe Team,

Please configure your system to send updates to our CRM using the following webhook:

WEBHOOK ENDPOINT:
https://edgetalentcrm-production.up.railway.app/api/salesape-webhook/update

METHOD: POST
CONTENT-TYPE: application/json

---

PAYLOAD FORMAT:

When sending updates about a lead, please use this format:

{
  "Airtable_Record_ID": "your-airtable-record-id",
  "CRM_ID": "lead-uuid-from-our-system",
  "SalesAPE_Status": "Status description",
  "SalesAPE_Initial_Message_Sent": true/false,
  "SalesAPE_User_Engaged": true/false,
  "SalesAPE_Goal_Presented": true/false,
  "SalesAPE_Goal_Hit": true/false,
  "Follow_Ups_Ended": true/false,
  "Not_Interested_Opted_Out": true/false,
  "Post_Conversation_Summary": true/false,
  "Conversation_Summary": "Summary text",
  "Full_Conversation": "Full transcript",
  "Portal_Link": "https://salesape.ai/conversation/xxx"
}

---

IMPORTANT: BOOKING INFORMATION

When a lead books an appointment through your calendar link, 
please include these additional fields:

{
  "CRM_ID": "lead-uuid",
  "SalesAPE_Goal_Hit": true,
  "Booking_Date": "2025-11-25",
  "Booking_Time": "14:30",
  "Event_Type": "Photoshoot Booking",
  "Calendar_Link": "https://calendar-link-if-available"
}

REQUIRED FIELDS FOR BOOKINGS:
- Booking_Date (format: YYYY-MM-DD)
- Booking_Time (format: HH:MM in 24-hour time)
- SalesAPE_Goal_Hit (must be true)

This will automatically:
✓ Update the lead status to "Booked" in our CRM
✓ Store the appointment date and time
✓ Mark the lead as confirmed
✓ Display the booking in our calendar and analytics

---

TESTING:

Health Check:
GET https://edgetalentcrm-production.up.railway.app/api/salesape-webhook/health

Test Update:
POST https://edgetalentcrm-production.up.railway.app/api/salesape-webhook/update
{
  "CRM_ID": "test-lead-id",
  "SalesAPE_Status": "Testing",
  "SalesAPE_Initial_Message_Sent": true
}

---

Please confirm receipt and let us know if you need any clarification.

Thank you!
EdgeTalent Team
```

---

## 📋 Field Specifications

### Standard Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `CRM_ID` | String (UUID) | **Yes** | The lead ID from our CRM |
| `Airtable_Record_ID` | String | No | Your Airtable record ID |
| `SalesAPE_Status` | String | No | Current status description |
| `SalesAPE_Initial_Message_Sent` | Boolean | No | Has first message been sent |
| `SalesAPE_User_Engaged` | Boolean | No | Has user responded |
| `SalesAPE_Goal_Presented` | Boolean | No | Has goal been presented |
| `SalesAPE_Goal_Hit` | Boolean | No | Has goal been achieved |
| `Follow_Ups_Ended` | Boolean | No | Follow-up sequence complete |
| `Not_Interested_Opted_Out` | Boolean | No | User opted out |
| `Post_Conversation_Summary` | Boolean | No | Is this a final summary |
| `Conversation_Summary` | String | No | Brief conversation summary |
| `Full_Conversation` | String | No | Complete transcript |
| `Portal_Link` | String | No | Link to SalesApe portal |

### Booking Fields (When Appointment is Booked)

| Field | Type | Required | Format | Example |
|-------|------|----------|--------|---------|
| `Booking_Date` | String | **Yes** | YYYY-MM-DD | "2025-11-25" |
| `Booking_Time` | String | **Yes** | HH:MM (24hr) | "14:30" |
| `Event_Type` | String | No | Any string | "Photoshoot Booking" |
| `Calendar_Link` | String | No | URL | "https://cal.com/event/xxx" |

---

## 📝 Example Payloads

### Example 1: Initial Message Sent
```json
{
  "CRM_ID": "550e8400-e29b-41d4-a716-446655440000",
  "Airtable_Record_ID": "recABC123",
  "SalesAPE_Status": "Initial Message Sent",
  "SalesAPE_Initial_Message_Sent": true,
  "SalesAPE_User_Engaged": false,
  "SalesAPE_Goal_Hit": false
}
```

### Example 2: User Engaged
```json
{
  "CRM_ID": "550e8400-e29b-41d4-a716-446655440000",
  "SalesAPE_Status": "User Engaged",
  "SalesAPE_Initial_Message_Sent": true,
  "SalesAPE_User_Engaged": true,
  "SalesAPE_Goal_Presented": false,
  "SalesAPE_Goal_Hit": false
}
```

### Example 3: Booking Made ⭐ (Most Important)
```json
{
  "CRM_ID": "550e8400-e29b-41d4-a716-446655440000",
  "Airtable_Record_ID": "recABC123",
  "SalesAPE_Status": "Booking Confirmed",
  "SalesAPE_Initial_Message_Sent": true,
  "SalesAPE_User_Engaged": true,
  "SalesAPE_Goal_Presented": true,
  "SalesAPE_Goal_Hit": true,
  "Booking_Date": "2025-11-25",
  "Booking_Time": "14:30",
  "Event_Type": "Photoshoot Session",
  "Calendar_Link": "https://calendar.app/event/abc123",
  "Conversation_Summary": "Lead excited about photoshoot, booked for next Tuesday",
  "Portal_Link": "https://salesape.ai/conversation/abc123"
}
```

### Example 4: Not Interested
```json
{
  "CRM_ID": "550e8400-e29b-41d4-a716-446655440000",
  "SalesAPE_Status": "Not Interested",
  "Not_Interested_Opted_Out": true,
  "Follow_Ups_Ended": true,
  "Conversation_Summary": "Lead not interested at this time",
  "Portal_Link": "https://salesape.ai/conversation/abc123"
}
```

---

## ✅ What Happens in the CRM

When SalesApe sends webhook data:

1. **Standard Updates:**
   - Lead's SalesApe status fields are updated
   - Conversation summaries and transcripts are stored
   - Portal link is saved for reference

2. **When Booking is Made** (`SalesAPE_Goal_Hit: true` + booking fields):
   - ✅ Lead status changes to "Booked"
   - 📅 Booking date and time are saved
   - ✉️ Lead is marked as confirmed
   - 📊 Booking appears in calendar and analytics
   - 🔔 Can trigger notifications to admins/bookers

---

## 🧪 Testing the Integration

### 1. Health Check
```bash
curl https://edgetalentcrm-production.up.railway.app/api/salesape-webhook/health
```

Expected Response:
```json
{
  "status": "healthy",
  "configured": true,
  "endpoints": {
    "webhook": "/api/salesape-webhook/update",
    "trigger": "/api/salesape-webhook/trigger/:leadId",
    "meetingBooked": "/api/salesape-webhook/meeting-booked/:leadId",
    "testLog": "/api/salesape-webhook/test-log"
  }
}
```

### 2. Test Update (Replace with real lead ID)
```bash
curl -X POST https://edgetalentcrm-production.up.railway.app/api/salesape-webhook/update \
  -H "Content-Type: application/json" \
  -d '{
    "CRM_ID": "your-actual-lead-id-here",
    "SalesAPE_Status": "Testing Webhook",
    "SalesAPE_Initial_Message_Sent": true
  }'
```

### 3. Test Booking Update
```bash
curl -X POST https://edgetalentcrm-production.up.railway.app/api/salesape-webhook/update \
  -H "Content-Type: application/json" \
  -d '{
    "CRM_ID": "your-actual-lead-id-here",
    "SalesAPE_Status": "Booking Confirmed",
    "SalesAPE_Goal_Hit": true,
    "Booking_Date": "2025-12-01",
    "Booking_Time": "15:00",
    "Event_Type": "Test Booking"
  }'
```

---

## 🔍 Monitoring & Troubleshooting

### Check Railway Logs

Look for these messages when webhook is received:

```
✅ Success Messages:
📥 Received update from SalesApe: {...}
✅ Lead updated with SalesApe data: {...}
📅 Booking information received: {...}
🎯 SalesApe achieved goal for lead: xxx
```

```
❌ Error Messages:
❌ Error updating lead: {...}
❌ Webhook error: {...}
```

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| 400 Error | Missing `CRM_ID` | Ensure CRM_ID is included in payload |
| 404 Error | Invalid lead ID | Verify the CRM_ID exists in database |
| 500 Error | Server error | Check Railway logs for details |
| Booking not showing | Missing booking fields | Include `Booking_Date` and `Booking_Time` |
| Status not updated | `SalesAPE_Goal_Hit` is false | Set to `true` when booking made |

---

## 📞 Support

If you encounter any issues:
1. Check Railway logs: https://railway.app/dashboard
2. Verify webhook URL is correct
3. Ensure payload format matches specifications
4. Test with curl commands above
5. Contact SalesApe if fields are missing

---

## 🎯 Key Points for SalesApe

1. ✅ **Webhook URL:** `https://edgetalentcrm-production.up.railway.app/api/salesape-webhook/update`
2. ✅ **Method:** POST
3. ✅ **Required Field:** `CRM_ID` (the lead UUID from our system)
4. ✅ **For Bookings:** Include `Booking_Date`, `Booking_Time`, and set `SalesAPE_Goal_Hit: true`
5. ✅ **No Authentication:** Webhook is open (secured by Railway)

---

## 📊 Integration Flow

```
1. CRM sends lead to SalesApe
   ↓
2. SalesApe AI engages with lead
   ↓
3. SalesApe sends status updates via webhook
   ↓
4. CRM updates lead record
   ↓
5. If booking made: SalesApe includes booking fields
   ↓
6. CRM automatically marks lead as "Booked"
   ↓
7. Booking appears in CRM calendar
```

---

**Last Updated:** November 24, 2025
**Railway Deployment:** https://edgetalentcrm-production.up.railway.app

