import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'projetocaixa',
  user: 'postgres',
  password: 'postgres'
});

async function testConnection() {
  try {
    console.log('🔄 Tentando conectar ao PostgreSQL...');
    const result = await pool.query('SELECT NOW()');
    console.log('✅ Conexão estabelecida!');
    console.log('⏰ Horário do servidor:', result.rows[0].now);

    // Testar tabelas
    const tables = await pool.query(`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
    `);

    console.log('\n📋 Tabelas encontradas:');
    tables.rows.forEach(row => {
      console.log(`  - ${row.tablename}`);
    });

    // Verificar conference_history
    const conferenceHistory = await pool.query(`
      SELECT COUNT(*) as total
      FROM conference_history
    `);

    console.log(`\n📊 Total de registros em conference_history: ${conferenceHistory.rows[0].total}`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Erro ao conectar:', error.message);
    process.exit(1);
  }
}

testConnection();