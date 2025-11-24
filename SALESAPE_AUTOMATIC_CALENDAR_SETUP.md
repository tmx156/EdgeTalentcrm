# SalesApe Automatic Calendar Booking Setup

## 🎯 Goal: Fully Automated Booking Flow

Lead receives message → Clicks calendar link → Books appointment → Automatically appears in CRM + Calendar

---

## 📋 Step-by-Step Setup

### Step 1: Choose a Calendar Booking Platform

Pick one of these (all work with SalesApe):

#### **Option A: Calendly** (Most Popular)
- Website: https://calendly.com
- Free Plan: 1 event type
- Paid Plan: $10/month (unlimited event types)
- ✅ Easy setup
- ✅ Great UI for leads
- ✅ Integrates with Google Calendar, Outlook, iCloud

#### **Option B: Cal.com** (Open Source)
- Website: https://cal.com
- Free Plan: Available
- ✅ More customizable
- ✅ Self-hostable option
- ✅ Good for privacy

#### **Option C: Google Calendar Appointment Slots**
- Website: Google Calendar (built-in)
- Free
- ✅ No extra tools needed
- ⚠️ Less professional looking

**RECOMMENDED:** Start with **Calendly** (easiest)

---

### Step 2: Create Your Booking Link in Calendly

1. **Sign up at Calendly.com**
   - Use your business email

2. **Connect Your Calendar**
   - Settings → Calendar Connection
   - Connect Google Calendar or Outlook
   - This syncs your availability

3. **Create Event Type**
   - Click "Create" → "Event Type"
   - Name: "Photoshoot Booking" (or whatever you offer)
   - Duration: 30 minutes (or your typical session time)
   - Location: 
     - Add your studio address, OR
     - Add Zoom/phone if virtual consultation

4. **Set Your Availability**
   - When are you available for bookings?
   - Set your working hours
   - Add buffer time between bookings if needed

5. **Customize the Booking Page**
   - Add your logo
   - Add description of what the appointment is for
   - Add any questions you want to ask (optional)

6. **Get Your Booking Link**
   - Copy your Calendly link (looks like: `https://calendly.com/your-name/photoshoot`)
   - This is what SalesApe will send to leads

---

### Step 3: Configure SalesApe to Use Your Calendar Link

**Send this to SalesApe:**

```
Subject: Calendar Integration - Booking Link

Hi SalesApe Team,

We want to use automatic calendar booking. Here's our setup:

📅 BOOKING LINK:
https://calendly.com/your-name/photoshoot

(Replace with your actual Calendly link)

WORKFLOW:
1. When a lead shows interest, send them this calendar link
2. Lead clicks and books their preferred time slot
3. When they book, send webhook to our CRM with:

{
  "CRM_ID": "lead-uuid-from-our-crm",
  "SalesAPE_Goal_Hit": true,
  "Booking_Date": "2025-11-25",
  "Booking_Time": "14:00",
  "Event_Type": "Photoshoot Session",
  "Calendar_Link": "https://calendly.com/your-name/photoshoot/abc123"
}

IMPORTANT:
- Booking_Date format: YYYY-MM-DD
- Booking_Time format: HH:MM (24-hour)
- Calendar_Link: The specific event URL (if available)

The webhook endpoint is:
https://edgetalentcrm-production.up.railway.app/api/salesape-webhook/update

QUESTIONS:
1. Can you detect when someone books via the Calendly link?
2. Can you extract the booking date/time from the calendar event?
3. Do you need a Calendly webhook/API access on our account?

Please let us know the best way to set this up on your end.

Thanks!
```

---

### Step 4: Set Up Calendly Webhook (If SalesApe Needs It)

SalesApe might need access to Calendly webhooks to detect bookings:

1. **In Calendly:**
   - Go to Integrations & Apps
   - Search for "Webhooks"
   - Create a webhook

2. **Webhook URL Options:**

   **Option A: Give to SalesApe**
   - SalesApe provides you their webhook URL
   - You add it to Calendly
   - Calendly notifies SalesApe when bookings happen

   **Option B: Direct to Your CRM (Advanced)**
   - Create webhook: `https://edgetalentcrm-production.up.railway.app/api/calendly-webhook`
   - (We'd need to create this endpoint in your CRM)

3. **Events to Subscribe:**
   - ✅ `invitee.created` (when someone books)
   - ✅ `invitee.canceled` (when someone cancels)

---

### Step 5: Test the Full Flow

1. **Test Booking:**
   - Open your Calendly link
   - Book a test appointment
   - Use a test lead's email from your CRM

2. **Check:**
   - ✅ Did booking appear in your Google Calendar?
   - ✅ Did you receive confirmation email?
   - ✅ Did SalesApe get notified?
   - ✅ Did your CRM update the lead status to "Booked"?

3. **Check CRM:**
   - Go to your CRM
   - Find the test lead
   - Status should be "Booked"
   - Date and time should be filled in

---

## 🔧 Alternative: Direct Calendly Integration (No SalesApe Middleman)

If SalesApe can't detect Calendly bookings, we can integrate directly:

### Create Calendly Webhook Endpoint in Your CRM

I can add this to your CRM:

```javascript
// New endpoint: /api/calendly-webhook
// Receives notifications directly from Calendly when bookings happen
```

**How it works:**
1. SalesApe sends lead the Calendly link
2. Lead books appointment
3. Calendly webhook fires → Your CRM
4. CRM matches email/phone to lead
5. CRM updates lead to "Booked" status
6. CRM notifies you

**Do you want me to build this?** (Takes ~30 minutes)

---

## 📊 Fully Automated Workflow

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Lead uploads to CRM                                      │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. CRM sends lead to SalesApe (via API or manual trigger)   │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. SalesApe AI contacts lead via SMS/WhatsApp               │
│    "Hi! Would you like to book a photoshoot?"               │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. Lead responds positively                                 │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. SalesApe sends Calendly link                             │
│    "Great! Book your time here: [Calendly Link]"            │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. Lead clicks link and books appointment                   │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 7. Calendly creates booking                                 │
│    ✅ Added to YOUR Google Calendar                         │
│    ✅ Confirmation email sent to lead                       │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 8. SalesApe detects booking and sends webhook to CRM:       │
│    POST /api/salesape-webhook/update                        │
│    {                                                         │
│      "CRM_ID": "lead-uuid",                                 │
│      "SalesAPE_Goal_Hit": true,                             │
│      "Booking_Date": "2025-11-25",                          │
│      "Booking_Time": "14:00"                                │
│    }                                                         │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 9. CRM automatically updates lead:                          │
│    ✅ Status → "Booked"                                     │
│    ✅ Date Booked → "2025-11-25"                            │
│    ✅ Time Booked → "14:00"                                 │
│    ✅ Booking appears in CRM calendar view                  │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 10. You see booking in:                                     │
│     ✅ Your CRM Dashboard                                   │
│     ✅ Your Google Calendar                                 │
│     ✅ Your phone calendar (synced)                         │
└─────────────────────────────────────────────────────────────┘

RESULT: Zero manual work! 🎉
```

---

## 💰 Cost Breakdown

| Service | Cost | Purpose |
|---------|------|---------|
| **Calendly** | $10/month | Calendar booking system |
| **SalesApe** | Your existing plan | AI lead engagement |
| **Railway** | ~$5-20/month | CRM hosting |
| **Supabase** | Free tier OK | Database |
| **TOTAL** | ~$15-30/month | Fully automated system |

---

## 🎯 Next Steps (Right Now)

### 1. **Sign up for Calendly** (5 minutes)
   - Go to https://calendly.com
   - Sign up with your business email
   - Choose free or paid plan

### 2. **Create Your Event Type** (5 minutes)
   - Create "Photoshoot Booking" event
   - Set duration (30 min or 1 hour?)
   - Add your location/address

### 3. **Get Your Booking Link** (1 minute)
   - Copy the link (e.g., `https://calendly.com/your-name/photoshoot`)

### 4. **Send to SalesApe** (2 minutes)
   - Use the email template above
   - Include your Calendly link
   - Ask how they'll integrate it

### 5. **I'll Help with Technical Setup** (30 minutes)
   - Do you want me to create a direct Calendly webhook endpoint?
   - Or do we rely on SalesApe to handle it?

---

## ❓ Questions for You

1. **Do you already have a calendar preference?** (Google Calendar, Outlook, etc.)
2. **What's the typical duration of your appointments?** (30 min, 1 hour?)
3. **Do you want me to build a direct Calendly → CRM integration?** (bypasses SalesApe for booking detection)
4. **What's your studio address** (or is it virtual consultations)?

Let me know and I'll help you get this set up! 🚀

---

**Ready to start?** Tell me:
- "Set up Calendly for me" → I'll guide you through it
- "Build direct Calendly integration" → I'll code it for you
- "Just help me message SalesApe" → I'll draft the perfect email

