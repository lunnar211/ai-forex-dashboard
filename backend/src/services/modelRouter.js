'use strict';

const groqService    = require('./groqService');
const nvidiaModel    = require('./nvidiaModel');
const deepseekService = require('./deepseekService');

/**
 * Ordered list of models to try when routing a prediction request.
 * The router walks this array in sequence and uses the first model whose
 * API key is present in the environment.
 *
 * Order: groq → qwen-nvidia → deepseek
 *
 * Note: groqService and deepseekService already exist in this repository
 * (backend/src/services/groqService.js and deepseekService.js).
 */
const MODELS = [
  {
    name:    'groq',
    envKey:  'GROQ_API_KEY',
    service: groqService,
  },
  {
    name:    'qwen-nvidia',
    envKey:  'NVIDIA_API_KEY',
    service: nvidiaModel,
  },
  {
    name:    'deepseek',
    envKey:  'DEEPSEEK_API_KEY',
    service: deepseekService,
  },
];

/**
 * Returns models whose API keys are present in the current environment.
 *
 * @returns {{ name: string, envKey: string, service: object }[]}
 */
function getAvailableModels() {
  return MODELS.filter((m) => !!process.env[m.envKey]);
}

module.exports = { MODELS, getAvailableModels };
