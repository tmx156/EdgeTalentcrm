const dbManager = require('./database-connection-manager');

async function countAllLeadsByStatus() {
  try {
    console.log('📊 Counting all leads by status...\n');

    // Fetch all leads (excluding ghost bookings)
    const { data: leads, error } = await dbManager.client
      .from('leads')
      .select('status, custom_fields')
      .neq('postcode', 'ZZGHOST');

    if (error) {
      console.error('❌ Error fetching leads:', error);
      process.exit(1);
    }

    const totalLeads = leads.length;
    console.log(`📈 Total Leads: ${totalLeads.toLocaleString()}\n`);

    // Count by main status field
    const statusCounts = {};
    const callStatusCounts = {};

    leads.forEach(lead => {
      // Count by main status
      const status = lead.status || 'Unknown';
      statusCounts[status] = (statusCounts[status] || 0) + 1;

      // Count by call_status in custom_fields
      try {
        if (lead.custom_fields) {
          const customFields = typeof lead.custom_fields === 'string' 
            ? JSON.parse(lead.custom_fields) 
            : lead.custom_fields;
          
          const callStatus = customFields?.call_status;
          if (callStatus) {
            callStatusCounts[callStatus] = (callStatusCounts[callStatus] || 0) + 1;
          }
        }
      } catch (e) {
        // Ignore parsing errors
      }
    });

    // Display main status counts
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 MAIN STATUS COUNTS (status field):');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const sortedStatuses = Object.entries(statusCounts)
      .sort((a, b) => b[1] - a[1]);
    
    sortedStatuses.forEach(([status, count]) => {
      const percentage = ((count / totalLeads) * 100).toFixed(1);
      console.log(`${status.padEnd(35)} ${count.toString().padStart(6)} (${percentage}%)`);
    });

    // Display call_status counts
    const totalWithCallStatus = Object.values(callStatusCounts).reduce((sum, count) => sum + count, 0);
    
    if (totalWithCallStatus > 0) {
      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('📞 CALL STATUS COUNTS (custom_fields.call_status):');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
      const sortedCallStatuses = Object.entries(callStatusCounts)
        .sort((a, b) => b[1] - a[1]);
      
      sortedCallStatuses.forEach(([callStatus, count]) => {
        const percentage = ((count / totalLeads) * 100).toFixed(1);
        console.log(`${callStatus.padEnd(35)} ${count.toString().padStart(6)} (${percentage}%)`);
      });
      
      console.log(`\nTotal leads with call_status: ${totalWithCallStatus.toLocaleString()}`);
      console.log(`Leads without call_status: ${(totalLeads - totalWithCallStatus).toLocaleString()}`);
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`✅ Summary: ${totalLeads.toLocaleString()} total leads (excluding ghost bookings)`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

// Run the script
countAllLeadsByStatus();
