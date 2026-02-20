import 'dotenv/config';

const key = process.env.GEMINI_API_KEY;
const model = 'gemini-2.5-flash';
const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;

const body = {
  contents: [{ role: 'user', parts: [{ text: 'Eres narrador de NPCs. Responde JSON: {"Elena":"frase corta","Marco":null,"Gruk":null,"Bones":null}. El jugador dice: Hola Elena que haces?' }] }],
  generationConfig: {
    maxOutputTokens: 300,
    responseMimeType: 'application/json',
    thinkingConfig: { thinkingBudget: 0 }
  }
};

const res = await fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body)
});

console.log('Status:', res.status);
const data = await res.json();
console.log(JSON.stringify(data, null, 2));
