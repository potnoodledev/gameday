import fetch from 'node-fetch';
// Dynamically import @google/genai when needed for Gemini

const SYSTEM_INSTRUCTIONS_GEMINI = `You are an expert web developer. The user will describe a game or change, and you will respond with a complete HTML file implementing their request. Use tailwindcss via CDN, Google Fonts, and put all JS in a <script type=\"module\"> tag. Create the app responsive with UI optimized for mobile. Do not use javascrip alerts. Do not include explanations, only output the HTML.`;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  // Read MODEL_PROVIDER from environment variables
  let modelProviderFromEnv = process.env.MODEL_PROVIDER?.toLowerCase();

  // get verbose logging from environment variable, if not set default to false
  const verboseLogging = process.env.LLM_VERBOSE_LOGGING?.toLowerCase() === 'true';

  if (!modelProviderFromEnv || (modelProviderFromEnv !== 'openai' && modelProviderFromEnv !== 'gemini')) {
    console.warn(`Warning: MODEL_PROVIDER environment variable is not set or is invalid ('${process.env.MODEL_PROVIDER}'). Defaulting to 'openai'. Valid values are 'openai' or 'gemini'.`);
    modelProviderFromEnv = 'openai'; // Default to OpenAI if not set or invalid
  }

  const { prompt, currentCode } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: 'Missing prompt' });
  }

  const messages = [
    { 
      role: 'system', 
      content: modelProviderFromEnv === 'gemini' 
        ? SYSTEM_INSTRUCTIONS_GEMINI 
        : `You are an expert web developer. The user will describe a game or change, and you will respond with a complete HTML file implementing their request. Use tailwindcss via CDN, Google Fonts, and put all JS in a <script type=\"module\"> tag. Create the app responsive with UI optimized for mobile. Do not use javascrip alerts. Do not include explanations, only output the HTML. If existing code is provided, modify it to implement the request, otherwise create a new game from scratch. Current code:\n\n${currentCode || ''}`
    },
    { role: 'user', content: prompt }
  ];

  if (modelProviderFromEnv === 'openai') {
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

      if (verboseLogging) console.log("OpenAI: Starting stream processing.");
      let contentGenerated = false;
      let doneProcessing = false;

      if (typeof response.body.on === 'function') {
        let buffer = "";
        response.body.on('data', (chunk) => {
          if (doneProcessing) return;
          const decodedChunk = chunk.toString();
          if (verboseLogging) console.log(`OpenAI: Received raw data chunk: ${decodedChunk.substring(0,50)}...`);
          buffer += decodedChunk;
          let eolIndex;
          while ((eolIndex = buffer.indexOf('\n')) >= 0) {
            if (doneProcessing) break;
            const line = buffer.substring(0, eolIndex).trim();
            buffer = buffer.substring(eolIndex + 1);

            if (line.startsWith("data: ")) {
              const dataJson = line.substring(5).trim();
              if (dataJson === "[DONE]") {
                if (verboseLogging) console.log("OpenAI: Received [DONE] message.");
                contentGenerated = true;
                doneProcessing = true;
                break; 
              }
              try {
                const parsed = JSON.parse(dataJson);
                if (parsed.choices && parsed.choices[0] && parsed.choices[0].delta && parsed.choices[0].delta.content) {
                  const textPart = parsed.choices[0].delta.content;
                  if (verboseLogging) console.log(`OpenAI: Writing part to response: ${textPart.substring(0, 30)}...`);
                  res.write(textPart);
                  contentGenerated = true;
                }
                if (parsed.choices && parsed.choices[0] && parsed.choices[0].finish_reason) {
                  if (verboseLogging) console.log(`OpenAI: Stream finished due to finish_reason: ${parsed.choices[0].finish_reason}`);
                  contentGenerated = true;
                }
              } catch (e) {
                console.error("OpenAI: Error parsing stream data JSON:", e, "Data:", dataJson);
              }
            }
          }
        });

        response.body.on('end', () => {
          if (verboseLogging) console.log("OpenAI: Stream ended.");
          if (!contentGenerated && !res.headersSent && !doneProcessing) {
            console.error("OpenAI: Stream ended, but no content was marked as generated and [DONE] not seen.");
          }
          if (verboseLogging) console.log("OpenAI: Finished stream processing (on end event).");
          if (!res.writableEnded) {
            res.end();
          }
        });

        response.body.on('error', (err) => {
          console.error('OpenAI: Error during stream:', err);
          doneProcessing = true;
          if (!res.headersSent) {
            res.status(500).json({ error: `OpenAI stream error: ${err.message}` });
          } else if (!res.writableEnded) {
            res.end();
          }
        });

      } else {
        console.error("OpenAI: response.body is not a Node.js Readable stream.");
        if (!res.headersSent) {
            return res.status(500).json({ error: 'OpenAI response body was not a Node.js stream as expected.' });
        }
        if (!res.writableEnded) res.end();
      }

    } catch (err) {
      console.error('Error calling OpenAI API:', err);
      res.status(500).json({ error: err.message || 'Internal Server Error' });
    }
  } else if (modelProviderFromEnv === 'gemini') {
    try {
      const geminiApiKey = process.env.GEMINI_API_KEY;
      if (!geminiApiKey) {
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

      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      const streamResult = await ai.models.generateContentStream({ 
        model: "gemini-2.5-pro-preview-05-06",
        contents: geminiContents 
      });
      
      let contentGenerated = false;
      if (verboseLogging) console.log("Gemini: Starting stream processing.");

      if (streamResult && streamResult.stream && typeof streamResult.stream[Symbol.asyncIterator] === 'function') {
        for await (const chunk of streamResult.stream) {
          if (verboseLogging) console.log("Gemini: Received chunk from SDK (via streamResult.stream).");
          if (chunk && chunk.candidates && chunk.candidates[0] && 
              chunk.candidates[0].content && chunk.candidates[0].content.parts && 
              Array.isArray(chunk.candidates[0].content.parts)) {
            for (const part of chunk.candidates[0].content.parts) {
              if (part.text && typeof part.text === 'string') {
                if (verboseLogging) console.log(`Gemini: Writing part to response: ${part.text.substring(0, 30)}...`);
                res.write(part.text);
                contentGenerated = true;
              }
            }
          }
        }
      } else if (streamResult && typeof streamResult[Symbol.asyncIterator] === 'function') {
        for await (const chunk of streamResult) {
          if (verboseLogging) console.log("Gemini: Received chunk from SDK (via direct iteration).");
          if (chunk && chunk.candidates && chunk.candidates[0] && 
              chunk.candidates[0].content && chunk.candidates[0].content.parts && 
              Array.isArray(chunk.candidates[0].content.parts)) {
            for (const part of chunk.candidates[0].content.parts) {
              if (part.text && typeof part.text === 'string') {
                if (verboseLogging) console.log(`Gemini: Writing part to response: ${part.text.substring(0, 30)}...`);
                res.write(part.text);
                contentGenerated = true;
              }
            }
          }
        }
      } else {
        if (verboseLogging) console.log("Gemini: Stream result not iterable, attempting to process as single response.");
        if (streamResult && streamResult.candidates && streamResult.candidates[0] && 
            streamResult.candidates[0].content && streamResult.candidates[0].content.parts && 
            Array.isArray(streamResult.candidates[0].content.parts)) {
          for (const part of streamResult.candidates[0].content.parts) {
            if (part.text && typeof part.text === 'string') {
              if (verboseLogging) console.log(`Gemini: Writing part to response (single): ${part.text.substring(0, 30)}...`);
              res.write(part.text);
              contentGenerated = true;
            }
          }
        } else {
          console.error('Gemini API response was not iterable and did not yield text as single object with expected parts structure.', streamResult);
        }
      }

      if (!contentGenerated && !res.headersSent) {
          console.error("Gemini: No content generated for stream, and headers not sent.");
          return res.status(500).json({ error: 'Gemini processed, but no content generated or extracted for stream.' });
      }
      
      if (verboseLogging) console.log("Gemini: Finished stream processing.");
      res.end();

    } catch (err) {
      console.error('Error calling Gemini API:', err);
      if (!res.headersSent) {
        if (err.message && err.message.includes('API key not valid')) {
          return res.status(401).json({ error: 'Gemini API key not valid. Please check your configuration.'});
        }
        return res.status(500).json({ error: err.message || 'Internal ServerError calling Gemini' });
      }
      res.end();
    }
  } else {
    // This case should ideally not be reached due to the default modelProviderFromEnv setting
    console.error(`Invalid modelProviderFromEnv after defaulting: ${modelProviderFromEnv}`);
    res.status(500).json({ error: 'Internal server error: Invalid model provider configured after default.' });
  }
} 