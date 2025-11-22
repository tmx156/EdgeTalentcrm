const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Load environment variables or use defaults
const supabaseUrl = process.env.SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'your-anon-key';

// Initialize Supabase client
const supabase = createClient(supabaseUrl, supabaseKey);

async function extractCalendarDataForOct25() {
  try {
    console.log('📅 Extracting calendar data for October 25, 2025...');
    
    // Query leads table directly for appointments on October 25, 2025
    const { data: leads, error } = await supabase
      .from('leads')
      .select('id, name, phone, date_booked, notes, booking_notes, appointment_notes, status')
      .gte('date_booked', '2025-10-25T00:00:00.000Z')
      .lt('date_booked', '2025-10-26T00:00:00.000Z')
      .order('date_booked', { ascending: true });

    if (error) {
      console.error('❌ Database error:', error);
      return;
    }

    console.log(`📊 Total appointments found: ${leads?.length || 0}`);

    if (!leads || leads.length === 0) {
      console.log('❌ No appointments found for October 25, 2025');
      return;
    }

    // Prepare CSV data
    const csvHeader = 'Time,Person\'s Name,Phone Number,Notes\n';
    let csvContent = csvHeader;

    leads.forEach(appointment => {
      const appointmentTime = new Date(appointment.date_booked);
      const timeStr = appointmentTime.toLocaleTimeString('en-GB', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false 
      });
      
      const name = appointment.name || 'N/A';
      const phone = appointment.phone || 'N/A';
      
      // Get notes from various possible fields
      let notes = '';
      if (appointment.notes) {
        notes = appointment.notes;
      } else if (appointment.booking_notes) {
        notes = appointment.booking_notes;
      } else if (appointment.appointment_notes) {
        notes = appointment.appointment_notes;
      } else {
        notes = 'No notes';
      }

      // Escape CSV values (handle commas and quotes)
      const escapeCsvValue = (value) => {
        if (value.includes(',') || value.includes('"') || value.includes('\n')) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      };

      csvContent += `${timeStr},${escapeCsvValue(name)},${escapeCsvValue(phone)},${escapeCsvValue(notes)}\n`;
    });

    // Write to CSV file
    const filename = `calendar_oct25_2025.csv`;
    fs.writeFileSync(filename, csvContent);

    console.log(`✅ CSV file created: ${filename}`);
    console.log(`📊 Total appointments exported: ${leads.length}`);
    
    // Display preview of the data
    console.log('\n📋 Preview of exported data:');
    console.log('Time\t\tName\t\t\tPhone\t\t\tNotes');
    console.log('─'.repeat(80));
    
    leads.slice(0, 10).forEach(appointment => {
      const appointmentTime = new Date(appointment.date_booked);
      const timeStr = appointmentTime.toLocaleTimeString('en-GB', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false 
      });
      
      const name = (appointment.name || 'N/A').substring(0, 15);
      const phone = (appointment.phone || 'N/A').substring(0, 15);
      const notes = (appointment.notes || 'No notes').substring(0, 20);
      
      console.log(`${timeStr}\t\t${name.padEnd(15)}\t${phone.padEnd(15)}\t${notes}`);
    });

    if (leads.length > 10) {
      console.log(`... and ${leads.length - 10} more appointments`);
    }

  } catch (error) {
    console.error('❌ Error extracting calendar data:', error.message);
  }
}

// Run the extraction
extractCalendarDataForOct25();
