import type { NextApiRequest, NextApiResponse } from 'next';
import { Pool, PoolConfig } from 'pg';

let pool: Pool;
const poolConfig: PoolConfig = {};
if (process.env.DATABASE_URL) {
    poolConfig.connectionString = process.env.DATABASE_URL;
} else {
    // Assumes PGHOST, PGUSER, PGDATABASE, PGPASSWORD, PGPORT are set if DATABASE_URL is not
}
pool = new Pool(poolConfig);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === 'POST') { // Or DELETE, but POST is simpler for sending body from client
    const { gameId, walletAddress } = req.body;

    if (!gameId) {
      return res.status(400).json({ error: 'Game ID is required' });
    }
    if (!walletAddress) {
      return res.status(400).json({ error: 'Wallet address is required' });
    }

    try {
      const result = await pool.query(
        'DELETE FROM user_editable_games WHERE id = $1 AND user_wallet_address = $2 RETURNING id',
        [gameId, walletAddress]
      );

      if (result && typeof result.rowCount === 'number' && result.rowCount > 0) {
        res.status(200).json({ message: 'Game deleted successfully', deletedGameId: result.rows[0].id });
      } else {
        // This could mean the game didn't exist, or the wallet address didn't match.
        // For security, avoid saying "game not found" if the wallet doesn't match, to prevent probing.
        res.status(404).json({ error: 'Game not found or you do not have permission to delete it.' });
      }
    } catch (error) {
      console.error('Error deleting game:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      res.status(500).json({ error: 'Internal server error while deleting game', details: errorMessage });
    }
  } else {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
} 