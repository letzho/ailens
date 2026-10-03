import { createClient } from '@supabase/supabase-js';
import { config } from '../config.js';

let sb;
export const supabaseEnabled = () => !!(config.supabase.url && config.supabase.key);

function client() {
  if (!supabaseEnabled()) return null;
  sb ??= createClient(config.supabase.url, config.supabase.key, {
    auth: { persistSession: false },
  });
  return sb;
}

/** Fire-and-forget: logging must never break a live answer. */
export async function logInteraction(row) {
  try {
    const c = client();
    if (!c) return;
    const { error } = await c.from('lens_interactions').insert(row);
    if (error) console.warn('[supabase] insert failed:', error.message);
  } catch (e) {
    console.warn('[supabase]', e.message);
  }
}

export async function getHistory(sessionId, limit = 30) {
  const c = client();
  if (!c || !sessionId) return [];
  const { data, error } = await c
    .from('lens_interactions')
    .select('id,created_at,mode,role,question,answer,label')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return data;
}
