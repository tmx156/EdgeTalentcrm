/**
 * Export all leads assigned to Chicko today to Excel
 */

const { createClient } = require('@supabase/supabase-js');
const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.SUPABASE_URL || 'https://tnltvfzltdeilanxhlvy.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRubHR2ZnpsdGRlaWxhbnhobHZ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcxOTk4MzUsImV4cCI6MjA3Mjc3NTgzNX0.T_HaALQeSiCjLkpVuwQZUFnJbuSyRy2wf2kWiqJ99Lc';
const supabase = createClient(supabaseUrl, supabaseKey);

async function exportChickoLeads() {
  try {
    console.log('\n' + '='.repeat(70));
    console.log('📊 EXPORTING CHICKO\'S LEADS FOR TODAY');
    console.log('='.repeat(70) + '\n');

    // Get Chicko's user ID
    console.log('🔍 Finding Chicko...\n');
    const { data: users, error: userError } = await supabase
      .from('users')
      .select('id, name, email')
      .ilike('name', '%chicko%');

    if (userError) throw userError;

    if (!users || users.length === 0) {
      console.error('❌ Chicko not found in users table');
      process.exit(1);
    }

    const chicko = users[0];
    console.log('✅ Found Chicko:');
    console.log(`   Name: ${chicko.name}`);
    console.log(`   ID: ${chicko.id}`);
    console.log(`   Email: ${chicko.email}\n`);

    // Get today's date range
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const startUTC = new Date(todayStr).toISOString();
    const endDate = new Date(todayStr);
    endDate.setHours(23, 59, 59, 999);
    const endUTC = endDate.toISOString();

    console.log(`📅 Getting leads assigned on: ${todayStr}\n`);

    // Get all leads assigned to Chicko today
    const { data: leads, error: leadsError } = await supabase
      .from('leads')
      .select('*')
      .eq('booker_id', chicko.id)
      .gte('assigned_at', startUTC)
      .lte('assigned_at', endUTC)
      .order('assigned_at', { ascending: false });

    if (leadsError) throw leadsError;

    console.log(`📋 Found ${leads.length} leads assigned to Chicko today\n`);

    if (leads.length === 0) {
      console.log('ℹ️  No leads to export');
      process.exit(0);
    }

    // Create Excel workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Chicko Leads - ' + todayStr);

    // Define columns with styling
    worksheet.columns = [
      { header: 'ID', key: 'id', width: 15 },
      { header: 'Name', key: 'name', width: 25 },
      { header: 'Phone', key: 'phone', width: 15 },
      { header: 'Email', key: 'email', width: 30 },
      { header: 'Postcode', key: 'postcode', width: 12 },
      { header: 'Age', key: 'age', width: 8 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'Date Booked', key: 'date_booked', width: 20 },
      { header: 'Booked At', key: 'booked_at', width: 20 },
      { header: 'Ever Booked', key: 'ever_booked', width: 12 },
      { header: 'Assigned At', key: 'assigned_at', width: 20 },
      { header: 'Created At', key: 'created_at', width: 20 },
      { header: 'Notes', key: 'notes', width: 40 },
      { header: 'Parent Phone', key: 'parent_phone', width: 15 },
      { header: 'Is Confirmed', key: 'is_confirmed', width: 12 },
      { header: 'Has Sale', key: 'has_sale', width: 10 }
    ];

    // Style header row
    worksheet.getRow(1).font = { bold: true, size: 12 };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' }
    };
    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };
    worksheet.getRow(1).height = 20;

    // Add data rows
    leads.forEach((lead, index) => {
      const row = worksheet.addRow({
        id: lead.id,
        name: lead.name,
        phone: lead.phone,
        email: lead.email,
        postcode: lead.postcode,
        age: lead.age,
        status: lead.status,
        date_booked: lead.date_booked ? new Date(lead.date_booked).toLocaleString('en-GB') : '',
        booked_at: lead.booked_at ? new Date(lead.booked_at).toLocaleString('en-GB') : '',
        ever_booked: lead.ever_booked ? 'Yes' : 'No',
        assigned_at: lead.assigned_at ? new Date(lead.assigned_at).toLocaleString('en-GB') : '',
        created_at: lead.created_at ? new Date(lead.created_at).toLocaleString('en-GB') : '',
        notes: lead.notes || '',
        parent_phone: lead.parent_phone || '',
        is_confirmed: lead.is_confirmed ? 'Yes' : 'No',
        has_sale: lead.has_sale ? 'Yes' : 'No'
      });

      // Alternate row colors
      if (index % 2 === 0) {
        row.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF2F2F2' }
        };
      }

      // Color code by status
      const statusCell = row.getCell('status');
      switch (lead.status) {
        case 'Booked':
          statusCell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF92D050' }
          };
          break;
        case 'Attended':
          statusCell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF00B050' }
          };
          break;
        case 'Cancelled':
          statusCell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFF6B6B' }
          };
          break;
        case 'New':
        case 'Assigned':
          statusCell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFFC000' }
          };
          break;
      }
    });

    // Auto-filter
    worksheet.autoFilter = {
      from: 'A1',
      to: `P1`
    };

    // Freeze header row
    worksheet.views = [
      { state: 'frozen', xSplit: 0, ySplit: 1 }
    ];

    // Add summary at the bottom
    const summaryRow = leads.length + 3;
    worksheet.mergeCells(`A${summaryRow}:B${summaryRow}`);
    worksheet.getCell(`A${summaryRow}`).value = 'SUMMARY';
    worksheet.getCell(`A${summaryRow}`).font = { bold: true, size: 14 };
    worksheet.getCell(`A${summaryRow}`).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' }
    };
    worksheet.getCell(`A${summaryRow}`).font = { bold: true, color: { argb: 'FFFFFFFF' } };

    const statusCounts = {
      'New': leads.filter(l => l.status === 'New').length,
      'Assigned': leads.filter(l => l.status === 'Assigned').length,
      'Booked': leads.filter(l => l.status === 'Booked').length,
      'Attended': leads.filter(l => l.status === 'Attended').length,
      'Cancelled': leads.filter(l => l.status === 'Cancelled').length,
      'Other': leads.filter(l => !['New', 'Assigned', 'Booked', 'Attended', 'Cancelled'].includes(l.status)).length
    };

    worksheet.getCell(`A${summaryRow + 1}`).value = 'Total Leads:';
    worksheet.getCell(`B${summaryRow + 1}`).value = leads.length;
    worksheet.getCell(`B${summaryRow + 1}`).font = { bold: true };

    let row = summaryRow + 2;
    Object.entries(statusCounts).forEach(([status, count]) => {
      if (count > 0) {
        worksheet.getCell(`A${row}`).value = `${status}:`;
        worksheet.getCell(`B${row}`).value = count;
        row++;
      }
    });

    // Save file
    const fileName = `Chicko_Leads_${todayStr}.xlsx`;
    await workbook.xlsx.writeFile(fileName);

    console.log('✅ Excel file created successfully!\n');
    console.log('📁 File Details:');
    console.log(`   Name: ${fileName}`);
    console.log(`   Location: ${path.resolve(fileName)}`);
    console.log(`   Total Leads: ${leads.length}`);
    console.log('');
    console.log('📊 Breakdown by Status:');
    Object.entries(statusCounts).forEach(([status, count]) => {
      if (count > 0) {
        console.log(`   ${status}: ${count}`);
      }
    });
    console.log('');
    console.log('='.repeat(70));
    console.log('✅ EXPORT COMPLETE');
    console.log('='.repeat(70) + '\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

exportChickoLeads();

