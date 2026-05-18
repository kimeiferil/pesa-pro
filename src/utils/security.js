// Simple rate limiting that doesn't fail
const rateLimitMap = new Map();

export function checkRateLimit(key, maxAttempts, timeWindowMs) {
  const now = Date.now();
  const record = rateLimitMap.get(key);
  
  if (!record) {
    rateLimitMap.set(key, { count: 1, firstAttempt: now });
    return true;
  }
  
  if (now - record.firstAttempt > timeWindowMs) {
    rateLimitMap.set(key, { count: 1, firstAttempt: now });
    return true;
  }
  
  if (record.count >= maxAttempts) {
    return false;
  }
  
  record.count++;
  rateLimitMap.set(key, record);
  return true;
}

// Simple audit log that doesn't fail
export async function logUserAction(action, details = {}) {
  try {
    console.log('Audit:', action, details);
    // Optionally log to console only for now
  } catch (err) {
    console.error('Failed to log user action:', err);
  }
}

// Simple session timer
let sessionTimer = null;

export function startSessionTimer(minutes, onTimeout) {
  if (sessionTimer) clearTimeout(sessionTimer);
  sessionTimer = setTimeout(onTimeout, minutes * 60 * 1000);
  return sessionTimer;
}

export function clearSessionTimer() {
  if (sessionTimer) {
    clearTimeout(sessionTimer);
    sessionTimer = null;
  }
}
