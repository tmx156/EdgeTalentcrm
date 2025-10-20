/**
 * FINAL EMAIL MESSAGE FIX
 *
 * This script will:
 * 1. Kill ALL running server processes
 * 2. Delete ALL messages from database
 * 3. Start the server with the NEW extraction code
 * 4. Wait for emails to import
 * 5. Show results
 */

const { createClient } = require('@supabase/supabase-js');
const { exec, spawn } = require('child_process');
const { promisify } = require('util');
require('dotenv').config({ path: './server/.env' });

const execAsync = promisify(exec);
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function killAllServers() {
  console.log('\n🔪 STEP 1: Killing all running servers...\n');

  try {
    // Find all node processes on port 5000
    const { stdout } = await execAsync('netstat -ano | findstr :5000 | findstr LISTENING');
    const lines = stdout.trim().split('\n');

    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      const pid = parts[parts.length - 1];

      if (pid && pid !== '0') {
        console.log(`  Killing PID ${pid}...`);
        try {
          await execAsync(`taskkill //F //PID ${pid}`);
        } catch (e) {
          // Process might already be dead
        }
      }
    }

    console.log('✅ All servers killed\n');
    await new Promise(resolve => setTimeout(resolve, 2000));
  } catch (e) {
    console.log('✅ No servers running\n');
  }
}

async function deleteAllMessages() {
  console.log('🗑️  STEP 2: Deleting ALL messages from database...\n');

  const { error } = await supabase
    .from('messages')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');

  if (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }

  console.log('✅ All messages deleted\n');
}

async function startServerAndWait() {
  console.log('🚀 STEP 3: Starting server with NEW extraction code...\n');

  const serverProcess = spawn('npm', ['start'], {
    cwd: './server',
    shell: true,
    detached: false
  });

  let started = false;

  serverProcess.stdout.on('data', (data) => {
    const output = data.toString();
    console.log(output);

    if (output.includes('Scan complete')) {
      started = true;
    }
  });

  serverProcess.stderr.on('data', (data) => {
    console.error(data.toString());
  });

  // Wait for server to start and scan
  console.log('\n⏳ Waiting 25 seconds for server to start and import emails...\n');
  await new Promise(resolve => setTimeout(resolve, 25000));

  return serverProcess;
}

async function checkResults() {
  console.log('\n📊 STEP 4: Checking imported emails...\n');

  const { data, error } = await supabase
    .from('messages')
    .select('id, content, subject')
    .eq('type', 'email')
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  console.log(`Found ${data.length} imported emails:\n`);

  data.forEach((msg, i) => {
    console.log('='.repeat(70));
    console.log(`EMAIL ${i + 1}: ${msg.subject}`);
    console.log('='.repeat(70));
    console.log(msg.content);
    console.log();
  });

  // Check for issues
  let hasIssues = false;
  data.forEach((msg) => {
    if (msg.content.includes('Content-Type:') ||
        msg.content.includes('--_000_') ||
        msg.content.match(/^On .+wrote:/m) ||
        msg.content.includes('Sent from')) {
      hasIssues = true;
    }
  });

  if (hasIssues) {
    console.log('\n❌ ISSUES FOUND: Messages still have threading/MIME artifacts\n');
  } else {
    console.log('\n✅ SUCCESS: All messages are clean!\n');
  }
}

async function main() {
  console.log('\n'.repeat(2));
  console.log('='.repeat(70));
  console.log('  FINAL EMAIL EXTRACTION FIX');
  console.log('='.repeat(70));

  await killAllServers();
  await deleteAllMessages();
  const serverProcess = await startServerAndWait();
  await checkResults();

  console.log('\n✅ Process complete. Server is still running.');
  console.log('Check your CRM Messages page to verify emails display correctly.\n');

  // Keep process alive to keep server running
  // User can Ctrl+C to exit
  process.on('SIGINT', () => {
    console.log('\nShutting down...');
    serverProcess.kill();
    process.exit(0);
  });
}

main().catch(console.error);
