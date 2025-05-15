import type { NextApiRequest, NextApiResponse } from 'next';
import { Pool, PoolConfig } from 'pg';

// Initialize a connection pool.
// The pool will use connection details from environment variables
// (PGHOST, PGUSER, PGDATABASE, PGPASSWORD, PGPORT) or a DATABASE_URL string.
let pool: Pool;

const poolConfig: PoolConfig = {};

if (process.env.DATABASE_URL) {
    poolConfig.connectionString = process.env.DATABASE_URL;
    // Example SSL config for services like Heroku/Render - uncomment if needed
    // poolConfig.ssl = { rejectUnauthorized: false };
} else {
    // If DATABASE_URL is not set, Pool will use individual PG environment variables
    // e.g., PGHOST, PGUSER, PGDATABASE, PGPASSWORD, PGPORT
    // No specific config needed here if those are set, or Pool will use defaults.
}

pool = new Pool(poolConfig);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === 'GET') {
    const { walletAddress } = req.query;

    if (!walletAddress || typeof walletAddress !== 'string') {
      return res.status(400).json({ error: 'Wallet address is required' });
    }

    try {
      const result = await pool.query(
        'SELECT wallet_address, email, image_url, created_at, updated_at FROM user_profiles WHERE wallet_address = $1',
        [walletAddress]
      );

      if (result.rows.length > 0) {
        res.status(200).json(result.rows[0]);
      } else {
        res.status(404).json({ message: 'Profile not found' });
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
      res.status(500).json({ error: 'Internal server error while fetching profile' });
    }
  } else if (req.method === 'POST') {
    const { walletAddress, email, imageUrl } = req.body;

    if (!walletAddress) {
      return res.status(400).json({ error: 'Wallet address is required for POST' });
    }
    // Basic email validation (can be more sophisticated)
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ error: 'Invalid email format' });
    }
    // Basic URL validation for image (can be more sophisticated)
    if (imageUrl && !/^https?:\/\/.+\.[^\s@]+/.test(imageUrl)) {
        return res.status(400).json({ error: 'Invalid image URL format' });
    }

    try {
      // UPSERT operation: Update if exists, Insert if not.
      // The COALESCE function is used to keep the existing value if the new value is null/undefined for optional fields.
      const upsertQuery = `
        INSERT INTO user_profiles (wallet_address, email, image_url)
        VALUES ($1, $2, $3)
        ON CONFLICT (wallet_address) 
        DO UPDATE SET 
          email = COALESCE($2, user_profiles.email),
          image_url = COALESCE($3, user_profiles.image_url),
          updated_at = NOW()
        RETURNING wallet_address, email, image_url, created_at, updated_at;
      `;
      const result = await pool.query(upsertQuery, [walletAddress, email || null, imageUrl || null]);
      
      res.status(200).json(result.rows[0]);
    } catch (error) {
      console.error('Error saving profile:', error);
      res.status(500).json({ error: 'Internal server error while saving profile' });
    }
  } else {
    res.setHeader('Allow', ['GET', 'POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
} 