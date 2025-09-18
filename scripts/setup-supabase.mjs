import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SUPABASE_URL = 'https://artgvpolienazfaalwtk.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFydGd2cG9saWVuYXpmYWFsd3RrIiwicm9sZSI6InNlcnZpY2VfYm9sZSIsImlhdCI6MTc1ODEwMTA5MywiZXhwIjoyMDczNjc3MDkzfQ.mxwz7xW5cMo1e20l50g5tJvJkNS0oPQBIf_8JOuGNBs';

async function executeSQLViaAPI(sql) {
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({ query: sql })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`HTTP ${response.status}: ${error}`);
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function setupDatabase() {
  console.log('🚀 Setting up Supabase database...\n');

  // Read schema file
  const schemaPath = path.join(__dirname, '..', 'supabase', 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf-8');

  // Parse SQL statements
  const statements = schema
    .split(/;(?=\s*(?:CREATE|ALTER|DROP|INSERT|UPDATE|DELETE|GRANT|REVOKE|--|\n|$))/gi)
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  console.log(`📝 Found ${statements.length} SQL statements\n`);

  // Group statements by type for better organization
  const statementGroups = {
    extensions: [],
    types: [],
    tables: [],
    indexes: [],
    functions: [],
    triggers: [],
    policies: [],
    other: []
  };

  statements.forEach(stmt => {
    const upperStmt = stmt.toUpperCase();
    if (upperStmt.includes('CREATE EXTENSION')) {
      statementGroups.extensions.push(stmt);
    } else if (upperStmt.includes('CREATE TYPE')) {
      statementGroups.types.push(stmt);
    } else if (upperStmt.includes('CREATE TABLE')) {
      statementGroups.tables.push(stmt);
    } else if (upperStmt.includes('CREATE INDEX')) {
      statementGroups.indexes.push(stmt);
    } else if (upperStmt.includes('CREATE FUNCTION') || upperStmt.includes('CREATE OR REPLACE FUNCTION')) {
      statementGroups.functions.push(stmt);
    } else if (upperStmt.includes('CREATE TRIGGER')) {
      statementGroups.triggers.push(stmt);
    } else if (upperStmt.includes('CREATE POLICY') || upperStmt.includes('ALTER TABLE') && upperStmt.includes('ENABLE ROW LEVEL SECURITY')) {
      statementGroups.policies.push(stmt);
    } else {
      statementGroups.other.push(stmt);
    }
  });

  // Execute statements in order
  const executionOrder = [
    { name: 'Extensions', statements: statementGroups.extensions },
    { name: 'Types', statements: statementGroups.types },
    { name: 'Tables', statements: statementGroups.tables },
    { name: 'Functions', statements: statementGroups.functions },
    { name: 'Triggers', statements: statementGroups.triggers },
    { name: 'Indexes', statements: statementGroups.indexes },
    { name: 'RLS & Policies', statements: statementGroups.policies },
    { name: 'Other', statements: statementGroups.other }
  ];

  let totalSuccess = 0;
  let totalErrors = 0;

  for (const group of executionOrder) {
    if (group.statements.length === 0) continue;

    console.log(`\n📦 Executing ${group.name} (${group.statements.length} statements)...`);

    for (let i = 0; i < group.statements.length; i++) {
      const stmt = group.statements[i];
      const sql = stmt.endsWith(';') ? stmt : stmt + ';';

      process.stdout.write(`  [${i + 1}/${group.statements.length}] `);

      const result = await executeSQLViaAPI(sql);

      if (result.success) {
        console.log('✅');
        totalSuccess++;
      } else {
        console.log(`❌ ${result.error}`);
        totalErrors++;
      }
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log('📊 Setup Summary:');
  console.log(`  ✅ Successful: ${totalSuccess}`);
  console.log(`  ❌ Failed: ${totalErrors}`);
  console.log('='.repeat(50));

  if (totalErrors === 0) {
    console.log('\n🎉 Database setup completed successfully!');
  } else {
    console.log('\n⚠️ Setup completed with errors. Manual intervention may be required.');
    console.log('You can execute the SQL directly in the Supabase SQL Editor.');
  }
}

// Run setup
setupDatabase().catch(console.error);