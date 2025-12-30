/**
 * Script to update Railway environment variables
 * This script will add/update AWS and Cloudinary credentials in Railway
 * 
 * Usage:
 * 1. Make sure you're logged into Railway: railway login
 * 2. Link to your project: railway link
 * 3. Run: node update-railway-vars.js
 */

const { execSync } = require('child_process');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Required AWS credentials
const AWS_VARS = {
  'AWS_ACCESS_KEY_ID': 'AWS Access Key ID',
  'AWS_SECRET_ACCESS_KEY': 'AWS Secret Access Key',
  'AWS_REGION': 'AWS Region (e.g., us-east-1, eu-west-2)',
  'AWS_S3_BUCKET': 'S3 Bucket Name (e.g., edgetalent-photos)'
};

// Required Cloudinary credentials
const CLOUDINARY_VARS = {
  'CLOUDINARY_CLOUD_NAME': 'Cloudinary Cloud Name',
  'CLOUDINARY_API_KEY': 'Cloudinary API Key',
  'CLOUDINARY_API_SECRET': 'Cloudinary API Secret'
};

// Function to prompt for input
function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

// Function to check if Railway CLI is available
function checkRailwayCLI() {
  try {
    execSync('railway --version', { stdio: 'ignore' });
    return true;
  } catch (error) {
    return false;
  }
}

// Function to check if project is linked
function checkProjectLinked() {
  try {
    execSync('railway status', { stdio: 'ignore' });
    return true;
  } catch (error) {
    return false;
  }
}

// Function to set Railway variable
function setRailwayVar(key, value) {
  try {
    console.log(`Setting ${key}...`);
    execSync(`railway variables set ${key}="${value}"`, { stdio: 'inherit' });
    console.log(`✅ ${key} set successfully`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to set ${key}:`, error.message);
    return false;
  }
}

// Function to get current Railway variables
function getRailwayVars() {
  try {
    const output = execSync('railway variables', { encoding: 'utf-8' });
    const vars = {};
    output.split('\n').forEach(line => {
      const match = line.match(/^(\w+)=(.*)$/);
      if (match) {
        vars[match[1]] = match[2];
      }
    });
    return vars;
  } catch (error) {
    console.warn('⚠️ Could not fetch current variables:', error.message);
    return {};
  }
}

// Main function
async function main() {
  console.log('🚂 Railway Environment Variables Updater\n');
  console.log('This script will help you add AWS and Cloudinary credentials to Railway.\n');

  // Check Railway CLI
  if (!checkRailwayCLI()) {
    console.error('❌ Railway CLI is not installed!');
    console.log('Install it with: npm install -g @railway/cli');
    process.exit(1);
  }

  // Check if project is linked
  if (!checkProjectLinked()) {
    console.error('❌ No Railway project linked!');
    console.log('Link to your project with: railway link');
    process.exit(1);
  }

  console.log('✅ Railway CLI is installed and project is linked\n');

  // Get current variables
  console.log('📋 Fetching current Railway variables...');
  const currentVars = getRailwayVars();
  console.log(`Found ${Object.keys(currentVars).length} existing variables\n`);

  // Check what's missing
  const missingAWS = Object.keys(AWS_VARS).filter(key => !currentVars[key]);
  const missingCloudinary = Object.keys(CLOUDINARY_VARS).filter(key => !currentVars[key]);

  console.log('📊 Missing Variables:');
  if (missingAWS.length > 0) {
    console.log('\n🔷 AWS S3 Variables:');
    missingAWS.forEach(key => console.log(`  - ${key} (${AWS_VARS[key]})`));
  }
  if (missingCloudinary.length > 0) {
    console.log('\n☁️ Cloudinary Variables:');
    missingCloudinary.forEach(key => console.log(`  - ${key} (${CLOUDINARY_VARS[key]})`));
  }
  if (missingAWS.length === 0 && missingCloudinary.length === 0) {
    console.log('✅ All AWS and Cloudinary variables are already set!');
    rl.close();
    return;
  }

  console.log('\n');

  // Ask user if they want to add AWS credentials
  if (missingAWS.length > 0) {
    const addAWS = await question('Do you want to add AWS S3 credentials? (y/n): ');
    if (addAWS.toLowerCase() === 'y' || addAWS.toLowerCase() === 'yes') {
      console.log('\n📝 Please provide AWS credentials:\n');
      
      for (const [key, description] of Object.entries(AWS_VARS)) {
        if (missingAWS.includes(key)) {
          const value = await question(`${description}: `);
          if (value.trim()) {
            setRailwayVar(key, value.trim());
          } else {
            console.log(`⚠️ Skipping ${key} (empty value)`);
          }
        }
      }
    }
  }

  // Ask user if they want to add Cloudinary credentials
  if (missingCloudinary.length > 0) {
    const addCloudinary = await question('\nDo you want to add Cloudinary credentials? (y/n): ');
    if (addCloudinary.toLowerCase() === 'y' || addCloudinary.toLowerCase() === 'yes') {
      console.log('\n📝 Please provide Cloudinary credentials:\n');
      
      for (const [key, description] of Object.entries(CLOUDINARY_VARS)) {
        if (missingCloudinary.includes(key)) {
          const value = await question(`${description}: `);
          if (value.trim()) {
            setRailwayVar(key, value.trim());
          } else {
            console.log(`⚠️ Skipping ${key} (empty value)`);
          }
        }
      }
    }
  }

  console.log('\n✅ Done! All variables have been set.');
  console.log('\n📋 Summary of required variables:');
  console.log('\nAWS S3:');
  Object.keys(AWS_VARS).forEach(key => {
    const status = currentVars[key] || (missingAWS.includes(key) ? '❌ Missing' : '✅ Set');
    console.log(`  ${key}: ${status}`);
  });
  console.log('\nCloudinary:');
  Object.keys(CLOUDINARY_VARS).forEach(key => {
    const status = currentVars[key] || (missingCloudinary.includes(key) ? '❌ Missing' : '✅ Set');
    console.log(`  ${key}: ${status}`);
  });

  rl.close();
}

// Run the script
main().catch(error => {
  console.error('❌ Error:', error);
  rl.close();
  process.exit(1);
});

