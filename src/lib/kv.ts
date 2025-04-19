import { createClient } from '@vercel/kv';

// Ensure environment variables are set (especially in serverless environments)
if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
  throw new Error('Missing Vercel KV environment variables');
}

export const kv = createClient({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});
