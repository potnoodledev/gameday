import type { NextApiRequest, NextApiResponse } from 'next';
import { Pool, PoolConfig } from 'pg';

// Define a type for the full game data
interface GameDetails {
  id: number;
  user_wallet_address: string;
  game_name: string;
  html_content: string;
  created_at: string;
  updated_at: string;
  // Potentially add author's name/profile info if desired
}

// Define a type for the response data
type GetGameDetailsResponseData = {
  game?: GameDetails;
  message?: string;
  error?: string;
};

// Initialize a connection pool
let pool: Pool;
const poolConfig: PoolConfig = {};

if (process.env.DATABASE_URL) {
  poolConfig.connectionString = process.env.DATABASE_URL;
} 
pool = new Pool(poolConfig);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<GetGameDetailsResponseData>
) {
  if (req.method === 'GET') {
    const { gameId } = req.query;

    if (!gameId || typeof gameId !== 'string' || isNaN(parseInt(gameId, 10))) {
      return res.status(400).json({ message: 'Valid gameId query parameter is required.' });
    }

    const numericGameId = parseInt(gameId, 10);

    try {
      const query = `
        SELECT id, user_wallet_address, game_name, html_content, created_at, updated_at 
        FROM user_editable_games 
        WHERE id = $1;
      `;
      
      const { rows } = await pool.query<GameDetails>(query, [numericGameId]);

      if (rows.length > 0) {
        res.status(200).json({ game: rows[0] });
      } else {
        res.status(404).json({ message: 'Game not found.' });
      }

    } catch (error) {
      console.error('Error in /api/get-game-details:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      res.status(500).json({ message: 'Error fetching game details.', error: errorMessage });
    }
  } else {
    res.setHeader('Allow', ['GET']);
    res.status(405).json({ message: `Method ${req.method} Not Allowed` });
  }
} 