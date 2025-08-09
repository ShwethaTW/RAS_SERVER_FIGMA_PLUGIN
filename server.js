const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const OpenAI = require('openai');
const { chain } = require('stream-chain');
const { parser } = require('stream-json');
const { streamArray } = require('stream-json/streamers/StreamArray');
const fetch = require('node-fetch');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

// OpenAI client (v4 syntax)
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const EMBEDDING_URL = 'https://www.dropbox.com/scl/fi/pqruumeqfumfo6fiddd97/embeddings.json?rlkey=tr4swi2ginnqj3tkeknn3gth5&st=7oq1zh0j&dl=1';

// Cosine similarity function
function cosineSimilarity(a, b) {
  const dot = a.reduce((sum, val, i) => sum + val * b[i], 0);
  const magA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const magB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
  return dot / (magA * magB);
}

// Get OpenAI embedding
async function getEmbedding(text) {
  const result = await openai.embeddings.create({
    model: 'text-embedding-ada-002',
    input: text,
  });
  return result.data[0].embedding;
}

// POST /get-suggestions
app.post('/get-suggestions', async (req, res) => {
  const { nodeText, extraContext, styleGuideText } = req.body;

  if (!nodeText || !styleGuideText) {
    return res.status(400).json({ error: 'Missing nodeText or styleGuideText' });
  }

  try {
    const nodeEmbedding = await getEmbedding(nodeText);
    const topMatches = [];

    const response = await fetch(EMBEDDING_URL);
    if (!response.ok) throw new Error(`Download failed: ${response.statusText}`);
  

    const pipeline = chain([
      response.body,
      parser(),
      streamArray()
    ]);

    for await (const { value } of pipeline) {
      const similarity = cosineSimilarity(nodeEmbedding, value.embedding);

      if (topMatches.length < 10) {
        topMatches.push({ line: value.line, score: similarity });
        topMatches.sort((a, b) => b.score - a.score);
      } else if (similarity > topMatches[9].score) {
        topMatches[9] = { line: value.line, score: similarity };
        topMatches.sort((a, b) => b.score - a.score);
      }
    }

    const reuseSuggestions = topMatches.map(match => match.line);

    // Get new suggestions from OpenAI
const systemPrompt = `You are a product copywriting assistant for Kissflow.

Follow the complete style guide below. Every output MUST comply with all writing rules.

=== STYLE GUIDE ===
${styleGuideText}
=====================`; 

const userPrompt = `Rewrite this UI copy:

- Text: "${nodeText}"
- Spec: "${extraContext || "none"}"

Give 10 concise, well-formatted rewrite options.`; 

    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      temperature: 0.5,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    });

    const newSuggestions = (completion.choices[0].message.content || '')
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
