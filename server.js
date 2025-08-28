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

// 🧹 Utility function to clean text
function cleanText(text) {
  if (!text) return null;
  return text
    .replace(/^\d+[\.)]\s*/, '')     // remove leading numbers like 1. or 1)
    .replace(/^[-*]\s*/, '')         // remove bullets (- or *)
    .replace(/^["']|["']$/g, '')     // strip wrapping quotes
    .trim();
}

// Get OpenAI embedding
async function getEmbedding(text) {
  console.log(`[${new Date().toISOString()}] 🔹 Getting embedding for text...`);
  const start = Date.now();
  const result = await openai.embeddings.create({
    model: 'text-embedding-ada-002',
    input: text,
  });
  console.log(`[${new Date().toISOString()}] ✅ Embedding done in ${Date.now() - start}ms`);
  return result.data[0].embedding;
}

// POST /get-suggestions
app.post('/get-suggestions', async (req, res) => {
  const startRequest = Date.now();
  console.log(`\n==============================`);
  console.log(`[${new Date().toISOString()}] 🚀 New request received`);
  console.log(`[INPUT] nodeText: "${req.body.nodeText}"`);
  console.log(`[INPUT] extraContext: "${req.body.extraContext}"`);
  console.log(`[INPUT] styleGuide length: ${req.body.styleGuideText?.length || 0}`);

  const { nodeText, extraContext, styleGuideText } = req.body;

  if (!nodeText || !styleGuideText) {
    return res.status(400).json({ error: 'Missing nodeText or styleGuideText' });
  }

  try {
    // 1️⃣ Embed the node text
    const embeddingStart = Date.now();
    const nodeEmbedding = await getEmbedding(nodeText);
    console.log(`[${new Date().toISOString()}] ⏱️ Embedding step took ${Date.now() - embeddingStart}ms`);

    // 2️⃣ Query Pinecone for similar lines
    const pineconeStart = Date.now();
    console.log(`[${new Date().toISOString()}] 🔹 Querying Pinecone...`);
    const queryResponse = await index.query({
      vector: nodeEmbedding,
      topK: 10,
      includeMetadata: true,
    });
    console.log(`[${new Date().toISOString()}] ✅ Pinecone query done in ${Date.now() - pineconeStart}ms`);

    const reuseSuggestions = queryResponse.matches
      .map(match => cleanText(match.metadata?.text))
      .filter(Boolean);

    // 3️⃣ Get new suggestions from OpenAI
    const systemPrompt = `You are a product copywriting assistant for Kissflow.

Follow the complete style guide below. Every output MUST comply with all writing rules.

=== STYLE GUIDE ===
${styleGuideText}
=====================`; 

    const userPrompt = `Rewrite ${nodeText} UI copy. If ${extraContext} has information use that intelligence too to provide relevant copy suggestion. 
Give 10 concise, well-formatted rewrite options.`; 

    const gptStart = Date.now();
    console.log(`[${new Date().toISOString()}] 🔹 Sending request to OpenAI Chat (gpt-4)...`);
    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      temperature: 0.5,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    });
    console.log(`[${new Date().toISOString()}] ✅ GPT-4 response in ${Date.now() - gptStart}ms`);

    const newSuggestions = (completion.choices[0].message.content || '')
      .split('\n')
      .map(cleanText)
      .filter(Boolean)
      .slice(0, 10);

    const totalTime = Date.now() - startRequest;
    console.log(`[${new Date().toISOString()}] 🎉 Request completed in ${totalTime}ms`);
    console.log(`==============================\n`);

    // 4️⃣ Return both reuse + new suggestions
    res.json({ reuseSuggestions, newSuggestions });

  } catch (error) {
    console.error(`[${new Date().toISOString()}] ❌ Error in /get-suggestions:`, error);
    res.status(500).json({ error: 'Server error' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
