// Quick test script for NPC AI endpoint
const BASE = 'http://localhost:3001';

async function test(msg) {
  console.log(`\n🧪 Testing: "${msg}"`);
  console.log('─'.repeat(50));
  
  try {
    const res = await fetch(`${BASE}/api/test-npc?msg=${encodeURIComponent(msg)}`);
    const data = await res.json();
    
    console.log(`✅ Success: ${data.success}`);
    console.log(`📡 Model: ${data.model}`);
    console.log(`📊 HTTP: ${data.httpStatus}`);
    console.log(`⏱️  Time: ${data.totalMs}ms`);
    console.log(`🔚 Finish: ${data.finishReason}`);
    console.log(`📝 Raw: ${data.rawResponse}`);
    console.log(`💬 NPCs: ${JSON.stringify(data.npcResponses, null, 2)}`);
    if (data.tokenCount) {
      console.log(`🔢 Tokens: prompt=${data.tokenCount.promptTokenCount} output=${data.tokenCount.candidatesTokenCount} total=${data.tokenCount.totalTokenCount}`);
    }
    if (data.error) console.log(`❌ Error: ${data.error.substring(0, 200)}`);
    return data;
  } catch (e) {
    console.error(`❌ Fetch failed: ${e.message}`);
    return null;
  }
}

async function testDebug() {
  console.log(`\n📊 Debug State:`);
  console.log('─'.repeat(50));
  try {
    const res = await fetch(`${BASE}/api/debug`);
    const d = await res.json();
    const g = d.gemini;
    console.log(`Model: ${g.model} | Requests: ${g.requestCount} | Success: ${g.successCount} | Fail: ${g.failCount} | Repairs: ${g.repairCount}`);
    console.log(`Rate Limited: ${g.rateLimitActive ? g.rateLimitRemainingSec + 's' : 'No'} | Queue: ${g.queueLength} | Avg: ${g.avgResponseMs}ms`);
    console.log(`Activities: ${JSON.stringify(d.npcActivities)}`);
  } catch (e) {
    console.error(`❌ ${e.message}`);
  }
}

// Run tests
(async () => {
  await testDebug();
  await test('Hola Elena, ¿qué estás haciendo?');
  await new Promise(r => setTimeout(r, 5000)); // Wait for queue spacing
  await test('Marco, ¿hay peligro por aquí?');
  await new Promise(r => setTimeout(r, 5000));
  await test('Gruk quiero ver tu colección de shiny');
  await testDebug();
  console.log('\n✅ Tests complete!');
})();
