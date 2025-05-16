import type { NextApiRequest, NextApiResponse } from 'next';
import { Pool, PoolConfig } from 'pg';
import formidable, { File } from 'formidable';
import fs from 'fs';

// Disable Next.js body parsing for this route to use formidable
export const config = {
  api: {
    bodyParser: false,
  },
};

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
        'SELECT wallet_address, email, image_url, created_at, updated_at, profile_picture_data FROM user_profiles WHERE wallet_address = $1',
        [walletAddress]
      );

      if (result.rows.length > 0) {
        const profile = result.rows[0];
        if (profile.profile_picture_data) {
          // Convert BYTEA buffer to base64 string
          // Assuming the image is JPEG or PNG. Adjust mime type if necessary.
          profile.profilePictureBase64 = `data:image/jpeg;base64,${profile.profile_picture_data.toString('base64')}`;
        }
        delete profile.profile_picture_data; // Remove raw buffer from response

        res.status(200).json(profile);
      } else {
        res.status(404).json({ message: 'Profile not found' });
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
      res.status(500).json({ error: 'Internal server error while fetching profile' });
    }
  } else if (req.method === 'POST') {
    const form = formidable({});

    try {
      const [fields, files] = await form.parse(req);
      
      const walletAddress = Array.isArray(fields.walletAddress) ? fields.walletAddress[0] : fields.walletAddress;
      const email = Array.isArray(fields.email) ? fields.email[0] : fields.email;
      // imageUrl from form data is for users providing a URL string, not for file upload
      const imageUrl = Array.isArray(fields.imageUrl) ? fields.imageUrl[0] : fields.imageUrl;

      const uploadedFile = files.profileImage?.[0] as formidable.File | undefined;

      if (!walletAddress) {
        return res.status(400).json({ error: 'Wallet address is required for POST' });
      }
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ error: 'Invalid email format' });
      }
      if (imageUrl && !/^https?:\/\/.+\.[^\s@]+/.test(imageUrl)) {
        return res.status(400).json({ error: 'Invalid image URL format' });
      }

      let profilePictureData: Buffer | null = null;
      if (uploadedFile) {
        profilePictureData = fs.readFileSync(uploadedFile.filepath);
      }

      // Build the query dynamically based on whether a file is uploaded
      let upsertQuery;
      const queryParams = [];

      if (profilePictureData) {
        // If a file is uploaded, prioritize it and nullify image_url
        upsertQuery = `
          INSERT INTO user_profiles (wallet_address, email, image_url, profile_picture_data)
          VALUES ($1, $2, NULL, $3)
          ON CONFLICT (wallet_address) 
          DO UPDATE SET 
            email = COALESCE($2, user_profiles.email),
            image_url = NULL,
            profile_picture_data = $3,
            updated_at = NOW()
          RETURNING wallet_address, email, image_url, created_at, updated_at, profile_picture_data;
        `;
        queryParams.push(walletAddress, email || null, profilePictureData);
      } else {
        // No new file uploaded, update email and potentially imageUrl (if provided as text)
        upsertQuery = `
          INSERT INTO user_profiles (wallet_address, email, image_url)
          VALUES ($1, $2, $3)
          ON CONFLICT (wallet_address) 
          DO UPDATE SET 
            email = COALESCE($2, user_profiles.email),
            image_url = COALESCE($3, user_profiles.image_url),
            updated_at = NOW()
          RETURNING wallet_address, email, image_url, created_at, updated_at;
        `;
        queryParams.push(walletAddress, email || null, imageUrl || null);
      }
      
      const result = await pool.query(upsertQuery, queryParams);
      const returnedProfile = result.rows[0];

      // If profile_picture_data was updated, it's a Buffer.
      // Decide how to return it: omit, send as base64, or expect client to use a separate endpoint.
      // For now, let's omit the raw buffer from the direct JSON response for brevity.
      if (returnedProfile.profile_picture_data) {
        delete returnedProfile.profile_picture_data; // Don't send raw buffer in JSON
        // You might set a flag or a URL here if you generate one: e.g., returnedProfile.has_uploaded_image = true;
      }

      res.status(200).json(returnedProfile);

    } catch (error: any) {
      console.error('Error saving profile (formidable):', error);
      res.status(500).json({ error: 'Internal server error while saving profile', details: error.message });
    }
  } else {
    res.setHeader('Allow', ['GET', 'POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
} 