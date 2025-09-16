import pg from 'pg';
const { Pool } = pg;

// Configuração do pool de conexões PostgreSQL
const pool = new Pool({
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  database: process.env.POSTGRES_DB || 'projetocaixa',
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'postgres',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Cliente de banco de dados para PostgreSQL local
export const postgresDb = {
  from: (table: string) => ({
    select: (columns = '*') => ({
      eq: (column: string, value: any) => ({
        eq: (column2: string, value2: any) => ({
          order: (orderColumn: string, options: { ascending: boolean }) => ({
            execute: async () => {
              const query = `
                SELECT ${columns} FROM ${table}
                WHERE ${column} = $1 AND ${column2} = $2
                ORDER BY ${orderColumn} ${options.ascending ? 'ASC' : 'DESC'}
              `;
              const result = await pool.query(query, [value, value2]);
              return { data: result.rows, error: null };
            }
          })
        }),
        order: (orderColumn: string, options: { ascending: boolean }) => ({
          execute: async () => {
            const query = `
              SELECT ${columns} FROM ${table}
              WHERE ${column} = $1
              ORDER BY ${orderColumn} ${options.ascending ? 'ASC' : 'DESC'}
            `;
            const result = await pool.query(query, [value]);
            return { data: result.rows, error: null };
          }
        }),
        single: () => ({
          execute: async () => {
            const query = `SELECT ${columns} FROM ${table} WHERE ${column} = $1 LIMIT 1`;
            const result = await pool.query(query, [value]);
            return { data: result.rows[0] || null, error: null };
          }
        }),
        execute: async () => {
          const query = `SELECT ${columns} FROM ${table} WHERE ${column} = $1`;
          const result = await pool.query(query, [value]);
          return { data: result.rows, error: null };
        }
      }),
      gte: (column: string, value: any) => ({
        lte: (column2: string, value2: any) => ({
          eq: (column3: string, value3: any) => ({
            order: (orderColumn: string, options: { ascending: boolean }) => ({
              order: (orderColumn2: string, options2: { ascending: boolean }) => ({
                execute: async () => {
                  const query = `
                    SELECT ${columns} FROM ${table}
                    WHERE ${column} >= $1 AND ${column2} <= $2 AND ${column3} = $3
                    ORDER BY ${orderColumn} ${options.ascending ? 'ASC' : 'DESC'},
                             ${orderColumn2} ${options2.ascending ? 'ASC' : 'DESC'}
                  `;
                  const result = await pool.query(query, [value, value2, value3]);
                  return { data: result.rows, error: null };
                }
              })
            })
          })
        })
      }),
      execute: async () => {
        const query = `SELECT ${columns} FROM ${table}`;
        const result = await pool.query(query);
        return { data: result.rows, error: null };
      }
    }),
    insert: (data: any | any[]) => ({
      select: () => ({
        execute: async () => {
          const dataArray = Array.isArray(data) ? data : [data];
          if (dataArray.length === 0) {
            return { data: [], error: null };
          }

          const columns = Object.keys(dataArray[0]);
          const values = dataArray.map(row => columns.map(col => row[col]));

          const placeholders = values.map((_, rowIndex) =>
            `(${columns.map((_, colIndex) => `$${rowIndex * columns.length + colIndex + 1}`).join(', ')})`
          ).join(', ');

          const query = `
            INSERT INTO ${table} (${columns.join(', ')})
            VALUES ${placeholders}
            RETURNING *
          `;

          const flatValues = values.flat();
          const result = await pool.query(query, flatValues);
          return { data: result.rows, error: null };
        }
      }),
      execute: async () => {
        const dataArray = Array.isArray(data) ? data : [data];
        if (dataArray.length === 0) {
          return { data: null, error: null };
        }

        const columns = Object.keys(dataArray[0]);
        const values = dataArray.map(row => columns.map(col => row[col]));

        const placeholders = values.map((_, rowIndex) =>
          `(${columns.map((_, colIndex) => `$${rowIndex * columns.length + colIndex + 1}`).join(', ')})`
        ).join(', ');

        const query = `
          INSERT INTO ${table} (${columns.join(', ')})
          VALUES ${placeholders}
        `;

        const flatValues = values.flat();
        await pool.query(query, flatValues);
        return { data: null, error: null };
      }
    }),
    update: (data: any) => ({
      eq: (column: string, value: any) => ({
        eq: (column2: string, value2: any) => ({
          execute: async () => {
            const columns = Object.keys(data);
            const setClause = columns.map((col, index) => `${col} = $${index + 1}`).join(', ');
            const values = columns.map(col => data[col]);

            const query = `
              UPDATE ${table}
              SET ${setClause}
              WHERE ${column} = $${values.length + 1} AND ${column2} = $${values.length + 2}
            `;

            const result = await pool.query(query, [...values, value, value2]);
            return { data: null, error: null };
          }
        }),
        execute: async () => {
          const columns = Object.keys(data);
          const setClause = columns.map((col, index) => `${col} = $${index + 1}`).join(', ');
          const values = columns.map(col => data[col]);

          const query = `
            UPDATE ${table}
            SET ${setClause}
            WHERE ${column} = $${values.length + 1}
          `;

          const result = await pool.query(query, [...values, value]);
          return { data: null, error: null };
        }
      })
    }),
    delete: () => ({
      eq: (column: string, value: any) => ({
        eq: (column2: string, value2: any) => ({
          execute: async () => {
            const query = `DELETE FROM ${table} WHERE ${column} = $1 AND ${column2} = $2`;
            await pool.query(query, [value, value2]);
            return { data: null, error: null };
          }
        }),
        execute: async () => {
          const query = `DELETE FROM ${table} WHERE ${column} = $1`;
          await pool.query(query, [value]);
          return { data: null, error: null };
        }
      })
    })
  }),

  rpc: async (functionName: string, params: any) => {
    try {
      const paramNames = Object.keys(params);
      const paramValues = Object.values(params);
      const placeholders = paramNames.map((_, index) => `$${index + 1}`).join(', ');

      const query = `SELECT * FROM ${functionName}(${placeholders})`;
      const result = await pool.query(query, paramValues);

      return { data: result.rows, error: null };
    } catch (error: any) {
      return { data: null, error };
    }
  },

  auth: {
    getUser: async () => ({
      data: {
        user: {
          id: '00000000-0000-0000-0000-000000000001'
        }
      }
    })
  }
};

// Função para testar conexão
export async function testConnection(): Promise<boolean> {
  try {
    const result = await pool.query('SELECT NOW()');
    console.log('✅ Conexão com PostgreSQL estabelecida:', result.rows[0].now);
    return true;
  } catch (error) {
    console.error('❌ Erro ao conectar com PostgreSQL:', error);
    return false;
  }
}

export default postgresDb;