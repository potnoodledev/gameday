import fetch from 'node-fetch';
// Dynamically import @google/genai when needed for Gemini

const SYSTEM_INSTRUCTIONS_GEMINI = `You are an expert web developer. The user will describe a game or change, and you will respond with a complete HTML file implementing their request. Use tailwindcss via CDN, Google Fonts, and put all JS in a <script type=\"module\"> tag. Create the app responsive with UI optimized for mobile. Do not use javascrip alerts. Do not include explanations, only output the HTML.`;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const { prompt, model, currentCode } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: 'Missing prompt' });
  }
  if (!model) {
    return res.status(400).json({ error: 'Missing model selection' });
  }

  // Construct messages array (OpenAI format)
  // The old server.js code expected `messages` in the body for OpenAI/Gemini routes.
  // Here, we construct it based on `prompt` and `currentCode`.
  const messages = [
    { 
      role: 'system', 
      content: model === 'gemini' 
        ? SYSTEM_INSTRUCTIONS_GEMINI 
        : `You are an expert web developer. The user will describe a game or change, and you will respond with a complete HTML file implementing their request. Use tailwindcss via CDN, Google Fonts, and put all JS in a <script type=\"module\"> tag. Create the app responsive with UI optimized for mobile. Do not use javascrip alerts. Do not include explanations, only output the HTML. If existing code is provided, modify it to implement the request, otherwise create a new game from scratch. Current code:\n\n${currentCode || ''}`
    },
    { role: 'user', content: prompt }
  ];

  if (model === 'openai') {
    try {
      const openaiApiKey = process.env.OPENAI_API_KEY;
      if (!openaiApiKey) {
        return res.status(500).json({ error: 'OpenAI API key not configured on server' });
      }
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openaiApiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4.1', // Updated model to gpt-4.1
          messages: messages.filter(m => m.role !== 'system' || m.content !== SYSTEM_INSTRUCTIONS_GEMINI), // OpenAI doesn't use Gemini system prompt
        })
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: response.statusText }));
        console.error('OpenAI API Error:', errorData);
        return res.status(response.status).json({ error: `OpenAI API Error: ${errorData.detail || errorData.error?.message || 'Unknown error'}` });
      }
      const data = await response.json();
      let html = '';
      if (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) {
        html = data.choices[0].message.content.trim();
        if (html.startsWith('```html')) html = html.replace(/^```html\s*/, '').replace(/```$/, '');
      }
      res.status(200).json({ newCode: html });
    } catch (err) {
      console.error('Error calling OpenAI API:', err);
      res.status(500).json({ error: err.message || 'Internal Server Error' });
    }
  } else if (model === 'gemini') {
    try {
      const geminiApiKey = process.env.GEMINI_API_KEY;
      if (!geminiApiKey) {
        return res.status(500).json({ error: 'Gemini API key not configured on server' });
      }
      const { GoogleGenAI } = await import('@google/genai'); 
      const ai = new GoogleGenAI({ apiKey: geminiApiKey }); // Changed variable name and constructor

      // Construct `contents` for Gemini API, following server.js structure
      const geminiContents = [];
      // System prompt (as user role, similar to server.js)
      geminiContents.push({
        role: 'user',
        parts: [{ text: SYSTEM_INSTRUCTIONS_GEMINI + (currentCode ? `\n\nCurrent code:\n\n${currentCode}` : '') }]
      });
      // Add a model priming message if we want to mimic a chat start
      geminiContents.push({
        role: 'model',
        parts: [{ text: "Okay, I understand. I will provide a complete HTML file based on your next request, modifying the current code if provided." }]
      });
      // User's actual prompt
      geminiContents.push({ 
        role: 'user', 
        parts: [{ text: prompt }]
      });

      // Use generateContentStream as per server.js
      const streamResult = await ai.models.generateContentStream({ 
        model: "gemini-2.5-pro-preview-05-06", //"gemini-2.5-pro-exp-03-25",
        contents: geminiContents 
      });
      
      let html = '';
      const processChunk = (chunkInput) => {
        let textFromChunk = "";
        if (chunkInput && chunkInput.candidates && chunkInput.candidates[0] && 
            chunkInput.candidates[0].content && chunkInput.candidates[0].content.parts && 
            Array.isArray(chunkInput.candidates[0].content.parts)) {
          for (const part of chunkInput.candidates[0].content.parts) {
            if (part.text && typeof part.text === 'string') {
              textFromChunk += part.text;
            }
          }
        }
        return textFromChunk;
      };

      if (streamResult && streamResult.stream && typeof streamResult.stream[Symbol.asyncIterator] === 'function') {
        // Path 1: streamResult.stream is the async iterator
        for await (const chunk of streamResult.stream) {
          const text = processChunk(chunk);
          if (text) {
            html += text;
          } else {
            console.warn("Gemini stream chunk from streamResult.stream did not yield text:", chunk);
          }
        }
      } else if (streamResult && typeof streamResult[Symbol.asyncIterator] === 'function') {
        // Path 2: streamResult itself is the async iterator (log implies this path)
        for await (const chunk of streamResult) { // chunk is a GenerateContentResponse
          const text = processChunk(chunk);
          if (text) {
            html += text;
          } else {
            // This log indicates a chunk was received, but processChunk didn't extract text.
            // It could be an empty chunk or a non-text part.
            console.warn("Gemini stream chunk from direct iteration did not yield text via processChunk:", chunk);
          }
        }
      } else {
        // Fallback: streamResult is not iterable, try to process it as a single complete response.
        console.warn('Gemini API response was not iterable, attempting to process as single response.', streamResult);
        const text = processChunk(streamResult); 
        if (text) {
          html = text;
        } else {
          console.error('Failed to process non-iterable Gemini response as single object.', streamResult);
          throw new Error('Failed to process response from Gemini API - not iterable and not a recognized single response structure.');
        }
      }

      if (!html) {
        // If html is still empty after all attempts, it indicates a problem.
        console.error("Gemini response processing resulted in empty HTML. streamResult (final check, if available):", streamResult);
        return res.status(500).json({ error: 'Gemini processed, but no content generated or extracted.' });
      }
      
      res.status(200).json({ newCode: html.replace(/^```html\s*/, '').replace(/```$/, '') });

    } catch (err) {
      console.error('Error calling Gemini API:', err);
      // Check for specific error types if possible
      if (err.message && err.message.includes('API key not valid')) {
        return res.status(401).json({ error: 'Gemini API key not valid. Please check your configuration.'});
      }
      res.status(500).json({ error: err.message || 'Internal Server Error calling Gemini' });
    }
  } else {
    res.status(400).json({ error: 'Invalid model selected' });
  }
} 