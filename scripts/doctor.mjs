import {configuration} from '../server/config.mjs';
const c=configuration();
console.log(`Mode: ${c.mode}`);for(const key of c.missing)console.log(`Required server setting: ${key}`);
console.log(`Email: ${!c.notificationsEnabled?'disabled by NOTIFICATIONS_ENABLED=false':c.mailReady?'configured (delivery not yet tested)':'requires GOOGLE_CLIENT_SECRET, GMAIL_REFRESH_TOKEN, GMAIL_FROM'}`);
try{await import('google-auth-library');console.log('Google verification library: installed');}catch{console.log('Run npm install on the host to install Google verification library.');process.exitCode=1;}
if(c.missing.length)process.exitCode=1;
console.log('No secrets, personal email addresses or live records are printed by this check.');
