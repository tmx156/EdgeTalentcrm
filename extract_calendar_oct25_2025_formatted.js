require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function extractCalendarToCSV() {
  try {
    console.log('Fetching calendar data for October 25, 2025...');

    // Query for all leads booked on October 25, 2025
    const { data: leads, error } = await supabase
      .from('leads')
      .select('id, name, phone, date_booked, notes, status, postcode, email, booking_history')
      .gte('date_booked', '2025-10-25T00:00:00.000Z')
      .lt('date_booked', '2025-10-26T00:00:00.000Z')
      .is('deleted_at', null)
      .neq('postcode', 'ZZGHOST')
      .not('status', 'in', '(Cancelled,Rejected)')
      .order('date_booked', { ascending: true });

    if (error) {
      throw error;
    }

    console.log(`Found ${leads.length} bookings for October 25, 2025`);

    // Group leads by time slot
    const timeSlots = {};

    leads.forEach(lead => {
      const dateBooked = new Date(lead.date_booked);

      // Format time as HH:MM (24-hour format) - convert from UTC to UK time (BST = UTC+1)
      // October 25, 2025 is still in BST (ends last Sunday of October - Oct 26, 2025)
      const ukDate = new Date(dateBooked.getTime() + (1 * 60 * 60 * 1000)); // Add 1 hour for BST
      const hours = ukDate.getUTCHours().toString().padStart(2, '0');
      const minutes = ukDate.getUTCMinutes().toString().padStart(2, '0');
      const time = `${hours}:${minutes}`;

      if (!timeSlots[time]) {
        timeSlots[time] = [];
      }

      // Get person's name
      const name = (lead.name || '').replace(/,/g, ';');

      // Get phone number
      const phone = (lead.phone || '').replace(/,/g, ';');

      // Find which email account was used from booking history
      let emailAccount = '';
      if (lead.booking_history && Array.isArray(lead.booking_history)) {
        // Look for booking confirmation or email sent entries
        const emailEntries = lead.booking_history
          .filter(entry =>
            (entry.action === 'BOOKING_CONFIRMATION_SENT' || entry.action === 'EMAIL_SENT') &&
            entry.details
          )
          .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        // Check for emailAccountName first
        for (const entry of emailEntries) {
          if (entry.details.emailAccountName) {
            emailAccount = entry.details.emailAccountName;
            break;
          }
          // If no emailAccountName, check email body content for "Camry" or "Avensis"
          if (entry.details.body || entry.lead_snapshot?.email_body) {
            const emailBody = entry.details.body || entry.lead_snapshot?.email_body || '';
            if (emailBody.includes('Camry Models')) {
              emailAccount = 'Camry Models';
              break;
            } else if (emailBody.includes('Avensis Models')) {
              emailAccount = 'Avensis Models';
              break;
            }
          }
        }
      }

      // Combine all notes fields
      const notesArray = [];
      if (lead.notes) notesArray.push(lead.notes);
      if (lead.status && lead.status !== 'Booked') notesArray.push(`(${lead.status})`);
      const notes = notesArray.join(' | ').replace(/,/g, ';').replace(/\n/g, ' ').replace(/"/g, '""');

      timeSlots[time].push({ name, phone, notes, emailAccount });
    });

    // Generate all time slots from 10:00 to 17:45 (5:45 PM)
    const allTimeSlots = [];
    for (let hour = 10; hour < 18; hour++) {
      for (let minute = 0; minute < 60; minute += 15) {
        const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        allTimeSlots.push(timeStr);
        if (hour === 17 && minute === 45) break; // Stop at 17:45
      }
    }

    // Find the maximum number of bookings in any single time slot
    let maxBookings = 1;
    allTimeSlots.forEach(time => {
      const bookings = timeSlots[time] || [];
      if (bookings.length > maxBookings) {
        maxBookings = bookings.length;
      }
    });

    console.log(`📊 Max bookings in a single time slot: ${maxBookings}`);

    // Format data for CSV
    const csvRows = [];

    // Build CSV header dynamically based on max bookings
    const headerParts = ['Time'];
    for (let i = 1; i <= maxBookings; i++) {
      if (i === 1) {
        headerParts.push('Person\'s Name', 'Phone Number', 'Notes', 'Email Account');
      } else {
        headerParts.push(`Person\'s Name ${i}`, `Phone Number ${i}`, `Notes ${i}`, `Email Account ${i}`);
      }
    }
    csvRows.push(headerParts.join(','));

    // Process each time slot
    allTimeSlots.forEach(time => {
      const bookings = timeSlots[time] || [];

      if (bookings.length === 0) {
        // Empty row with correct number of columns
        const emptyRow = [time];
        for (let i = 0; i < maxBookings * 4; i++) {
          emptyRow.push('');
        }
        csvRows.push(emptyRow.join(','));
      } else {
        // Build row with all bookings for this time slot
        const row = [time];

        // Add all bookings for this time slot
        for (let i = 0; i < maxBookings; i++) {
          if (bookings[i]) {
            row.push(bookings[i].name);
            row.push(bookings[i].phone);
            row.push(bookings[i].notes);
            row.push(bookings[i].emailAccount || '');
          } else {
            // Fill empty columns for consistency
            row.push('', '', '', '');
          }
        }

        csvRows.push(row.join(','));
      }
    });

    // Write to CSV file
    const csvContent = csvRows.join('\n');
    const filename = 'calendar_oct25_2025.csv';

    fs.writeFileSync(filename, csvContent, 'utf8');

    console.log(`\nCalendar data exported successfully to ${filename}`);
    console.log(`Total bookings: ${leads.length}`);

    // Show preview
    console.log('\n--- Preview (first 10 rows) ---');
    csvRows.slice(0, 11).forEach(row => console.log(row));

    if (leads.length > 10) {
      console.log('...');
      console.log(`(${leads.length - 10} more bookings)`);
    }

  } catch (error) {
    console.error('Error extracting calendar data:', error.message);
    process.exit(1);
  }
}

// Run the extraction
extractCalendarToCSV();
