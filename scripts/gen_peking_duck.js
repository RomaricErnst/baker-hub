cat > /tmp/gen_peking_duck.js << 'EOF'
const OpenAI = require('openai');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const STYLE = 'Single pizza only, centered, square composition. Slight top-down angle (~30 degrees). Soft warm lighting. Background is deep charcoal (#1A1612) with subtle warm reddish-terracotta glow (#C4522A). No plate, no board, no tray, no props, no text, no labels.';
const NY_GEO = 'A single New York-style pizza slice. Large triangular slice with thin base. Gently raised flat crust lip. Tip slightly thinner to suggest foldability.';
const prompt = STYLE + ' ' + NY_GEO + ' Dark hoisin base, shredded crispy Peking duck, julienned spring onion, thin cucumber strips added cold, sesame seeds.';
client.images.generate({ model: 'gpt-image-2', prompt, n: 1, size: '1024x1024', quality: 'high', output_format: 'webp' })
  .then(r => { fs.writeFileSync('public/pizzas/peking_duck_newyork.webp', Buffer.from(r.data[0].b64_json, 'base64')); console.log('Done!'); })
  .catch(console.error);
EOF
