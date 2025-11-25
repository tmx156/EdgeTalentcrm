# SalesApe Dashboard - Complete Feature Plan

## 🎯 Overview

A dedicated page to monitor SalesApe AI activity in real-time, view conversation history, manage the queue, and track performance.

---

## 📋 Page Structure

### **Route:** `/salesape` or `/ai-assistant`
### **Access:** Admin and Bookers (configurable)
### **Layout:** Full-width dashboard with multiple sections

---

## 🎨 Dashboard Sections

### 1. **Real-Time Activity Monitor** (Top Section)
Shows what SalesApe is doing RIGHT NOW

```
┌─────────────────────────────────────────────────────────────┐
│  🤖 SalesApe Live Activity                                  │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ● ACTIVE NOW                                               │
│  Currently engaging with: Sarah Johnson                     │
│  Status: Waiting for response (2m 34s)                      │
│  Last message: "Would you like to book a photoshoot?"       │
│                                                              │
│  📊 Today's Stats:                                          │
│  • Messages Sent: 47                                        │
│  • Leads Engaged: 23                                        │
│  • Bookings Made: 5                                         │
│  • Response Rate: 68%                                       │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Features:**
- ✅ Live status indicator (Active/Idle/Paused)
- ✅ Current lead being contacted
- ✅ Time since last activity
- ✅ Real-time message preview
- ✅ Today's performance metrics
- ✅ Auto-refreshes every 5 seconds

---

### 2. **Queue Management** (Left Side)
See all leads waiting to be contacted by SalesApe

```
┌─────────────────────────────────────────────────────────────┐
│  📋 SalesApe Queue (12 leads)                               │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  🔵 IN PROGRESS (3)                                         │
│  ├─ Sarah Johnson - Engaged (5m ago)                        │
│  ├─ Mike Brown - Initial message sent (12m ago)             │
│  └─ Lisa White - Waiting for response (1h ago)              │
│                                                              │
│  ⏳ QUEUED (9)                                              │
│  ├─ John Smith - Scheduled for 2:30 PM                      │
│  ├─ Emma Davis - Scheduled for 2:45 PM                      │
│  ├─ Tom Wilson - Scheduled for 3:00 PM                      │
│  └─ ... 6 more                                              │
│                                                              │
│  [+ Add Lead to Queue]  [⏸️ Pause Queue]                    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Features:**
- ✅ Shows all leads in SalesApe queue
- ✅ Status indicators (In Progress, Queued, Completed)
- ✅ Time since last activity
- ✅ Drag-and-drop to reorder queue
- ✅ Add/remove leads from queue
- ✅ Pause/resume queue
- ✅ Priority flags for urgent leads

---

### 3. **Conversation Viewer** (Center/Right)
View full conversation history with each lead

```
┌─────────────────────────────────────────────────────────────┐
│  💬 Conversation: Sarah Johnson                             │
│  Status: User Engaged | Goal: Not Hit Yet                   │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  🤖 SalesApe (2:15 PM)                                      │
│  Hi Sarah! 👋 I noticed you were interested in our          │
│  photoshoot services. Would you like to book a session?     │
│                                                              │
│  👤 Sarah (2:18 PM)                                         │
│  Yes! I'm interested. What times do you have available?     │
│                                                              │
│  🤖 SalesApe (2:18 PM)                                      │
│  Great! I can offer you these times:                        │
│  • Monday 2:00 PM                                           │
│  • Tuesday 10:00 AM                                         │
│  • Wednesday 3:00 PM                                        │
│  Click here to book: [Calendar Link]                        │
│                                                              │
│  👤 Sarah (2:20 PM)                                         │
│  Perfect! I'll check the link now.                          │
│                                                              │
│  ⏳ Waiting for booking confirmation...                     │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│  📊 Conversation Stats:                                     │
│  • Messages: 4 | Duration: 5m | Engagement: High            │
│  • Goal Presented: ✅ | Goal Hit: ⏳ Pending                │
│                                                              │
│  [📥 View Full Transcript] [🔗 SalesApe Portal]             │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Features:**
- ✅ Full conversation history
- ✅ Timestamps for each message
- ✅ Clear AI vs Human indicators
- ✅ Conversation status (Engaged, Goal Hit, etc.)
- ✅ Link to full transcript
- ✅ Link to SalesApe portal
- ✅ Export conversation as PDF
- ✅ Search conversations

---

### 4. **Performance Analytics** (Bottom)
Track SalesApe's performance over time

```
┌─────────────────────────────────────────────────────────────┐
│  📊 SalesApe Performance                                    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  [Today] [This Week] [This Month] [All Time]                │
│                                                              │
│  ┌─────────────┬─────────────┬─────────────┬──────────────┐│
│  │ Leads Sent  │ Engaged     │ Bookings    │ Conversion   ││
│  │    156      │    89 (57%) │   23 (15%)  │    25.8%     ││
│  └─────────────┴─────────────┴─────────────┴──────────────┘│
│                                                              │
│  📈 Engagement Funnel:                                      │
│  ████████████████████ 156 Initial Messages Sent             │
│  ███████████ 89 Users Engaged (57%)                         │
│  ████ 23 Bookings Made (15% of total, 26% of engaged)       │
│                                                              │
│  ⏱️ Average Response Time: 4m 32s                           │
│  💬 Average Messages per Lead: 3.2                          │
│  ⭐ Goal Hit Rate: 25.8%                                    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Features:**
- ✅ Time period filters (Today, Week, Month, All Time)
- ✅ Key metrics (Sent, Engaged, Booked, Conversion)
- ✅ Visual funnel chart
- ✅ Response time analytics
- ✅ Engagement rate tracking
- ✅ Export reports as CSV/PDF

---

### 5. **Lead Status Cards** (Grid View Option)
Alternative view showing all leads as cards

```
┌──────────────┬──────────────┬──────────────┬──────────────┐
│ Sarah Johnson│ Mike Brown   │ Lisa White   │ John Smith   │
│ 🔵 Engaged   │ 🟡 Sent      │ 🟢 Booked    │ ⏳ Queued    │
│ 5m ago       │ 12m ago      │ 1h ago       │ Scheduled    │
│ [View Chat]  │ [View Chat]  │ [View Chat]  │ [Start Now]  │
└──────────────┴──────────────┴──────────────┴──────────────┘
```

---

## 🔧 Technical Implementation

### **Data Sources:**

1. **Real-Time Updates:**
   - WebSocket connection to SalesApe API (if available)
   - Polling our CRM database for SalesApe status updates
   - Webhook notifications from SalesApe

2. **Database Fields (Already in CRM):**
   ```javascript
   // From leads table
   - salesape_record_id
   - salesape_status
   - salesape_initial_message_sent
   - salesape_user_engaged
   - salesape_goal_presented
   - salesape_goal_hit
   - salesape_follow_ups_ended
   - salesape_opted_out
   - salesape_conversation_summary
   - salesape_full_transcript
   - salesape_portal_link
   - salesape_sent_at
   - salesape_last_updated
   ```

3. **New Database Table (Optional):**
   ```sql
   CREATE TABLE salesape_queue (
     id UUID PRIMARY KEY,
     lead_id UUID REFERENCES leads(id),
     status VARCHAR(50), -- 'queued', 'in_progress', 'completed', 'failed'
     priority INTEGER DEFAULT 0,
     scheduled_at TIMESTAMP,
     started_at TIMESTAMP,
     completed_at TIMESTAMP,
     created_at TIMESTAMP DEFAULT NOW()
   );
   ```

4. **New Database Table for Messages:**
   ```sql
   CREATE TABLE salesape_messages (
     id UUID PRIMARY KEY,
     lead_id UUID REFERENCES leads(id),
     sender VARCHAR(20), -- 'salesape' or 'lead'
     message TEXT,
     sent_at TIMESTAMP,
     read_at TIMESTAMP,
     created_at TIMESTAMP DEFAULT NOW()
   );
   ```

---

## 🎨 UI Components to Build

### **Frontend (React):**

1. **`/client/src/pages/SalesApe.js`** - Main dashboard page
2. **`/client/src/components/SalesApe/`** folder with:
   - `LiveActivityMonitor.js` - Real-time status
   - `QueueManager.js` - Queue list and controls
   - `ConversationViewer.js` - Chat interface
   - `PerformanceAnalytics.js` - Stats and charts
   - `LeadStatusCard.js` - Individual lead cards
   - `SalesApeControls.js` - Pause/resume/add buttons

### **Backend (Node.js/Express):**

1. **`/server/routes/salesape-dashboard.js`** - New API routes:
   ```javascript
   GET  /api/salesape-dashboard/status        // Current activity
   GET  /api/salesape-dashboard/queue         // Queue list
   GET  /api/salesape-dashboard/conversation/:leadId  // Chat history
   GET  /api/salesape-dashboard/analytics     // Performance stats
   POST /api/salesape-dashboard/queue/add     // Add lead to queue
   POST /api/salesape-dashboard/queue/remove  // Remove from queue
   POST /api/salesape-dashboard/queue/pause   // Pause queue
   POST /api/salesape-dashboard/queue/resume  // Resume queue
   ```

2. **WebSocket Events:**
   ```javascript
   // Real-time updates
   socket.on('salesape_status_update', (data) => {
     // Update live activity monitor
   });
   
   socket.on('salesape_message', (data) => {
     // Update conversation viewer
   });
   
   socket.on('salesape_queue_update', (data) => {
     // Update queue list
   });
   ```

---

## 📊 Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Lead added to CRM                                        │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Admin clicks "Send to SalesApe" button                   │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Lead added to SalesApe queue in CRM                      │
│    - Status: "queued"                                       │
│    - Visible in Queue Manager                               │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. CRM sends lead to SalesApe API                           │
│    - POST to SalesApe Airtable                              │
│    - Status updates to "in_progress"                        │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. SalesApe AI engages with lead                            │
│    - Sends messages via SMS/WhatsApp                        │
│    - Sends webhook updates to CRM                           │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. CRM receives webhook updates                             │
│    - Updates lead status                                    │
│    - Stores conversation messages                           │
│    - Updates Live Activity Monitor                          │
│    - Updates Conversation Viewer                            │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 7. Lead books appointment                                   │
│    - SalesApe sends webhook with booking info               │
│    - CRM updates status to "Booked"                         │
│    - Removes from queue (status: "completed")               │
│    - Shows in Performance Analytics                         │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎯 Key Features

### **Real-Time Capabilities:**
- ✅ Live status updates (what SalesApe is doing now)
- ✅ Real-time conversation viewing
- ✅ Queue updates as leads are processed
- ✅ Performance metrics updating live

### **Queue Management:**
- ✅ See all leads waiting for SalesApe
- ✅ Add/remove leads manually
- ✅ Reorder queue priority
- ✅ Pause/resume processing
- ✅ Schedule leads for specific times

### **Conversation Viewing:**
- ✅ Full chat history for each lead
- ✅ See what SalesApe said
- ✅ See lead responses
- ✅ Engagement indicators
- ✅ Link to SalesApe portal for full details

### **Analytics:**
- ✅ Conversion rates
- ✅ Engagement rates
- ✅ Response times
- ✅ Booking success rate
- ✅ Time-based filtering

---

## 🚀 Implementation Phases

### **Phase 1: Basic Dashboard (Week 1)**
- ✅ Create SalesApe page route
- ✅ Build queue manager component
- ✅ Display leads sent to SalesApe
- ✅ Show basic status (Sent, Engaged, Booked)
- ✅ Add "Send to SalesApe" button on leads page

### **Phase 2: Conversation Viewer (Week 2)**
- ✅ Store conversation messages from webhooks
- ✅ Build conversation viewer component
- ✅ Display full chat history
- ✅ Link to SalesApe portal
- ✅ Export transcripts

### **Phase 3: Real-Time Updates (Week 3)**
- ✅ Implement WebSocket connections
- ✅ Live activity monitor
- ✅ Real-time queue updates
- ✅ Live conversation updates
- ✅ Auto-refresh every 5 seconds

### **Phase 4: Analytics (Week 4)**
- ✅ Performance metrics
- ✅ Conversion tracking
- ✅ Engagement funnel
- ✅ Charts and graphs
- ✅ Export reports

---

## 🎨 Wireframe Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│  Navigation: [Dashboard] [Leads] [Calendar] [SalesApe] [Reports]   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  🤖 SalesApe Dashboard                                              │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Real-Time Activity Monitor                                   │  │
│  │  ● Active | Currently: Sarah Johnson | 2m 34s ago            │  │
│  │  Today: 47 sent | 23 engaged | 5 booked                      │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌────────────────────┬────────────────────────────────────────┐  │
│  │  📋 Queue (12)     │  💬 Conversation: Sarah Johnson        │  │
│  │                    │                                         │  │
│  │  🔵 IN PROGRESS    │  🤖 SalesApe: Hi Sarah! Would you...   │  │
│  │  • Sarah Johnson   │  👤 Sarah: Yes! I'm interested...      │  │
│  │  • Mike Brown      │  🤖 SalesApe: Great! Here are...       │  │
│  │  • Lisa White      │  👤 Sarah: Perfect! I'll check...      │  │
│  │                    │                                         │  │
│  │  ⏳ QUEUED         │  ⏳ Waiting for booking...              │  │
│  │  • John Smith      │                                         │  │
│  │  • Emma Davis      │  [View Full] [Export] [Portal]         │  │
│  │  • Tom Wilson      │                                         │  │
│  │  ... 6 more        │                                         │  │
│  │                    │                                         │  │
│  │  [+ Add Lead]      │                                         │  │
│  │  [⏸️ Pause]        │                                         │  │
│  └────────────────────┴────────────────────────────────────────┘  │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  📊 Performance Analytics                                     │  │
│  │  [Today] [Week] [Month] [All Time]                           │  │
│  │                                                               │  │
│  │  156 Sent | 89 Engaged (57%) | 23 Booked (15%) | 25.8% Conv │  │
│  │  ████████████████████ Funnel Chart                           │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## ❓ Questions to Answer

### **1. Conversation Storage:**
**Q:** Does SalesApe provide a way to fetch conversation history via API?
**Options:**
- A) Yes - we can fetch via API (best option)
- B) No - we store from webhook updates only
- C) They provide a portal link only

### **2. Real-Time Updates:**
**Q:** Does SalesApe support webhooks for real-time updates?
**Options:**
- A) Yes - webhook on every message (ideal)
- B) Yes - webhook on status changes only
- C) No - we need to poll their API

### **3. Queue Control:**
**Q:** Can we control when SalesApe contacts leads?
**Options:**
- A) Yes - we send leads one at a time
- B) No - SalesApe manages timing automatically
- C) Hybrid - we can pause/resume

---

## 🎯 Next Steps

### **What I Need from You:**

1. **Confirm the plan** - Does this match what you want?
2. **Priority features** - Which sections are most important?
3. **SalesApe API access** - Do you have API documentation?
4. **Timeline** - When do you need this ready?

### **What I'll Build:**

**Option A: Full Dashboard (4 weeks)**
- All features listed above
- Complete real-time monitoring
- Full conversation viewer
- Advanced analytics

**Option B: MVP Dashboard (1 week)**
- Basic queue view
- Simple status tracking
- Link to SalesApe portal
- Basic stats

**Option C: Phased Approach (Recommended)**
- Week 1: Queue + Basic Status
- Week 2: Conversation Viewer
- Week 3: Real-Time Updates
- Week 4: Analytics

---

## 💡 Additional Features (Future)

- 🔔 Notifications when bookings happen
- 📧 Email alerts for failed engagements
- 🎯 A/B testing different message templates
- 📊 Lead scoring based on engagement
- 🤖 Manual intervention option (take over conversation)
- 📱 Mobile app for monitoring on-the-go
- 🔄 Auto-retry failed leads
- 📅 Schedule leads for optimal times

---

**Ready to start building?** Let me know:
1. Which option (A, B, or C)?
2. Any changes to the plan?
3. Do you have SalesApe API documentation?

I can start building the MVP (Option B) right now if you want! 🚀

