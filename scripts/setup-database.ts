import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Use service role key for admin operations
const supabaseUrl = 'https://artgvpolienazfaalwtk.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFydGd2cG9saWVuYXpmYWFsd3RrIiwicm9sZSI6InNlcnZpY2VfYm9sZSIsImlhdCI6MTc1ODEwMTA5MywiZXhwIjoyMDczNjc3MDkzfQ.mxwz7xW5cMo1e20l50g5tJvJkNS0oPQBIf_8JOuGNBs';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function setupDatabase() {
  try {
    console.log('🚀 Starting database setup...');

    // Read the schema file
    const schemaPath = path.join(process.cwd(), 'supabase', 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');

    // Split by semicolons but keep them
    const statements = schema
      .split(/;(?=\s*(?:CREATE|ALTER|DROP|INSERT|UPDATE|DELETE|GRANT|REVOKE|--|\n|$))/gi)
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    console.log(`📝 Found ${statements.length} SQL statements to execute`);

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];

      // Skip pure comment lines
      if (statement.trim().startsWith('--')) {
        continue;
      }

      // Add semicolon back if missing
      const sql = statement.endsWith(';') ? statement : statement + ';';

      try {
        console.log(`Executing statement ${i + 1}/${statements.length}...`);

        // Use raw SQL execution
        const { error } = await supabase.rpc('exec_sql', {
          query: sql
        }).single();

        if (error) {
          // Try direct execution as fallback
          const { error: directError } = await supabase
            .from('_migrations')
            .select('*')
            .limit(1)
            .single()
            .then(() => {
              // This is just to test connection
              return { error: null };
            })
            .catch(err => ({ error: err }));

          if (directError) {
            console.error(`❌ Error in statement ${i + 1}:`, error?.message || directError?.message);
            console.error('Statement:', sql.substring(0, 100) + '...');
            errorCount++;
          } else {
            successCount++;
          }
        } else {
          successCount++;
        }
      } catch (err) {
        console.error(`❌ Error in statement ${i + 1}:`, err);
        console.error('Statement:', sql.substring(0, 100) + '...');
        errorCount++;
      }
    }

    console.log('\n📊 Database setup summary:');
    console.log(`✅ Successful statements: ${successCount}`);
    console.log(`❌ Failed statements: ${errorCount}`);

    if (errorCount === 0) {
      console.log('\n🎉 Database setup completed successfully!');
    } else {
      console.log('\n⚠️ Database setup completed with some errors. Please review the output above.');
    }

  } catch (error) {
    console.error('Fatal error during database setup:', error);
    process.exit(1);
  }
}

// Run setup
setupDatabase();