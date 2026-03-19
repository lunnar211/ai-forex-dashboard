'use strict';

const nvidiaModel = require('./nvidiaModel');

// ── Providers array — populated at startup based on available API keys ─────────
const providers = [];

if (process.env.NVIDIA_API_KEY) {
  providers.push({ name: 'Qwen-NVIDIA', fn: nvidiaChat });
} else {
  console.warn('[aiService] NVIDIA_API_KEY is not set — Qwen-NVIDIA provider is disabled.');
}

/**
 * Thin wrapper so the providers array can reference the function by name
 * before the async definition would be hoisted.
 *
 * @param {object[]} messages
 * @param {object}   options
 * @returns {Promise<object>}
 */
async function nvidiaChat(messages, options = {}) {
  return nvidiaModel.chat(messages, options);
}

/**
 * Route a chat request to the specified AI provider.
 *
 * The switch/case provides named-alias routing ('qwen' and 'nvidia' both map
 * to the Qwen-NVIDIA provider).  The exported `providers` array gives callers
 * a way to discover which providers are available at runtime, and each entry's
 * `fn` can be invoked directly if preferred.
 *
 * @param {string}   provider  Provider name (e.g. 'qwen', 'nvidia')
 * @param {object[]} messages  Array of { role, content } message objects
 * @param {object}   options   Optional parameter overrides
 * @returns {Promise<object>}
 */
async function chat(provider, messages, options = {}) {
  const name = (provider || '').toLowerCase();

  switch (name) {
    case 'qwen':
    case 'nvidia':
      return nvidiaChat(messages, options);

    default:
      throw new Error(`[aiService] Unknown provider: "${provider}"`);
  }
}

module.exports = { providers, chat, nvidiaChat };
