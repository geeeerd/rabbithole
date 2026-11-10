import fs from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
const dist=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../frontend/dist');
const manifest=JSON.parse(fs.readFileSync(path.join(dist,'.vite/manifest.json'),'utf8'));
const seen=new Set();
function walk(key){if(seen.has(key))return;seen.add(key);for(const item of manifest[key].imports||[])walk(item)}
walk('index.html');
const files=[...seen].map(key=>manifest[key].file).filter(file=>file.endsWith('.js'));
if(files.some(file=>/\/graph-/.test(file)))throw new Error('Graph renderer is included in the initial page bundle.');
const bytes=files.reduce((total,file)=>total+gzipSync(fs.readFileSync(path.join(dist,file))).length,0);
console.log(`Initial JavaScript: ${(bytes/1024).toFixed(1)} KiB gzipped; graph, stories and challenge load on demand.`);
if(bytes>110*1024)throw new Error('Initial JavaScript exceeds the 110 KiB gzip budget.');
