import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import TwitterPipeline from '../twitter/TwitterPipeline.js';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs/promises';
import OpenAI from 'openai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

// Store connected clients
const clients = new Set();

app.use(cors());
app.use(express.json());

// Only serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../../client/dist')));
}

// SSE endpoint for logs
app.get('/api/logs', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // Send a test message
  res.write('data: Connected to log stream\n\n');

  // Add client to the set
  clients.add(res);

  // Remove client when connection closes
  req.on('close', () => {
    clients.delete(res);
  });
});

// Function to broadcast log to all connected clients
const broadcastLog = (log) => {
  clients.forEach(client => {
    client.write(`data: ${JSON.stringify(log)}\n\n`);
  });
};

// Start scraping tweets for a username
app.post('/api/scrape', async (req, res) => {
  try {
    const { username } = req.body;
    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }

    const pipeline = new TwitterPipeline(username);
    
    // Override console methods to capture logs
    const originalLog = console.log;
    const originalInfo = console.info;
    const originalWarn = console.warn;
    const originalError = console.error;

    console.log = (...args) => {
      originalLog.apply(console, args);
      broadcastLog({ type: 'log', message: args.join(' ') });
    };

    console.info = (...args) => {
      originalInfo.apply(console, args);
      broadcastLog({ type: 'info', message: args.join(' ') });
    };

    console.warn = (...args) => {
      originalWarn.apply(console, args);
      broadcastLog({ type: 'warning', message: args.join(' ') });
    };

    console.error = (...args) => {
      originalError.apply(console, args);
      broadcastLog({ type: 'error', message: args.join(' ') });
    };

    // Start the scraping process
    pipeline.run().catch((error) => {
      console.error('Pipeline error:', error);
    });

    res.json({ message: 'Scraping started', username });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get scraping status
app.get('/api/status/:username', async (req, res) => {
  try {
    const { username } = req.params;
    const date = new Date().toISOString().split('T')[0];
    const statsPath = path.join(__dirname, `../../pipeline/${username}/${date}/analytics/stats.json`);
    
    try {
      const stats = await fs.readFile(statsPath, 'utf8');
      res.json(JSON.parse(stats));
    } catch (error) {
      res.json({ status: 'in_progress' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Generate character
app.post('/api/generate-character', async (req, res) => {
  try {
    const { username } = req.body;
    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }

    const date = new Date().toISOString().split('T')[0];
    const characterPath = path.join(__dirname, `../../pipeline/${username}/${date}/character/character.json`);
    
    try {
      const character = await fs.readFile(characterPath, 'utf8');
      res.json(JSON.parse(character));
    } catch (error) {
      // If character doesn't exist, generate it
      const process = await import('../virtuals/GenerateCharacter.js');
      await process.default(username, date);
      
      const character = await fs.readFile(characterPath, 'utf8');
      res.json(JSON.parse(character));
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Chat with character
app.post('/api/chat', async (req, res) => {
  try {
    const { username, message } = req.body;
    if (!username || !message) {
      return res.status(400).json({ error: 'Username and message are required' });
    }

    const date = new Date().toISOString().split('T')[0];
    const characterPath = path.join(__dirname, `../../pipeline/${username}/${date}/character/character.json`);
    
    const character = JSON.parse(await fs.readFile(characterPath, 'utf8'));
    
    // Use OpenAI to generate response based on character
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: `${character.forum_start_system_prompt}\n\n${character.description}\n\n${character.forum_end_system_prompt}`
        },
        {
          role: 'user',
          content: message
        }
      ]
    });

    res.json({ response: response.choices[0].message.content });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Only serve index.html in production
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../../client/dist/index.html'));
  });
}

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
}); 