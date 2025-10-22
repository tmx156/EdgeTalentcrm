require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// IDs of the 37 leads with status "Assigned" (excluding Talia pearl lesser who is already Booked)
const leadIdsToUpdate = [
  '722a7c4d-4c79-4533-9d5a-ce14acb2ea21', // NIKI DEE
  '72fe824d-0522-4d05-bd20-8d237223098d', // Jacqueline Rowen
  // '1a96e2b6-71a4-4729-8a48-4c7a510e5c43', // Talia pearl lesser - SKIP (already Booked)
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

async function updateLeadsToNew() {
  console.log(`\n🔄 Updating ${leadIdsToUpdate.length} leads to status "New"...\n`);

  let successCount = 0;
  let errorCount = 0;

  for (const leadId of leadIdsToUpdate) {
    try {
      // First get the lead details to show what we're updating
      const { data: lead, error: fetchError } = await supabase
        .from('leads')
        .select('name, email, status')
        .eq('id', leadId)
        .single();

      if (fetchError) {
        console.error(`❌ Error fetching lead ${leadId}:`, fetchError.message);
        errorCount++;
        continue;
      }

      // Update the status to "New"
      const { data, error } = await supabase
        .from('leads')
        .update({ status: 'New' })
        .eq('id', leadId);

      if (error) {
        console.error(`❌ Error updating ${lead.name}:`, error.message);
        errorCount++;
      } else {
        console.log(`✅ Updated: ${lead.name} (${lead.email}) - ${lead.status} → New`);
        successCount++;
      }
    } catch (error) {
      console.error(`❌ Error processing lead ${leadId}:`, error.message);
      errorCount++;
    }
  }

  console.log(`\n\n========== UPDATE SUMMARY ==========`);
  console.log(`✅ Successfully updated: ${successCount} leads`);
  console.log(`❌ Failed: ${errorCount} leads`);
  console.log(`📊 Total processed: ${leadIdsToUpdate.length} leads`);
  console.log(`\n⚠️  Note: Talia pearl lesser (Booked status) was NOT updated.`);
}

updateLeadsToNew().catch(console.error);
