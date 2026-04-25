const OpenAI = require('openai');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
client.images.generate({
  model: 'gpt-image-2',
  prompt: 'Single object only, centered, square composition. Front three-quarter view. Soft warm lighting. Background deep charcoal (#1A1612) with subtle warm reddish-terracotta glow. No text, no labels. A Famag IM-8 style professional spiral dough mixer. Cream white painted steel body — the machine body is white/cream coloured, not silver or stainless. Compact rectangular motor head on top with a small control panel on the front face showing one round speed knob and two round buttons (green and red). Large round stainless steel bowl below. From the motor head hang two elements into the bowl: one straight fixed vertical breaker bar and one thick S-shaped spiral hook beside it. The bowl sits on a rotating stainless steel base plate. Industrial professional equipment, cream white body, stainless steel bowl and hooks.',
  n: 1,
  size: '1024x1024',
  quality: 'high',
  output_format: 'png'
}).then(r => {
  fs.writeFileSync('public/mixer_spiral.png', Buffer.from(r.data[0].b64_json, 'base64'));
  console.log('Done');
}).catch(e => console.error(e.message));
