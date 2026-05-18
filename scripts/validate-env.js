#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

const REQUIRED_VARS = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY'
];

const OPTIONAL_VARS = [
  'VITE_ENABLE_BACKGROUND_SERVICE',
  'VITE_ENABLE_DARK_MODE',
  'VITE_ENABLE_PRIVACY_MODE',
  'VITE_ENABLE_ANALYTICS'
];

function loadEnvFile(filePath) {
  const envPath = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(envPath)) {
    return {};
  }
  
  const content = fs.readFileSync(envPath, 'utf8');
  const env = {};
  
  content.split('\n').forEach(line => {
    line = line.trim();
    if (line && !line.startsWith('#') && line.includes('=')) {
      const [key, ...valueParts] = line.split('=');
      const value = valueParts.join('=').trim();
      // Remove quotes if present
      env[key.trim()] = value.replace(/^['"]|['"]$/g, '');
    }
  });
  
  return env;
}

function validateEnv() {
  // Load .env file
  const envVars = loadEnvFile('.env');
  
  // Also check process.env (for Vite injected vars)
  const allEnv = { ...process.env, ...envVars };
  
  const missing = [];
  const present = [];
  
  REQUIRED_VARS.forEach(varName => {
    if (!allEnv[varName] || allEnv[varName].trim() === '' || 
        allEnv[varName].includes('your_') || 
        allEnv[varName].includes('example')) {
      missing.push(varName);
    } else {
      present.push(varName);
    }
  });
  
  console.log('Environment Variable Validation Report');
  console.log('====================================');
  
  if (missing.length > 0) {
    console.error('\n❌ MISSING REQUIRED VARIABLES:');
    missing.forEach(varName => {
      console.error(`  - ${varName}`);
    });
    console.error('\nPlease update your .env file with valid values.');
    console.error('See .env.example for reference.');
    process.exit(1);
  } else {
    console.log('\n✅ ALL REQUIRED VARIABLES PRESENT:');
    present.forEach(varName => {
      console.log(`  - ${varName}`);
    });
  }
  
  // Check optional variables
  const optionalPresent = [];
  const optionalMissing = [];
  
  OPTIONAL_VARS.forEach(varName => {
    if (allEnv[varName]) {
      optionalPresent.push(varName);
    } else {
      optionalMissing.push(varName);
    }
  });
  
  if (optionalPresent.length > 0) {
    console.log('\n✅ OPTIONAL VARIABLES SET:');
    optionalPresent.forEach(varName => {
      console.log(`  - ${varName}=${allEnv[varName]}`);
    });
  }
  
  if (optionalMissing.length > 0) {
    console.log('\n⚠️  OPTIONAL VARIABLES NOT SET (using defaults):');
    optionalMissing.forEach(varName => {
      console.log(`  - ${varName}`);
    });
  }
  
  console.log('\n🎉 Environment validation passed!');
}

validateEnv();