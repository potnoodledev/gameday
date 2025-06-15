import type { NextApiRequest, NextApiResponse } from 'next';

const NOODS_API_BASE = 'https://noods.cc/api';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { endpoint, ...queryParams } = req.query;

  if (!endpoint || typeof endpoint !== 'string') {
    return res.status(400).json({ error: 'Endpoint parameter is required' });
  }

  // Build the query string from remaining query parameters
  const queryString = Object.entries(queryParams)
    .map(([key, value]) => `${key}=${value}`)
    .join('&');

  const url = `${NOODS_API_BASE}/${endpoint}${queryString ? `?${queryString}` : ''}`;

  try {
    const response = await fetch(url);
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    console.error(`Error proxying to ${endpoint}:`, error);
    res.status(500).json({ error: `Failed to fetch from ${endpoint}` });
  }
} 