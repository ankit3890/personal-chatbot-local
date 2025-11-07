import { spawn } from 'child_process';
import dotenv from 'dotenv';
dotenv.config();
const LLAMA_BIN = process.env.LLAMA_BIN || './bin/llama';
const LLAMA_MODEL = process.env.LLAMA_MODEL_PATH || './models/ggml-modelq4_0.bin';
export function llamaQuery(prompt, opts = {}) {
return new Promise((resolve, reject) => {
// Adjust args for your llama.cpp build. This example shows common flags.
const args = ['-m', LLAMA_MODEL, '-p', prompt, '--temp', '0.7', '--n',
'256'];
const llama = spawn(LLAMA_BIN, args, { stdio: ['ignore', 'pipe',
'pipe'] });
let out = '';
let err = '';
llama.stdout.on('data', (data) => { out += data.toString(); });
llama.stderr.on('data', (data) => { err += data.toString(); });
llama.on('close', (code) => {
if (code !== 0) return reject(new Error(`llama exited ${code}: ${err}
`));
// Many llama.cpp builds echo the prompt then the response. Try to
extract the response
// heuristically by removing the prompt from the start if present.
let answer = out.trim();
try {
// If the output contains the prompt, remove the first occurrence
const idx = answer.indexOf(prompt);
if (idx !== -1) {
answer = answer.slice(idx + prompt.length).trim();
}
// Further trim common tokens
answer = answer.replace(/
+/, '
').trim();
 } catch (e) {
 // fallback to raw output
 }
 resolve(answer);
 });
 llama.on('error', (e) => reject(e));
});
}
