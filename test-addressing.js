// Quick test: NPC addressing fix
const tests = [
  { msg: 'Elena donde esta Bones', expect: 'Elena should answer, NOT Bones' },
  { msg: 'Hola a todos', expect: 'Any 1-2 NPCs respond' },
  { msg: 'Bones, que piensas de Elena?', expect: 'Bones should answer about Elena' },
];

async function run() {
  for (const test of tests) {
    console.log(`\n🧪 "${test.msg}" → ${test.expect}`);
    try {
      const res = await fetch(`http://localhost:3001/api/test-npc?msg=${encodeURIComponent(test.msg)}`);
      const data = await res.json();
      console.log(`   NPCs: ${data.respondingNPCs?.join(', ') || 'none'}`);
      if (data.npcResponses) {
        for (const [npc, txt] of Object.entries(data.npcResponses)) {
          console.log(`   ${npc}: "${txt}"`);
        }
      }
      console.log(`   ✅ Success: ${data.success}`);
    } catch (e) {
      console.error(`   ❌ Error: ${e.message}`);
    }
    // Wait between requests to respect rate limit
    await new Promise(r => setTimeout(r, 5000));
  }
}

run();
