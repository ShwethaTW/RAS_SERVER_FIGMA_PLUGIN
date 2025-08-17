const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const OpenAI = require('openai');
const { Pinecone } = require('@pinecone-database/pinecone');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: '1mb' }));

// OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Pinecone client
const pc = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY,
});

// reference your index
const index = pc.index("figmaplugin");

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
    // 1️⃣ Embed the node text
    const nodeEmbedding = await getEmbedding(nodeText);

    // 2️⃣ Query Pinecone for similar lines
    const queryResponse = await index.query({
      vector: nodeEmbedding,
      topK: 10,
      includeMetadata: true, // we stored "line" as metadata
    });

    const reuseSuggestions = queryResponse.matches
      .map(match => match.metadata?.line)
      .filter(Boolean);

    // 3️⃣ Get new suggestions from OpenAI
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

    // 4️⃣ Return both reuse + new suggestions
    res.json({ reuseSuggestions, newSuggestions });

  } catch (error) {
    console.error("❌ Error in /get-suggestions:", error);
    res.status(500).json({ error: 'Server error' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
