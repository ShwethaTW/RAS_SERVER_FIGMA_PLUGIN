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

// === HARD-CODED STYLE GUIDE ===
// ⬇️ Paste your full style guide text between the backticks
const STYLE_GUIDE = `
# Kissflow Product Copywriting Style Guide
0. Always use sentence casing 99% of the time, title casing only based on specific guideline.

1. ALWAYS use equivalent phrases instead of Latin abbreviations - ban "etc.", "i.e.", "e.g." and replace with "and so on", "that is", "for example".

2. Use abbreviations ONLY when space is critically constrained - otherwise spell it out completely.

3. NEVER add apostrophes before 's' in plural abbreviations - write "CDs" not "CD's".

4. Use title casing for technical abbreviations like "SSO (Single Sign-On)" - no exceptions.

5. Define uncommon abbreviations on first mention then use abbreviation only - no repeated expansions.

6. ALL content MUST comply with WCAG 2.2 guidelines - accessibility is non-negotiable.

7. Use active voice aggressively - "You will lose access" beats "Access will be lost" every time.

8. Exception: Use passive voice for technical system states and error messages to avoid blaming users.

9. BAN the ampersand (&) symbol unless it's on space-constrained buttons or official company names.

10. Drop the final 's' in possessives when word ends in 's' - write "Jonas'" not "Jonas's".

11. Allow contractions but NEVER contract "to have" as main verb - "I have" not "I've".

12. Ruthlessly eliminate unnecessary articles - "Configure user settings" not "Configure the user settings".

13. Use articles ONLY when specificity demands it - "The process was deleted" for emphasis.

14. Default to sentence casing everywhere - capitalize only first word and proper nouns.

15. Reserve title casing for specific situations only - every word capitalized except short conjunctions, prepositions, articles, and helping verbs.

16. ALWAYS capitalize "Kissflow", "Kissflow Apps", "Kissflow Analytics", proper nouns, countries, days, months.

17. NEVER capitalize industries, financial terms, departments, or job titles unless they're proper nouns.

18. End list introductions with colons - "Your password should meet the following conditions:".

19. Skip introductory lines for single-point lists - just state it as one sentence.

20. Write conversationally and simply - "There's already a channel with that name" not "Channel name already exists".

21. Use simple words ruthlessly - "buy" not "purchase", "let" not "permit", "start" not "commence".

22. Frame restrictions positively - "Reassignment is unavailable" beats "You cannot reassign".

23. Use three dots for loading states - "Loading..." with no extra spaces.

24. Always write "email" not "e-mail" or "email ID" - use "email address" in sentences.

25. Use sentence casing for email subjects - no exceptions.

26. Use BLOCK LETTERS for file type abbreviations - "JPEG file", "MP3 file", "AIFF file".

27. Say "file formats" not "file type" - be precise with terminology.

28. Always include the word "file" when possible - "exported as a JPEG file".

29. Write filename extensions in lowercase - ".jpg", ".aif", ".mp3", ".iba".

30. Add space between file size numbers and units - "100 MB" not "100MB".

31. Eliminate helping verbs when they add no value - "Portal archived" beats "Portal is archived".

32. Keep helping verbs only for timing emphasis or clarity - "The file was exported" for past action.

33. Hyphenate compound modifiers before nouns - "real-time", "built-in", "drag-and-drop".

34. Follow Merriam-Webster's Dictionary for hyphens EXCEPT "timeout" (no hyphen despite dictionary).

35. NEVER hyphenate when first word is adverb ending in -ly - "highly effective" not "highly-effective".

36. Drop hyphens when compound modifiers become verbs - "drag and drop files" not "drag-and-drop files".

37. Never hyphenate these words - "coworkers", "sign in", "sign out", "autopopulate", "autosave", "ad hoc".

38. Use question marks ONLY for direct questions - not statements or indirect questions.

39. Avoid "How to" constructions - use "How do" or "How is" for direct questions instead.

40. Write numbers zero through nine as words - "eight" not "8".

41. Write numbers 10 and above as numerals - "25" not "twenty-five".

42. Use International System of Numeration with commas - "240,000" not "240000".

43. Write millions with max two decimals - "2.63 million" not "2.631 million".

44. Use K/M without spaces in constrained microcopy - "80K" not "80 K".

45. Suffix currency codes with space - "50 USD" not "USD $50".

46. Prefix currency symbols without space in constraints - "$50" not "$ 50".

47. Write "percent" as word with digits - "16 percent" not "16%".

48. Use % symbol without space in microcopy constraints - "50%" not "50 %".

49. Always use Oxford comma in series - "apples, oranges, and bananas".

50. Title-case these roles - "Account Admin", "Super Admin", "Flow Admin", "Billing Admin".

51. Use sentence casing for plural admin roles - "super admins" not "Super Admins".

52. NEVER use quotation marks - bold for emphasis, italicize for sample data.

53. Ruthlessly eliminate repetitive words - avoid "them" overload and word redundancy.

54. Always use "select" in UI microcopy - never "choose" for formal interface actions.

55. Use "choose" only for personal/subjective decisions in informal contexts.

56. Never add spaces around forward slashes - "companies/organizations" not "companies / organizations".

57. NEVER use backward slashes - forward slash only.

58. Use American spelling exclusively - follow Merriam-Webster's Collegiate Dictionary.

59. Exception: "autopopulate" is allowed despite not being in Merriam-Webster.

60. NEVER split infinitives with adverbs - "to add easily" not "to easily add".

61. Write in second person "you" - direct and personal.

62. Avoid progressive and perfect tenses - use simple past/present instead.

63. Write "versus" as "vs." - short and clean.

64. Place abbreviation expansions in tooltips only once per page - not repeatedly.

65. Skip tooltips for common abbreviations like URL/URI - everyone knows these.

66. Use title casing for abbreviations in copy - "SSO (Single Sign-On)".

67. Check All-content sheet for consistency - avoid variations of existing copy.

68. NEVER use "Unsaved changes" - stick to approved alternatives.

69. Never write copy for date/time - follow "My settings" format automatically.

70. Use standard time abbreviations - "4d", "2w", "3h", "2m", "1mo", "1y".

71. Use "Now" for actions just performed - immediate timing indicator.

72. Bold dynamic workflow names and assignees in notifications - protect from casing issues.

73. Keep table entity dynamic values unbolded - different formatting rules.

74. Punctuate empty state copy EXCEPT unpunctuated titles in title/one-liner designs.

75. Write positive empty state copy with solutions - help users find what they need.

76. NEVER blame users in error messages - avoid "You can't" constructions.

77. Always punctuate error messages - complete sentences require periods.

78. Use Effect-Cause-Solution order for error messages when possible.

79. Use colon syntax for three-part errors - "Upload failed: This file format is invalid, try again".

80. Use comma for two-part errors - "Upload failed, try again".

81. End event categories with "administration" or "actions" - include module names.

82. Structure event actions as [Object] + [Verb] - "Board item created".

83. Avoid "in bulk" distinctions for APIs - use singular forms consistently.

84. Update community article promptly for new audit codes via BSCR processes only.

85. Bold example texts without quotes - design-approved weight for visibility.

86. Use "Learn more" as default hyperlink text - standalone phrase without period.

87. Direct links to specific article sections using anchor tags when relevant.

88. Set minimum 300-500ms visibility for loading text - ensure readability.

89. Keep loading screens dynamic for long waits - avoid static text.

90. Use "Please wait..." not "Loading ..." - proper format and punctuation.

91. Bold dynamic values in notifications - protect formatting consistency.

92. Never repeat field names as placeholder text - add context instead.

93. Keep example text lowercase in placeholders without quotes - natural flow.

94. Punctuate placeholder phrases and sentences - complete thoughts get periods.

95. Leave short placeholder words unpunctuated - "First name" not "First name.".

96. No punctuation for titles, labels, buttons, single words, breadcrumbs, timestamps.

97. Always punctuate sentences, phrases, help text, error messages, descriptive tooltips.

98. Bold re-referenced button/icon copy with exact product casing - "Click View invoice".

99. Match original product casing exactly when referencing UI elements.

100. Use sentence casing for page headings - never punctuate them.

101. Add articles for "Add" and "Create" buttons - "Add an item", "Create a task".

102. Use sentence casing for all button text - never punctuate buttons.

103. Apply sentence casing to clickable links - never punctuate them.

104. Limit dropdown options to one word when possible - use sentence casing, no punctuation.

105. Use sentence casing for dropdown headers - never punctuate them.

106. Apply sentence casing to radio options - punctuate only when conditional logic demands.

107. Use sentence casing for checkbox options - punctuate only when conditional logic demands.

108. Write placeholder copy in sentence casing - punctuate conditionally based on content.

109. Use sentence casing for table headers - never punctuate them.

110. Write success toast messages as single sentences - use sentence casing with punctuation.

111. Format error toast messages in sentence casing - always punctuate API messages.

112. Use sentence casing for explanatory tooltips with succinct copy - always punctuate.

113. Apply sentence casing to label tooltips - never punctuate single-word labels.

114. Write system validation messages as single sentences - use sentence casing with punctuation.

115. Use sentence casing for confirmation popup titles - never punctuate titles.

116. Apply sentence casing to confirmation popup text - always punctuate full text.

117. Use sentence casing for breadcrumbs - never punctuate navigation elements.

118. Apply sentence casing to filter tiles - never punctuate them.

119. Use sentence casing for field name labels - never punctuate labels.

120. Write help text concisely under input fields - use sentence casing with punctuation.

121. Apply sentence casing to component names - never punctuate them.

122. Use sentence casing for empty state copy - always punctuate descriptive text.

123. NEVER use "(s)" to accommodate singular/plural - make developers handle this in code.

124. Favor plural forms in most cases where singularity is understood - "Add files from" not "Add file(s) from".

125. Let developers code dynamic singular/plural handling - "You have deleted 1 user" vs "You have deleted 10 users".

`;

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

  const { nodeText, extraContext } = req.body;

  if (!nodeText) {
    return res.status(400).json({ error: 'Missing nodeText' });
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
${STYLE_GUIDE}
=====================`; 

    const userPrompt = `Rewrite the following UI copy:

"${nodeText}"

If "${extraContext}" has information, use it to improve relevance. 
Provide 10 concise, well-formatted rewrite options.`; 

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
