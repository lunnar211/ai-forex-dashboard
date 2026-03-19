'use strict';

const OpenAI = require('openai');

const NVIDIA_BASE_URL = 'https://integrate.api.nvidia.com/v1';
const NVIDIA_MODEL    = 'qwen/qwen3.5-122b-a10b';

let nvidiaClient = null;

function getClient() {
  if (!nvidiaClient && process.env.NVIDIA_API_KEY) {
    nvidiaClient = new OpenAI({
      apiKey:  process.env.NVIDIA_API_KEY,
      baseURL: NVIDIA_BASE_URL,
    });
  }
  return nvidiaClient;
}

/**
 * Send a chat completion request to the NVIDIA-hosted Qwen model.
 *
 * @param {object[]} messages  Array of { role, content } message objects
 * @param {object}   options   Optional parameter overrides
 * @returns {Promise<object>}  Raw OpenAI-compatible chat completion response
 */
async function chat(messages, options = {}) {
  const client = getClient();
  if (!client) {
    throw new Error('NVIDIA API key not configured (NVIDIA_API_KEY)');
  }

  // Destructure so we can deep-merge extra_body without allowing callers to
  // accidentally disable the enable_thinking flag via a plain spread.
  const {
    temperature = 0.6,
    top_p       = 0.95,
    max_tokens  = 16384,
    extra_body: callerExtraBody = {},
    ...restOptions
  } = options;

  try {
    const response = await client.chat.completions.create({
      ...restOptions,
      model:   NVIDIA_MODEL,
      messages,
      temperature,
      top_p,
      max_tokens,
      extra_body: {
        chat_template_kwargs: { enable_thinking: true },
        ...callerExtraBody,
      },
    });
    return response;
  } catch (err) {
    console.error('[NVIDIA/Qwen] chat error:', err.message);
    throw err;
  }
}

module.exports = { chat };
