import { config } from '../config.js';

const BASE = 'https://api.tavily.com';

async function call(path, body) {
  if (!config.tavily.apiKey) throw new Error('TAVILY_API_KEY is missing');
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.tavily.apiKey}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Tavily ${path} ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

/**
 * Pull the full text of specific pages, one request per URL so a single
 * failure (JS-heavy page, blocked page) never hides the others.
 * Returns { pages: [{url,text}], failed: [{url,error}] }
 */
export async function extractPages(urls) {
  const pages = [];
  const failed = [];
  const settled = await Promise.allSettled(
    urls.map((u) => call('/extract', { urls: [u], extract_depth: 'advanced', format: 'markdown' })),
  );
  settled.forEach((r, i) => {
    if (r.status === 'rejected') return failed.push({ url: urls[i], error: r.reason.message });
    const ok = r.value.results || [];
    ok.forEach((x) => pages.push({ url: x.url || urls[i], text: x.raw_content || '' }));
    (r.value.failed_results || []).forEach((f) => failed.push({ url: f.url || urls[i], error: f.error || 'extract failed' }));
    if (!ok.length && !(r.value.failed_results || []).length) failed.push({ url: urls[i], error: 'no content returned' });
  });
  return { pages, failed };
}

/** Crawl the SEG section (follows links under the same path). Optional. */
export async function crawlSite(url, { limit = 25, maxDepth = 2 } = {}) {
  const data = await call('/crawl', {
    url,
    max_depth: maxDepth,
    limit,
    extract_depth: 'advanced',
    format: 'markdown',
    select_paths: ['/student/study/.*'],
  });
  return (data.results || []).map((r) => ({ url: r.url, text: r.raw_content || '' }));
}

/** Live fallback when no vector store is available. */
export async function searchNyp(query, max = 4) {
  const data = await call('/search', {
    query: `NYP School of Engineering ${query}`,
    include_domains: ['nyp.edu.sg'],
    max_results: max,
    search_depth: 'basic',
  });
  return (data.results || []).map((r) => ({ url: r.url, text: r.content || '' }));
}
