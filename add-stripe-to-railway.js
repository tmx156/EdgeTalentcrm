/**
 * Add Stripe environment variables to Railway
 * This script will check if Stripe variables exist and add them if missing
 * 
 * Usage: node add-stripe-to-railway.js
 */

const { execSync } = require('child_process');
const readline = require('readline');
const fs = require('fs');
const path = require('path');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

// Read Railway config to get project info
const configPath = path.join(process.env.USERPROFILE || process.env.HOME, '.railway', 'config.json');
let config;
try {
  config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
} catch (error) {
  console.error('❌ Could not read Railway config:', error.message);
  process.exit(1);
}

const currentPath = process.cwd();
const projectInfo = config.projects[currentPath];

if (!projectInfo) {
  console.error('❌ No Railway project linked to current directory');
  process.exit(1);
}

console.log('🔍 Checking Stripe Environment Variables in Railway\n');
console.log(`Project: ${projectInfo.name}`);
console.log(`Environment: ${projectInfo.environmentName}\n`);

// Function to check if Railway CLI is authenticated
function checkAuth() {
  try {
    execSync('railway whoami', { stdio: 'ignore' });
    return true;
  } catch (error) {
    return false;
  }
}

// Function to get variables (try different methods)
function getVariables() {
  try {
    // Try with service specified
    if (projectInfo.service) {
      const output = execSync(`railway variables --service ${projectInfo.service} --json`, { 
        encoding: 'utf-8', 
        stdio: 'pipe' 
      });
      return JSON.parse(output);
    }
    
    // Try without service
    const output = execSync('railway variables --json', { 
      encoding: 'utf-8', 
      stdio: 'pipe' 
    });
    return JSON.parse(output);
  } catch (error) {
    // Try plain format
    try {
      const output = execSync('railway variables', { 
        encoding: 'utf-8', 
        stdio: 'pipe' 
      });
      const vars = {};
      output.split('\n').forEach(line => {
        const match = line.match(/^([^=]+)=(.*)$/);
        if (match) {
          vars[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, '');
        }
      });
      return vars;
    } catch (e) {
      return {};
    }
  }
}

// Function to set variable
function setVariable(key, value) {
  try {
    let cmd = `railway variables --set "${key}=${value}"`;
    if (projectInfo.service) {
      cmd += ` --service ${projectInfo.service}`;
    }
    execSync(cmd, { stdio: 'inherit' });
    return true;
  } catch (error) {
    console.error(`❌ Failed to set ${key}:`, error.message);
    return false;
  }
}

async function main() {
  // Check authentication
  if (!checkAuth()) {
    console.error('❌ Not authenticated with Railway');
    console.log('Please run: railway login');
    rl.close();
    process.exit(1);
  }

  console.log('✅ Authenticated with Railway\n');

  // Get current variables
  console.log('📋 Fetching current variables...');
  const vars = getVariables();
  
  // Check for Stripe variables
  const hasSecretKey = vars.STRIPE_SECRET_KEY || vars['STRIPE_SECRET_KEY'];
  const hasPublishableKey = vars.STRIPE_PUBLISHABLE_KEY || vars['STRIPE_PUBLISHABLE_KEY'];

  console.log('\n💳 Stripe Variables Status:\n');
  
  if (hasSecretKey) {
    const val = hasSecretKey.length > 10 
      ? hasSecretKey.substring(0, 4) + '...' + hasSecretKey.substring(hasSecretKey.length - 4)
      : '***';
    console.log(`✅ STRIPE_SECRET_KEY: ${val}`);
    if (!hasSecretKey.startsWith('sk_')) {
      console.log('   ⚠️  Warning: Should start with "sk_"');
    }
  } else {
    console.log('❌ STRIPE_SECRET_KEY: NOT SET');
  }

  if (hasPublishableKey) {
    const val = hasPublishableKey.length > 10 
      ? hasPublishableKey.substring(0, 4) + '...' + hasPublishableKey.substring(hasPublishableKey.length - 4)
      : '***';
    console.log(`✅ STRIPE_PUBLISHABLE_KEY: ${val}`);
    if (!hasPublishableKey.startsWith('pk_')) {
      console.log('   ⚠️  Warning: Should start with "pk_"');
    }
  } else {
    console.log('❌ STRIPE_PUBLISHABLE_KEY: NOT SET');
  }

  // Ask if user wants to add missing variables
  if (!hasSecretKey || !hasPublishableKey) {
    console.log('\n📝 Some Stripe variables are missing.');
    const add = await question('Do you want to add them now? (y/n): ');
    
    if (add.toLowerCase() === 'y' || add.toLowerCase() === 'yes') {
      if (!hasSecretKey) {
        const secretKey = await question('Enter STRIPE_SECRET_KEY (sk_live_... or sk_test_...): ');
        if (secretKey.trim()) {
          setVariable('STRIPE_SECRET_KEY', secretKey.trim());
        }
      }
      
      if (!hasPublishableKey) {
        const publishableKey = await question('Enter STRIPE_PUBLISHABLE_KEY (pk_live_... or pk_test_...): ');
        if (publishableKey.trim()) {
          setVariable('STRIPE_PUBLISHABLE_KEY', publishableKey.trim());
        }
      }
      
      console.log('\n✅ Variables added! Railway will redeploy automatically.');
    }
  } else {
    console.log('\n✅ All Stripe variables are configured!');
  }

  rl.close();
}

main().catch(error => {
  console.error('❌ Error:', error);
  rl.close();
  process.exit(1);
});
