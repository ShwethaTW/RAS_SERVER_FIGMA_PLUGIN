// server.js
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { Configuration, OpenAIApi } = require('openai');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Constants
const EMBEDDING_PATH = path.join(__dirname, 'embedding.json');
const EMBEDDING_URL = 'https://drive.google.com/uc?export=download&id=1TitJ0YyFlFlhLIWX5oyUEvanC3c1kHCe';

let embeddings = [];

// Setup Express
const app = express();
app.use(cors());
app.use(bodyParser.json());

// OpenAI Config
const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

// Cosine similarity helper
function cosineSimilarity(a, b) {
  const dot = a.reduce((sum, val, i) => sum + val * b[i], 0);
  const magA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const magB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
  return dot / (magA * magB);
}

// Download embedding.json if missing
async function ensureEmbeddingFile() {
  if (fs.existsSync(EMBEDDING_PATH)) {
    console.log('✅ embedding.json already exists.');
  } else {
    console.log('⬇️ Downloading embedding.json...');
    const res = await fetch(EMBEDDING_URL);
    if (!res.ok) throw new Error(`Failed to download: ${res.statusText}`);
    const fileStream = fs.createWriteStream(EMBEDDING_PATH);
    await new Promise((resolve, reject) => {
      res.body.pipe(fileStream);
      res.body.on("error", reject);
      fileStream.on("finish", resolve);
    });
    console.log('✅ embedding.json downloaded.');
  }

  // Load the file
  const raw = fs.readFileSync(EMBEDDING_PATH, 'utf-8');
  embeddings = JSON.parse(raw);
  console.log(`✅ Loaded ${embeddings.length} embeddings.`);
}

// POST /get-suggestions
app.post('/get-suggestions', async (req, res) => {
  const { nodeText, extraContext, styleGuideText } = req.body;

  if (!nodeText || !styleGuideText) {
    return res.status(400).json({ error: 'Missing nodeText or styleGuideText' });
  }

  try {
    // 🔍 1. RAS — Embedding similarity
    const nodeEmbedding = await getEmbedding(nodeText);

    const reuseSuggestions = embeddings
      .map(item => ({
        line: item.line,
        score: cosineSimilarity(nodeEmbedding, item.embedding)
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
      .map(item => item.line);

    // 🤖 2. LLM — Suggestions via OpenAI
    const systemPrompt = `You are a product copywriting assistant for Kissflow.

Follow the complete style guide below. Every output MUST comply with all writing rules.

=== STYLE GUIDE ===
${styleGuideText}
=====================`;

    const userPrompt = `Rewrite this UI copy:

- Text: "${nodeText}"
- Spec: "${extraContext || "none"}"

Give 10 concise, well-formatted rewrite options.`;

    const completion = await openai.createChatCompletion({
      model: 'gpt-4',
      temperature: 0.5,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
    });

    const newSuggestions = (completion.data.choices[0].message.content || "")
      .split('\n')
      .filter(line => line.trim() && !line.startsWith("```"))
      .map(line => line.replace(/^\d+[\.)]\s*/, '').trim())
      .slice(0, 10);

    res.json({ reuseSuggestions, newSuggestions });

  } catch (error) {
    console.error("❌ Error in /get-suggestions:", error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Start server only after downloading embeddings
const PORT = process.env.PORT || 3000;
ensureEmbeddingFile().then(() => {
  app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
}).catch(err => {
  console.error('❌ Failed to initialize embeddings:', err);
  process.exit(1);
});

// Helper to get embedding from OpenAI
async function getEmbedding(text) {
  const res = await openai.createEmbedding({
    model: 'text-embedding-ada-002',
    input: text,
  });
  return res.data.data[0].embedding;
}
