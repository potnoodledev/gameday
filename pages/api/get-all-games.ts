import type { NextApiRequest, NextApiResponse } from 'next';
import { Pool, PoolConfig } from 'pg';

// Define a type for the game data we expect to return, including author info
interface CommunityGame {
  gameId: number; // from user_editable_games.id
  gameName: string; // from user_editable_games.game_name
  userId: string; // from user_editable_games.user_wallet_address
  userName: string; // from user_profiles.email or a display name if you add one
  lastUpdated: string; // from user_editable_games.updated_at
  creatorProfilePicUrl?: string; // URL for the creator's profile picture (base64 or direct link)
  // status: string; // Status is not in the current db schema for games
  // We are not fetching html_content for the list view
}

// Define a type for the response data
type GetAllGamesResponseData = {
  games?: CommunityGame[];
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
  res: NextApiResponse<GetAllGamesResponseData>
) {
  if (req.method === 'GET') {
    try {
      // Query to fetch all games and join with user_profiles to get creator's name
      // Using COALESCE to provide a fallback if email is null (e.g., short wallet address)
      const query = `
        SELECT 
          g.id AS "gameId", 
          g.game_name AS "gameName", 
          g.user_wallet_address AS "userId", 
          COALESCE(NULLIF(up.username, ''), NULLIF(up.email, ''), SUBSTRING(g.user_wallet_address FROM 1 FOR 4) || '..' || SUBSTRING(g.user_wallet_address FROM LENGTH(g.user_wallet_address) - 3 FOR 4)) AS "userName", 
          g.updated_at AS "lastUpdated",
          up.image_url AS "rawImageUrl",         -- Raw image_url from user_profiles
          up.profile_picture_data AS "profilePictureData", -- Raw BYTEA data
          up.username AS "userProvidedUsername" -- Also fetch username directly for potential other uses
        FROM user_editable_games g
        LEFT JOIN user_profiles up ON g.user_wallet_address = up.wallet_address
        ORDER BY g.updated_at DESC;
      `;
      // Consider adding LIMIT and OFFSET for pagination if the game list becomes large

      const { rows } = await pool.query(query); // Let pg infer types for now, process below

      const processedGames: CommunityGame[] = rows.map(row => {
        let creatorProfilePicUrl: string | undefined = undefined;
        if (row.profilePictureData) {
          // Convert BYTEA buffer to base64 data URL
          creatorProfilePicUrl = `data:image/jpeg;base64,${Buffer.from(row.profilePictureData).toString('base64')}`;
        } else if (row.rawImageUrl) {
          creatorProfilePicUrl = row.rawImageUrl;
        }

        return {
          gameId: row.gameId,
          gameName: row.gameName,
          userId: row.userId,
          userName: row.userName,
          lastUpdated: row.lastUpdated,
          creatorProfilePicUrl: creatorProfilePicUrl,
        };
      });

      res.status(200).json({ games: processedGames });

    } catch (error) {
      console.error('Error in /api/get-all-games:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      res.status(500).json({ message: 'Error fetching all games.', error: errorMessage });
    }
  } else {
    res.setHeader('Allow', ['GET']);
    res.status(405).json({ message: `Method ${req.method} Not Allowed` });
  }
} 