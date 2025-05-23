import type { NextApiRequest, NextApiResponse } from 'next';
import { Pool, PoolConfig } from 'pg'; // Import PoolConfig

// Define a type for the expected request body for clarity
type SaveGameRequestBody = {
  walletAddress: string;
  gameName: string;
  htmlContent: string;
  username: string;
  // Add any other expected fields, e.g., description, thumbnail_url
};

// Define a type for the response data
type SaveGameResponseData = {
  message: string;
  gameId?: string | number; // gameId could be a number if it's the serial ID
  error?: string;
};

// Initialize a connection pool (consistent with profile.ts)
let pool: Pool;
const poolConfig: PoolConfig = {};

if (process.env.DATABASE_URL) {
    poolConfig.connectionString = process.env.DATABASE_URL;
    // If your DB requires SSL and you're using DATABASE_URL, configure SSL here:
    // Example for Heroku/Render:
    // if (process.env.NODE_ENV === 'production') { 
    //   poolConfig.ssl = { rejectUnauthorized: false };
    // }
} else {
    // If DATABASE_URL is not set, the Pool constructor will automatically
    // use individual environment variables like PGHOST, PGUSER, PGDATABASE, PGPASSWORD, PGPORT.
    // No explicit assignment is needed here for those variables if they are set in the environment.
    // If SSL is needed without DATABASE_URL, configure it directly, e.g.:
    // if (process.env.NODE_ENV === 'production' && process.env.PGSSLMODE && process.env.PGSSLMODE !== 'disable') { 
    //    poolConfig.ssl = { rejectUnauthorized: false }; // Adjust as per your SSL requirements
    // }
}

pool = new Pool(poolConfig);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SaveGameResponseData>
) {
  if (req.method === 'POST') {
    try {
      const { walletAddress, gameName, htmlContent, username } = req.body as SaveGameRequestBody;

      if (!walletAddress || !gameName || !htmlContent) {
        return res.status(400).json({ message: 'Missing required fields: walletAddress, gameName, and htmlContent are required.' });
      }

      // First, ensure the user profile exists
      const checkProfileQuery = `
        INSERT INTO user_profiles (wallet_address, username)
        VALUES ($1, $2)
        ON CONFLICT (wallet_address) DO NOTHING
        RETURNING wallet_address;
      `;
      
      await pool.query(checkProfileQuery, [walletAddress, username]);

      // Now save the game
      const saveGameQuery = `
        INSERT INTO user_editable_games (user_wallet_address, game_name, html_content, username, updated_at)
        VALUES ($1, $2, $3, $4, NOW())
        ON CONFLICT (user_wallet_address, game_name) 
        DO UPDATE SET 
          html_content = EXCLUDED.html_content,
          username = EXCLUDED.username,
          updated_at = NOW()
        RETURNING id;
      `;

      const values = [walletAddress, gameName, htmlContent, username];
      
      const dbResponse = await pool.query(saveGameQuery, values);
      
      let newGameId: string | number = 'unknown';
      if (dbResponse.rows && dbResponse.rows.length > 0 && dbResponse.rows[0].id) {
        newGameId = dbResponse.rows[0].id;
      }

      res.status(201).json({ message: 'Game saved successfully!', gameId: newGameId });

    } catch (error) {
      console.error('Error in /api/save-user-game:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      // Check for unique constraint violation if not handled by ON CONFLICT (should be, but good to be aware)
      // if (error.code === '23505') { // PostgreSQL unique violation error code
      //   return res.status(409).json({ message: 'A game with this name already exists for your account.', error: errorMessage });
      // }
      res.status(500).json({ message: 'Error saving game.', error: errorMessage });
    }
  } else {
    res.setHeader('Allow', ['POST']);
    res.status(405).json({ message: `Method ${req.method} Not Allowed` });
  }
}

// Optional: You might want to add a unique constraint to your table if it doesn't exist yet
// to ensure the ON CONFLICT clause works correctly.
// You can do this via a new migration or directly in your DB:
/*
ALTER TABLE user_editable_games
ADD CONSTRAINT user_editable_games_user_wallet_address_game_name_key UNIQUE (user_wallet_address, game_name);
*/ 