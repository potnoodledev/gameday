import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const { htmlContent } = req.body;

  if (typeof htmlContent !== 'string') {
    return res.status(400).json({ error: 'Missing htmlContent or incorrect format' });
  }

  try {
    // In Next.js, __dirname is not available in the same way as Node.js scripts.
    // process.cwd() gives the project root.
    // Files in `public` are served at the root, so we write to `public/games/livegame.html`.
    const filePath = path.join(process.cwd(), 'public', 'games', 'livegame.html');
    
    await fs.promises.writeFile(filePath, htmlContent, 'utf8');
    res.status(200).json({ message: 'Live game published successfully!' });
  } catch (err) {
    console.error('Failed to save live game:', err);
    res.status(500).json({ error: 'Failed to save live game', details: err.message });
  }
} 