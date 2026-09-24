/** Private deployment settings. Never expose credentials via /api/config. */
export function configuration(env = process.env) {
  const mode = env.APP_MODE === 'demo' ? 'demo' : 'live';
  const origin = env.PUBLIC_ORIGIN || '';
  let validOrigin = false;
  try {
    const u = new URL(origin);
    validOrigin = u.origin === origin && !u.username && !u.password &&
      (u.protocol === 'https:' || (u.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(u.hostname)));
  } catch { /* Report missing/invalid configuration, never silently use demo data. */ }
  const ownerEmails = (env.OWNER_EMAILS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  const missing = [];
  if (!validOrigin) missing.push('PUBLIC_ORIGIN');
  if (!env.AIRTABLE_TOKEN) missing.push('AIRTABLE_TOKEN');
  if (!/^app[A-Za-z0-9]{14}$/.test(env.AIRTABLE_BASE_ID || '')) missing.push('AIRTABLE_BASE_ID');
  if (!/^[A-Za-z0-9-]+\.apps\.googleusercontent\.com$/.test(env.GOOGLE_CLIENT_ID || '')) missing.push('GOOGLE_CLIENT_ID');
  if (!ownerEmails.length||ownerEmails.some(s=>s.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s))) missing.push('OWNER_EMAILS');
  const mailReady = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GMAIL_REFRESH_TOKEN', 'GMAIL_FROM'].every(k => !!env[k]);
  return Object.freeze({mode, origin, ownerEmails, missing, ready: mode === 'live' && !missing.length,
    googleClientId: env.GOOGLE_CLIENT_ID || '', airtableToken: env.AIRTABLE_TOKEN || '',
    baseId: env.AIRTABLE_BASE_ID || '', mailReady,
    googleClientSecret: env.GOOGLE_CLIENT_SECRET || '', gmailRefreshToken: env.GMAIL_REFRESH_TOKEN || '',
    gmailFrom: env.GMAIL_FROM || '', dataDir: env.DATA_DIR || '.data',
    secure: origin.startsWith('https:')});
}
export function publicConfiguration(c) {
  return {mode: c.mode, ready: c.ready, missing: c.missing, googleClientId: c.ready ? c.googleClientId : null,
    features: {sharedData: c.ready, googleSignIn: c.ready, notifications: c.ready && c.mailReady}};
}
