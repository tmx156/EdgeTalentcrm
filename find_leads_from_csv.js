require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// List of leads from CSV (non-empty rows)
const leadsToFind = [
  { name: 'NIKI DEE', email: 'nikidee.7@btinternet.com', phone: '7849434989' },
  { name: 'Jacqueline Rowen', email: 'jacrowen@icloud.com', phone: '7342773574' },
  { name: 'Talia pearl lesser', email: 'taliaplesser@gmail.com', phone: '7568312934' },
  { name: 'Renata', email: 'renata_muncey@yahoo.co.uk', phone: '7427953662' },
  { name: 'Louise OReilly', email: 'louiseucmak@gmail.com', phone: '7741569690' },
  { name: 'Helen McMullan', email: 'helenmc@hotmail.com', phone: '7414248490' },
  { name: 'Katrina Bradley', email: 'katrinajane71@hotmail.com', phone: '07395 230463' },
  { name: 'Amanda Balmbra', email: 'abalmbra10@gmail.com', phone: '7771631098' },
  { name: 'Chrissie Douglass', email: 'dustieb45@hotmail.com', phone: '7887602017' },
  { name: 'Marwa', email: 'ner0_m@hotmail.com', phone: '440734224667' },
  { name: 'Gillian', email: 'jill.tinsley62@gmail.com', phone: '7955507106' },
  { name: 'Jane holland', email: 'jane.holland71@gmail.com', phone: '7907105548' },
  { name: 'Lorna fox', email: 'foxylorna@live.co.uk', phone: '7900998541' },
  { name: 'Kris burton', email: 'chrisburton261@gmail.com', phone: '7510816616' },
  { name: 'Heather Smyth', email: 'heathersmyth@gmail.com', phone: '7835834523' },
  { name: 'Natasha Peters', email: 'petenatas@yahoo.com', phone: '7597640183' },
  { name: 'David Stewart', email: 'solutionsinprint@gmail.com', phone: '7710527063' },
  { name: 'Lily-Mae', email: 'jomeg30@hotmail.co.uk', phone: '7597379301' },
  { name: 'Harry David Jackson', email: 'sjllewellyn@hotmail.co.uk', phone: '7970450737' },
  { name: 'Felicia Brookes', email: 'felbrookes@hotmail.co.uk', phone: '7952947211' },
  { name: 'Kellie Baxter', email: 'kbaxter94@hotmail.com', phone: '447599070865' },
  { name: 'Sharon bradbury', email: 'shareenuk1@hotmail.co.uk', phone: '7585046537' },
  { name: 'Annette Jackson', email: 'Annetteaj1968@yahoo.com', phone: '7888034255' },
  { name: 'Ainsley Kerr', email: 'ainsleyk_2004@hotmail.com', phone: '7749094001' },
  { name: 'Carol Butler', email: 'freckle7196@gmail.com', phone: '7707251164' },
  { name: 'Tracey Doyle', email: 'tracey.raff@icloud.com', phone: '7939336292' },
  { name: 'Jayne Peters', email: 'jayne.peters@mail.com', phone: '7889297192' },
  { name: 'Jacqueline Mackenzie Robb', email: 'jacquelinemackenzierobb@yahoo.com', phone: '7831235221' },
  { name: 'Eluned yaxley', email: 'treflys@hotmail.co.uk', phone: '7856611983' },
  { name: 'Henrietta Evans', email: 'bykerh@gmail.com', phone: '7762354828' },
  { name: 'Gill Hall', email: 'hgilly1962@gmail.com', phone: '7482431209' },
  { name: 'Andrea Rahal', email: 'mehargandrea@gmail.com', phone: '7842477817' },
  { name: 'Peachy Butterfield', email: 'peachybutterfield@gmail.com', phone: '7733165209' },
  { name: 'Lamara Andrew', email: 'lamaraandrew@myyahoo.com', phone: '7721922317' },
  { name: 'Yasmin Melville', email: 'debnair84@googlemail.com', phone: '7712813891' },
  { name: 'YAHYA', email: 'yguled65@gmail.com', phone: '7392634040' },
  { name: 'Eileen Inglis', email: 'eeinglis345@gmail.com', phone: '7786414836' },
  { name: 'Paul Dolgin', email: 'pauldolgin@hotmail.com', phone: '7947646049' }
];

// Normalize phone number for comparison
function normalizePhone(phone) {
  if (!phone) return '';
  return phone.toString().replace(/[^0-9]/g, '');
}

async function findLeads() {
  console.log(`\n🔍 Searching for ${leadsToFind.length} leads in the CRM...\n`);

  const found = [];
  const notFound = [];

  for (const csvLead of leadsToFind) {
    const normalizedPhone = normalizePhone(csvLead.phone);

    // Try to find by email first
    let { data: leads, error } = await supabase
      .from('leads')
      .select('*')
      .ilike('email', csvLead.email);

    // If not found by email, try by phone
    if (!leads || leads.length === 0) {
      const { data: phoneLeads, error: phoneError } = await supabase
        .from('leads')
        .select('*')
        .or(`phone.eq.${csvLead.phone},phone.eq.${normalizedPhone},phone.eq.0${normalizedPhone}`);

      leads = phoneLeads;
    }

    // If not found by email or phone, try by name (case insensitive)
    if (!leads || leads.length === 0) {
      const { data: nameLeads, error: nameError } = await supabase
        .from('leads')
        .select('*')
        .ilike('name', csvLead.name);

      leads = nameLeads;
    }

    if (leads && leads.length > 0) {
      const lead = leads[0];
      found.push({
        csvName: csvLead.name,
        csvEmail: csvLead.email,
        csvPhone: csvLead.phone,
        foundLead: {
          id: lead.id,
          name: lead.name,
          email: lead.email,
          phone: lead.phone,
          status: lead.status,
          dateBooked: lead.date_booked,
          assignedTo: lead.assigned_to
        }
      });
      console.log(`✅ FOUND: ${csvLead.name} (ID: ${lead.id}, Status: ${lead.status})`);
    } else {
      notFound.push(csvLead);
      console.log(`❌ NOT FOUND: ${csvLead.name} (${csvLead.email})`);
    }
  }

  console.log(`\n\n========== SUMMARY ==========`);
  console.log(`✅ Found: ${found.length} leads`);
  console.log(`❌ Not Found: ${notFound.length} leads`);

  // Save results to JSON file
  const results = {
    summary: {
      total: leadsToFind.length,
      found: found.length,
      notFound: notFound.length,
      searchDate: new Date().toISOString()
    },
    foundLeads: found,
    notFoundLeads: notFound
  };

  fs.writeFileSync(
    path.join(__dirname, 'lead_search_results.json'),
    JSON.stringify(results, null, 2)
  );

  console.log(`\n📄 Results saved to: lead_search_results.json\n`);

  // Print not found list
  if (notFound.length > 0) {
    console.log(`\n========== NOT FOUND IN CRM ==========`);
    notFound.forEach(lead => {
      console.log(`- ${lead.name} (${lead.email}, ${lead.phone})`);
    });
  }

  // Print found list with details
  if (found.length > 0) {
    console.log(`\n========== FOUND IN CRM ==========`);
    found.forEach(result => {
      console.log(`\nCSV: ${result.csvName} (${result.csvEmail})`);
      console.log(`CRM: ID=${result.foundLead.id}, Name=${result.foundLead.name}, Status=${result.foundLead.status}`);
    });
  }
}

findLeads().catch(console.error);
