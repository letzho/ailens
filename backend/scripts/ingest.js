// Usage:  npm run ingest            (from repo root or /backend)
//         npm run ingest -- --crawl  (also crawl linked SEG pages via Tavily)
import { runIngest } from '../src/routes/advisor.js';
import { pineconeEnabled } from '../src/services/pinecone.js';

if (!pineconeEnabled()) {
  console.error('PINECONE_API_KEY missing in backend/.env - nothing to do.');
  process.exit(1);
}
const crawl = process.argv.includes('--crawl');
console.log('Ingesting NYP SEG pages into Pinecone...');
const out = await runIngest({ crawl });
console.table(out.report);
if (out.failed.length) {
  console.log('\nCould NOT read these URLs:');
  out.failed.forEach((f) => console.log(' -', f.url, '->', f.error));
}
console.log(`\nDone: ${out.pages} pages -> ${out.chunks} chunks stored in Pinecone.`);
