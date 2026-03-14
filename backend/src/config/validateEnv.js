'use strict';

function validateEnv() {
  const errors = [];
  const warnings = [];

  // Critical vars — app cannot function without these
  const critical = ['DATABASE_URL', 'JWT_SECRET'];
  for (const key of critical) {
    if (!process.env[key]) {
      errors.push(`Missing critical environment variable: ${key}`);
    }
  }

  // At least one AI provider key must be present
  const aiKeys = ['GROQ_API_KEY', 'OPENAI_API_KEY', 'GEMINI_API_KEY'];
  const hasAiKey = aiKeys.some((k) => process.env[k]);
  if (!hasAiKey) {
    errors.push(
      `Missing AI provider key. At least one of the following is required: ${aiKeys.join(', ')}`
    );
  } else {
    for (const k of aiKeys) {
      if (!process.env[k]) {
        warnings.push(`${k} not set — that AI provider will be unavailable`);
      }
    }
  }

  // Strongly recommended but app can still serve mock data without it
  if (!process.env.TWELVE_DATA_API_KEY) {
    warnings.push(
      'TWELVE_DATA_API_KEY not set — forex data will fall back to mock data'
    );
  }

  // Print warnings
  for (const w of warnings) {
    console.warn(`[ENV WARNING] ${w}`);
  }

  // Print errors and exit
  if (errors.length > 0) {
    for (const e of errors) {
      console.error(`[ENV ERROR] ${e}`);
    }
    console.error('[ENV] Startup aborted due to missing critical environment variables.');
    process.exit(1);
  }

  console.log('[ENV] Environment validation passed.');
}

module.exports = validateEnv;
