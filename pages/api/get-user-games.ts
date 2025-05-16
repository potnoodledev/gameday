import type { NextApiRequest, NextApiResponse } from 'next';
import { Pool, PoolConfig } from 'pg';

// Define a type for the game data we expect to return
interface UserGame {
  id: number;
  user_wallet_address: string;
  game_name: string;
  html_content: string; // Or just specific metadata if full HTML is too large for a list
  created_at: string;
  updated_at: string;
}

// Define a type for the response data
type GetUserGamesResponseData = {
  games?: UserGame[];
  message?: string;
  error?: string;
};

// Initialize a connection pool (consistent with other API routes)
let pool: Pool;
const poolConfig: PoolConfig = {};

if (process.env.DATABASE_URL) {
  poolConfig.connectionString = process.env.DATABASE_URL;
  // if (process.env.NODE_ENV === 'production') { 
  //   poolConfig.ssl = { rejectUnauthorized: false };
  // }
} else {
  // Pool constructor will use individual PG environment variables
}
pool = new Pool(poolConfig);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<GetUserGamesResponseData>
) {
  if (req.method === 'GET') {
    const { walletAddress } = req.query;

    if (!walletAddress || typeof walletAddress !== 'string') {
      return res.status(400).json({ message: 'Wallet address query parameter is required.' });
    }

    try {
      const query = `
        SELECT id, user_wallet_address, game_name, created_at, updated_at 
        FROM user_editable_games 
        WHERE user_wallet_address = $1
        ORDER BY updated_at DESC;
      `;
      // Note: We are not selecting html_content here to keep the payload small for a list.
      // If you need html_content, add it to the SELECT statement.

      const { rows } = await pool.query<UserGame>(query, [walletAddress]);

      res.status(200).json({ games: rows });

    } catch (error) {
      console.error('Error in /api/get-user-games:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      res.status(500).json({ message: 'Error fetching user games.', error: errorMessage });
    }
  } else {
    res.setHeader('Allow', ['GET']);
    res.status(405).json({ message: `Method ${req.method} Not Allowed` });
  }
} 