const axios = require('axios');
const fs = require('fs');

async function extractCalendarDataForOct25() {
  try {
    console.log('📅 Extracting calendar data for October 25, 2025...');
    
    // Get all leads from the API
    const response = await axios.get('http://localhost:5000/api/leads/public?limit=10000');
    const leads = response.data?.leads || [];

    console.log(`📊 Total leads retrieved: ${leads.length}`);

    // Filter for appointments scheduled on October 25, 2025
    const oct25Appointments = leads.filter(lead => {
      if (!lead.date_booked) return false;
      
      const appointmentDate = new Date(lead.date_booked);
      const dateStr = appointmentDate.toISOString().split('T')[0];
      return dateStr === '2025-10-25';
    });

    console.log(`📅 Found ${oct25Appointments.length} appointments for October 25, 2025`);

    if (oct25Appointments.length === 0) {
      console.log('❌ No appointments found for October 25, 2025');
      return;
    }

    // Sort appointments by time
    oct25Appointments.sort((a, b) => {
      const timeA = new Date(a.date_booked).getTime();
      const timeB = new Date(b.date_booked).getTime();
      return timeA - timeB;
    });

    // Prepare CSV data
    const csvHeader = 'Time,Person\'s Name,Phone Number,Notes\n';
    let csvContent = csvHeader;

    oct25Appointments.forEach(appointment => {
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
    console.log(`📊 Total appointments exported: ${oct25Appointments.length}`);
    
    // Display preview of the data
    console.log('\n📋 Preview of exported data:');
    console.log('Time\t\tName\t\t\tPhone\t\t\tNotes');
    console.log('─'.repeat(80));
    
    oct25Appointments.slice(0, 10).forEach(appointment => {
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

    if (oct25Appointments.length > 10) {
      console.log(`... and ${oct25Appointments.length - 10} more appointments`);
    }

  } catch (error) {
    console.error('❌ Error extracting calendar data:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

// Run the extraction
extractCalendarDataForOct25();
