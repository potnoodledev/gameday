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
          model: 'gpt-4.1',
          messages: messages.filter(m => m.role !== 'system' || m.content !== SYSTEM_INSTRUCTIONS_GEMINI),
          stream: true
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: response.statusText }));
        console.error('OpenAI API Error (before stream):', errorData);
        return res.status(response.status).json({ error: `OpenAI API Error: ${errorData.detail || errorData.error?.message || 'Unknown error'}` });
      }

      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      console.log("OpenAI: Starting stream processing.");
      let contentGenerated = false;
      let doneProcessing = false; // Flag to signal completion

      // Check if response.body is a Node.js Readable stream
      if (typeof response.body.on === 'function') { // Node.js stream
        let buffer = "";
        response.body.on('data', (chunk) => {
          if (doneProcessing) return; // Stop processing if [DONE] was received
          const decodedChunk = chunk.toString(); // Convert Buffer to string
          console.log(`OpenAI: Received raw data chunk: ${decodedChunk.substring(0,50)}...`);
          buffer += decodedChunk;
          let eolIndex;
          while ((eolIndex = buffer.indexOf('\n')) >= 0) {
            if (doneProcessing) break;
            const line = buffer.substring(0, eolIndex).trim();
            buffer = buffer.substring(eolIndex + 1);

            if (line.startsWith("data: ")) {
              const dataJson = line.substring(5).trim();
              if (dataJson === "[DONE]") {
                console.log("OpenAI: Received [DONE] message.");
                contentGenerated = true;
                doneProcessing = true; // Signal to stop processing further chunks
                break; 
              }
              try {
                const parsed = JSON.parse(dataJson);
                if (parsed.choices && parsed.choices[0] && parsed.choices[0].delta && parsed.choices[0].delta.content) {
                  const textPart = parsed.choices[0].delta.content;
                  console.log(`OpenAI: Writing part to response: ${textPart.substring(0, 30)}...`);
                  res.write(textPart);
                  contentGenerated = true;
                }
                if (parsed.choices && parsed.choices[0] && parsed.choices[0].finish_reason) {
                  console.log(`OpenAI: Stream finished due to finish_reason: ${parsed.choices[0].finish_reason}`);
                  contentGenerated = true;
                  // doneProcessing = true; // [DONE] is the primary signal
                }
              } catch (e) {
                console.error("OpenAI: Error parsing stream data JSON:", e, "Data:", dataJson);
              }
            }
          }
        });

        response.body.on('end', () => {
          console.log("OpenAI: Stream ended.");
          if (!contentGenerated && !res.headersSent && !doneProcessing) {
            console.error("OpenAI: Stream ended, but no content was marked as generated and [DONE] not seen.");
            // It's tricky to send a JSON error here as headers might be sent for an empty stream
            // or an error might have occurred mid-stream but not caught by 'error' handler below.
            // The client will likely timeout or receive an empty response.
          }
          console.log("OpenAI: Finished stream processing (on end event).");
          if (!res.writableEnded) {
            res.end(); // End the stream to our client
          }
        });

        response.body.on('error', (err) => {
          console.error('OpenAI: Error during stream:', err);
          doneProcessing = true; // Stop further processing on error
          if (!res.headersSent) {
            res.status(500).json({ error: `OpenAI stream error: ${err.message}` });
          } else if (!res.writableEnded) {
            res.end(); // Ensure stream to client is closed
          }
        });

      } else {
        // Fallback if response.body is not a Node.js stream (should not happen in API routes)
        console.error("OpenAI: response.body is not a Node.js Readable stream.");
        if (!res.headersSent) {
            return res.status(500).json({ error: 'OpenAI response body was not a Node.js stream as expected.' });
        }
        if (!res.writableEnded) res.end();
      }
      // Note: res.end() is now primarily called in the 'end' event of response.body
      // or in error conditions. We don't call it immediately after setting up listeners.

    } catch (err) {
      console.error('Error calling OpenAI API:', err);
      res.status(500).json({ error: err.message || 'Internal Server Error' });
    }
  } else if (model === 'gemini') {
    try {
      const geminiApiKey = process.env.GEMINI_API_KEY;
      if (!geminiApiKey) {
        // Ensure we don't set headers if we're about to send JSON error
        return res.status(500).json({ error: 'Gemini API key not configured on server' });
      }
      const { GoogleGenAI } = await import('@google/genai'); 
      const ai = new GoogleGenAI({ apiKey: geminiApiKey });

      const geminiContents = [];
      geminiContents.push({
        role: 'user',
        parts: [{ text: SYSTEM_INSTRUCTIONS_GEMINI + (currentCode ? `\n\nCurrent code:\n\n${currentCode}` : '') }]
      });
      geminiContents.push({
        role: 'model',
        parts: [{ text: "Okay, I understand. I will provide a complete HTML file based on your next request, modifying the current code if provided." }]
      });
      geminiContents.push({ 
        role: 'user', 
        parts: [{ text: prompt }]
      });

      // Set headers for streaming plain text
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      // For some environments like Nginx, to prevent buffering:
      // res.setHeader('X-Accel-Buffering', 'no');

      const streamResult = await ai.models.generateContentStream({ 
        model: "gemini-2.5-pro-preview-05-06",
        contents: geminiContents 
      });
      
      let contentGenerated = false;
      console.log("Gemini: Starting stream processing.");

      if (streamResult && streamResult.stream && typeof streamResult.stream[Symbol.asyncIterator] === 'function') {
        for await (const chunk of streamResult.stream) {
          console.log("Gemini: Received chunk from SDK (via streamResult.stream).");
          if (chunk && chunk.candidates && chunk.candidates[0] && 
              chunk.candidates[0].content && chunk.candidates[0].content.parts && 
              Array.isArray(chunk.candidates[0].content.parts)) {
            for (const part of chunk.candidates[0].content.parts) {
              if (part.text && typeof part.text === 'string') {
                console.log(`Gemini: Writing part to response: ${part.text.substring(0, 30)}...`);
                res.write(part.text);
                contentGenerated = true;
              }
            }
          }
        }
      } else if (streamResult && typeof streamResult[Symbol.asyncIterator] === 'function') {
        for await (const chunk of streamResult) { // chunk is a GenerateContentResponse
          console.log("Gemini: Received chunk from SDK (via direct iteration).");
          if (chunk && chunk.candidates && chunk.candidates[0] && 
              chunk.candidates[0].content && chunk.candidates[0].content.parts && 
              Array.isArray(chunk.candidates[0].content.parts)) {
            for (const part of chunk.candidates[0].content.parts) {
              if (part.text && typeof part.text === 'string') {
                console.log(`Gemini: Writing part to response: ${part.text.substring(0, 30)}...`);
                res.write(part.text);
                contentGenerated = true;
              }
            }
          }
        }
      } else {
        // Fallback: streamResult is not iterable, try to process it as a single complete response.
        console.log("Gemini: Stream result not iterable, attempting to process as single response.");
        if (streamResult && streamResult.candidates && streamResult.candidates[0] && 
            streamResult.candidates[0].content && streamResult.candidates[0].content.parts && 
            Array.isArray(streamResult.candidates[0].content.parts)) {
          for (const part of streamResult.candidates[0].content.parts) {
            if (part.text && typeof part.text === 'string') {
              console.log(`Gemini: Writing part to response (single): ${part.text.substring(0, 30)}...`);
              res.write(part.text);
              contentGenerated = true;
            }
          }
        } else {
          console.error('Gemini API response was not iterable and did not yield text as single object with expected parts structure.', streamResult);
        }
      }

      if (!contentGenerated && !res.headersSent) {
          // This should ideally not be hit. If it is, something went wrong before streaming started.
          console.error("Gemini: No content generated for stream, and headers not sent.");
          return res.status(500).json({ error: 'Gemini processed, but no content generated or extracted for stream.' });
      }
      
      console.log("Gemini: Finished stream processing.");
      res.end(); // End the stream

    } catch (err) {
      console.error('Error calling Gemini API:', err);
      if (!res.headersSent) { // Only send JSON error if headers haven't been set for streaming
        if (err.message && err.message.includes('API key not valid')) {
          return res.status(401).json({ error: 'Gemini API key not valid. Please check your configuration.'});
        }
        return res.status(500).json({ error: err.message || 'Internal Server Error calling Gemini' });
      }
      // If headers were sent, the stream will just end, possibly abruptly.
      res.end(); // Ensure response is ended.
    }
  } else {
    res.status(400).json({ error: 'Invalid model selected' });
  }
} 