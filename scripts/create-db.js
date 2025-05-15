const { Client } = require('pg');
const dotenv = require('dotenv');

// Load environment variables from .env.local
dotenv.config({ path: '.env' });

const main = async () => {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('Error: DATABASE_URL environment variable is not set.');
    console.error('Please create a .env.local file with DATABASE_URL (e.g., postgresql://user:password@host:port/dbname)');
    process.exit(1);
  }

  let dbName;
  let baseConnectionString;

  try {
    const url = new URL(connectionString);
    dbName = url.pathname.startsWith('/') ? url.pathname.substring(1) : url.pathname;
    if (!dbName) {
      throw new Error('Database name could not be parsed from DATABASE_URL.');
    }
    // Create a connection string for the default 'postgres' database (or another maintenance DB)
    url.pathname = '/postgres'; // Or your PostgreSQL server's default maintenance database
    baseConnectionString = url.toString();
  } catch (err) {
    console.error('Error: Invalid DATABASE_URL format.', err.message);
    console.error('Expected format: postgresql://user:password@host:port/dbname');
    process.exit(1);
  }

  const client = new Client({ connectionString: baseConnectionString });

  try {
    await client.connect();
    console.log(`Connected to PostgreSQL server (maintenance database: ${client.database || 'postgres'}).`);

    // Check if database already exists
    const res = await client.query(`SELECT 1 FROM pg_database WHERE datname = $1`, [dbName]);
    if (res.rowCount > 0) {
      console.log(`Database "${dbName}" already exists.`);
    } else {
      console.log(`Attempting to create database "${dbName}"...`);
      await client.query(`CREATE DATABASE "${dbName}"`);
      console.log(`Database "${dbName}" created successfully.`);
    }
  } catch (err) {
    console.error(`Error during database operation: ${err.message}`);
    if (err.code === '3D000' && err.message.includes(dbName)) { // 3D000: invalid_catalog_name (often if trying to connect to a non-existent DB)
        console.error(`Hint: Ensure the base database (e.g., 'postgres') exists and you have permissions.`)
    } else if (err.code === '42P04') { // 42P04: duplicate_database
        console.error(`Database "${dbName}" likely already exists.`);
    } else if (err.code === 'ECONNREFUSED') {
        console.error('Connection refused. Ensure PostgreSQL server is running and accessible.');
    }
  } finally {
    await client.end();
    console.log('Disconnected from PostgreSQL server.');
  }
};

main().catch(err => {
  console.error('Unhandled error in script:', err);
  process.exit(1);
}); 