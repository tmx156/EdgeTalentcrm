const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './server/.env' });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkImageTypes() {
  // Get all leads with image URLs
  const { data, error } = await supabase
    .from('leads')
    .select('id, name, image_url')
    .not('image_url', 'is', null)
    .limit(200);

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('Total leads with image_url:', data.length);

  // Group by file extension/type
  const types = {};
  const noExtension = [];

  data.forEach(lead => {
    const url = lead.image_url || '';
    if (!url || url.trim() === '') return;

    let ext = 'unknown';
    const lowerUrl = url.toLowerCase();

    // Check for file extensions
    if (lowerUrl.includes('.jpg') || lowerUrl.includes('.jpeg')) ext = 'jpg/jpeg';
    else if (lowerUrl.includes('.png')) ext = 'png';
    else if (lowerUrl.includes('.gif')) ext = 'gif';
    else if (lowerUrl.includes('.webp')) ext = 'webp';
    else if (lowerUrl.includes('.mp4')) ext = 'mp4';
    else if (lowerUrl.includes('.heic')) ext = 'heic';
    else if (lowerUrl.includes('.heif')) ext = 'heif';
    else if (lowerUrl.includes('.svg')) ext = 'svg';
    else if (lowerUrl.includes('.bmp')) ext = 'bmp';
    else if (lowerUrl.includes('.tiff') || lowerUrl.includes('.tif')) ext = 'tiff';
    else if (lowerUrl.includes('.avif')) ext = 'avif';
    else if (lowerUrl.includes('.ico')) ext = 'ico';
    else {
      // No extension found - check the URL pattern
      if (lowerUrl.includes('supabase.co/storage')) ext = 'supabase-no-ext';
      else if (lowerUrl.includes('cloudinary')) ext = 'cloudinary-no-ext';
      else if (lowerUrl.includes('matchmodels') || lowerUrl.includes('modelhunt')) ext = 'external-no-ext';
      else if (lowerUrl.startsWith('http')) ext = 'http-no-ext';
      else ext = 'other-no-ext';

      noExtension.push({ name: lead.name, url: url });
    }

    if (!types[ext]) types[ext] = [];
    types[ext].push({ name: lead.name, url: url });
  });

  console.log('\n=== Image Types Distribution ===');
  Object.keys(types).sort().forEach(type => {
    console.log(`${type}: ${types[type].length} leads`);
  });

  console.log('\n=== URLs Without Clear Extension (first 10) ===');
  noExtension.slice(0, 10).forEach(l => {
    console.log(`  ${l.name}:`);
    console.log(`    ${l.url}`);
  });

  // Find specific leads that might have issues
  console.log('\n=== Looking for Roberta Stewart ===');
  const roberta = data.find(l => l.name && l.name.toLowerCase().includes('roberta'));
  if (roberta) {
    console.log('Name:', roberta.name);
    console.log('URL:', roberta.image_url);
  } else {
    // Search without image_url filter
    const { data: robertaData } = await supabase
      .from('leads')
      .select('id, name, image_url')
      .ilike('name', '%roberta%')
      .limit(5);

    if (robertaData && robertaData.length > 0) {
      console.log('Found in full search:');
      robertaData.forEach(r => {
        console.log(`  ${r.name}: ${r.image_url || 'NO IMAGE URL'}`);
      });
    }
  }

  // Check for problematic URL patterns
  console.log('\n=== Potentially Problematic URLs ===');
  data.forEach(lead => {
    const url = lead.image_url || '';
    // Check for issues
    if (url.includes(' ')) {
      console.log(`SPACE in URL - ${lead.name}: ${url.substring(0, 80)}`);
    }
    if (url.includes('undefined') || url.includes('null')) {
      console.log(`undefined/null in URL - ${lead.name}: ${url.substring(0, 80)}`);
    }
    if (url.startsWith('//')) {
      console.log(`Protocol-relative URL - ${lead.name}: ${url.substring(0, 80)}`);
    }
  });
}

checkImageTypes().catch(console.error);
