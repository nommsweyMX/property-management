/** Private deployment settings. Never expose credentials via /api/config. */
export function configuration(env = process.env) {
  const mode = env.APP_MODE === 'demo' ? 'demo' : 'live';
  const onRender = env.RENDER === 'true';
  // Render supplies this server-side value; never derive the origin from request headers.
  const origin = env.PUBLIC_ORIGIN || (onRender ? env.RENDER_EXTERNAL_URL || '' : '');
  let validOrigin = false;
  try {
    const u = new URL(origin);
    validOrigin = u.origin === origin && !u.username && !u.password &&
      (u.protocol === 'https:' || (!onRender && u.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(u.hostname)));
  } catch { /* Report missing/invalid configuration, never silently use demo data. */ }
  const ownerEmails = (env.OWNER_EMAILS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  const missing = [];
  if (!validOrigin) missing.push('PUBLIC_ORIGIN');
  if (!env.AIRTABLE_TOKEN) missing.push('AIRTABLE_TOKEN');
  if (!/^app[A-Za-z0-9]{14}$/.test(env.AIRTABLE_BASE_ID || '')) missing.push('AIRTABLE_BASE_ID');
  if (!/^[A-Za-z0-9-]+\.apps\.googleusercontent\.com$/.test(env.GOOGLE_CLIENT_ID || '')) missing.push('GOOGLE_CLIENT_ID');
  if (!ownerEmails.length||ownerEmails.some(s=>s.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s))) missing.push('OWNER_EMAILS');
  // Explicitly disable notices on hosts without persistent outbox storage.
  const notificationsEnabled = env.NOTIFICATIONS_ENABLED !== 'false';
  const mailReady = notificationsEnabled && ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GMAIL_REFRESH_TOKEN', 'GMAIL_FROM'].every(k => !!env[k]);
  return Object.freeze({mode, origin, ownerEmails, missing, ready: mode === 'live' && !missing.length,
    googleClientId: env.GOOGLE_CLIENT_ID || '', airtableToken: env.AIRTABLE_TOKEN || '',
    baseId: env.AIRTABLE_BASE_ID || '', mailReady, notificationsEnabled,
    googleClientSecret: env.GOOGLE_CLIENT_SECRET || '', gmailRefreshToken: env.GMAIL_REFRESH_TOKEN || '',
    gmailFrom: env.GMAIL_FROM || '', dataDir: env.DATA_DIR || '.data',
    secure: origin.startsWith('https:')});
}
export function publicConfiguration(c) {
  return {mode: c.mode, ready: c.ready, missing: c.missing, googleClientId: c.ready ? c.googleClientId : null,
    features: {sharedData: c.ready, googleSignIn: c.ready, notifications: c.ready && c.mailReady}};
}

/** Use Render's port and public bind address without changing local development defaults. */
export function runtimeAddress(env = process.env) {
  const onRender = env.RENDER === 'true';
  const port = Number(env.PORT ?? (onRender ? 10000 : 3000));
  const host = env.HOST || (onRender ? '0.0.0.0' : '127.0.0.1');
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid PORT');
  return {host, port};
}
