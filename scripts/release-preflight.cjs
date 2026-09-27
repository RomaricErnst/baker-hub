const {loadEnvConfig}=require('@next/env');
loadEnvConfig(process.cwd());
const required=['NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_ANON_KEY'];
const missing=required.filter(k=>!process.env[k]);
if(missing.length){console.error('Release environment missing: '+missing.join(', '));process.exitCode=1;}
else {try {const u=new URL(process.env.NEXT_PUBLIC_SUPABASE_URL);if(u.protocol!=='https:')throw Error();console.log('Public backend configuration present. Validate target project and authenticated journeys before GO.');}catch{console.error('Supabase URL must be a valid HTTPS URL.');process.exitCode=1;}}
