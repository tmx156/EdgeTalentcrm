require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// IDs of the 37 leads we just updated
const leadIdsToCheck = [
  '722a7c4d-4c79-4533-9d5a-ce14acb2ea21', // NIKI DEE
  '72fe824d-0522-4d05-bd20-8d237223098d', // Jacqueline Rowen
  '0aaec48f-4222-4e38-a41b-a52b6864a32f', // Renata
  '9f68968a-8e14-4a54-9c20-7789839cc0f9', // Louise OReilly
  '2033bd10-ca55-4a77-a5a2-adfee3602e9a', // Helen McMullan
  '10987f30-84b6-4117-ae85-9395e27baed5', // Katrina Bradley
  '57be0b6f-1941-4830-9406-2e783fa2ccee', // Amanda Balmbra
  '3329a3e3-b841-4719-9c2c-bae7007e85b0', // Chrissie Douglass
  '5489b437-c4d5-485d-b8dc-34b11fa6ed35', // Marwa
  'aba56db3-f737-4460-8ef9-11366eb4f516', // Gillian
  'bb134971-793a-4056-9825-593ae9800c8f', // Jane holland
  'a0e45e45-ade2-4b05-a8c5-016772eb7396', // Lorna fox
  '20b93150-f3e3-4cba-8237-2cd849fdd4b6', // Kris burton
  'bec17505-1bda-4dc5-8077-f7aee3130d34', // Heather Smyth
  '7d57cebc-a2f9-41ea-8942-3e49079769b5', // Natasha Peters
  '804bdb21-591f-4bfa-9367-ab152833d0b7', // David Stewart
  'e04be5a4-1135-4dab-b578-07dce0cfa4ac', // Lily-Mae
  'bc8b650b-8021-436b-865d-726f2e7a35cc', // Harry David Jackson
  '495f1832-cfdb-4974-85d4-0b9ba4b36561', // Felicia Brookes
  '371755c7-2413-4221-bc0c-05be65317f6c', // Kellie Baxter
  '36767432-6439-4bbd-b71d-9d06609e6aee', // Sharon bradbury
  '938ccd21-492a-4ca5-8cb5-b3be4b628dac', // Annette Jackson
  '06e12056-f643-4f43-9388-0c068f9bb7b6', // Ainsley Kerr
  '6ce4efc7-ff78-4f06-b5a6-70b9bcc53dc1', // Carol Butler
  'e580d881-49a8-4f17-9019-e20f0c52ac0d', // Tracey Doyle
  '0b8b0efe-42b5-4dca-9e0e-849d0bc56e1c', // Jayne Peters
  '3ef266ed-8e93-4fcb-816d-95b6de0a9d13', // Jacqueline Mackenzie Robb
  'c9c627ff-3bcb-4691-ba44-c4420d750efd', // Eluned yaxley
  '7d56500c-aa69-4868-a58b-75a386acdf36', // Henrietta Evans
  'facf94d0-4aef-427a-98b9-39d1992816f2', // Gill Hall
  'acc60574-f979-483f-8232-1a123f7c7a74', // Andrea Rahal
  '7fff1ba8-5c76-4223-8096-9f4d3bcd0cdb', // Peachy Butterfield
  '19b58662-eba0-44f2-88b8-d5762bac80fe', // Lamara Andrew
  'b6b3f15e-11b0-42eb-9937-48ee32a25371', // Yasmin Melville
  'bc9dc655-c554-4142-8cfb-0b85668b2b56', // YAHYA
  '106c1392-ab50-48ac-82f9-50fa1c105736', // Eileen Inglis
  '95404cbb-71c5-4340-b029-2714a8553509'  // Paul Dolgin
];

async function checkAssignments() {
  console.log(`\n🔍 Checking assignments for ${leadIdsToCheck.length} leads...\n`);

  // Fetch all leads with their assignments
  const { data: leads, error } = await supabase
    .from('leads')
    .select('id, name, email, status, booker_id, assigned_at')
    .in('id', leadIdsToCheck);

  if (error) {
    console.error('❌ Error fetching leads:', error);
    return;
  }

  // Get all user IDs to fetch user names
  const userIds = [...new Set(leads.map(l => l.booker_id).filter(Boolean))];

  const { data: users, error: userError } = await supabase
    .from('users')
    .select('id, name, email')
    .in('id', userIds);

  if (userError) {
    console.error('❌ Error fetching users:', userError);
    return;
  }

  // Create a map of user ID to user name
  const userMap = {};
  users.forEach(user => {
    userMap[user.id] = user.name || user.email;
  });

  // Group by assignment
  const assignmentGroups = {};
  let unassignedCount = 0;
  let chickoCount = 0;

  leads.forEach(lead => {
    const assignedTo = lead.booker_id || 'Unassigned';
    const userName = assignedTo === 'Unassigned' ? 'Unassigned' : userMap[assignedTo] || assignedTo;

    if (!assignmentGroups[userName]) {
      assignmentGroups[userName] = [];
    }
    assignmentGroups[userName].push(lead);

    if (assignedTo === 'Unassigned') {
      unassignedCount++;
    }

    // Check if assigned to Chicko (case insensitive)
    if (userName && userName.toLowerCase().includes('chicko')) {
      chickoCount++;
    }
  });

  console.log('========== ASSIGNMENT BREAKDOWN ==========\n');

  Object.keys(assignmentGroups).sort().forEach(userName => {
    const leadsForUser = assignmentGroups[userName];
    console.log(`\n👤 ${userName}: ${leadsForUser.length} leads`);
    console.log('─'.repeat(50));
    leadsForUser.forEach(lead => {
      console.log(`   - ${lead.name} (${lead.email}) - Status: ${lead.status}`);
    });
  });

  console.log(`\n\n========== SUMMARY ==========`);
  console.log(`📊 Total leads checked: ${leads.length}`);
  console.log(`👥 Assigned to users: ${leads.length - unassignedCount}`);
  console.log(`❓ Unassigned: ${unassignedCount}`);
  console.log(`🎯 Assigned to Chicko: ${chickoCount}`);

  if (chickoCount > 0) {
    console.log(`\n✅ YES - ${chickoCount} leads were assigned to Chicko`);
  } else {
    console.log(`\n❌ NO - None of these leads were assigned to Chicko`);
  }
}

checkAssignments().catch(console.error);
