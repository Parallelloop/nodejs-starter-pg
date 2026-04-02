import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Generates a 1536-dimensional embedding using OpenAI (text-embedding-3-small)
 * @param {string} text The content to vectorize
 * @returns {Promise<number[]>} The vector embedding array
 */
export async function generateEmbedding(text) {
  if (!text) return null;

  try {
    const res = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: text,
    });
    return res.data[0].embedding;
  } catch (err) {
    console.error("OpenAI Embedding Error:", err.message);
    
    // Deterministic fallback for development/quota issues (matching POC behavior)
    const vector = new Array(1536).fill(0);
    const str = text.toLowerCase();
    for (let i = 0; i < str.length; i++) {
      const charCode = str.charCodeAt(i);
      const index = (i * charCode) % 1536;
      vector[index] = (vector[index] + charCode / 255) / 2;
    }
    return vector;
  }
}
