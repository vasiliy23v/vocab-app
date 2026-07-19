import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * Supabase/Postgres can reject very large single INSERT statements —
 * payload size limits, statement timeouts, etc. A real user CSV had
 * 1530 rows, which is exactly the kind of upload that can fail as one
 * giant insert. Instead we insert sequentially in smaller batches, so
 * a limit hit on one batch doesn't lose rows that already succeeded,
 * and callers can show upload progress.
 */
const DEFAULT_BATCH_SIZE = 250

export interface InsertInBatchesOptions {
  batchSize?: number
  /** called after each batch completes, with cumulative row counts */
  onProgress?: (done: number, total: number) => void
}

export async function insertInBatches<T extends Record<string, unknown>>(
  supabase: SupabaseClient,
  table: string,
  rows: T[],
  { batchSize = DEFAULT_BATCH_SIZE, onProgress }: InsertInBatchesOptions = {}
): Promise<{ error: string | null; insertedCount: number }> {
  if (rows.length === 0) return { error: null, insertedCount: 0 }

  let inserted = 0
  for (let i = 0; i < rows.length; i += batchSize) {
    const chunk = rows.slice(i, i + batchSize)
    // supabase-js's generic insert() overloads fight with a generic row
    // type here; the table/columns are already validated by callers.
    const { error } = await supabase.from(table).insert(chunk as never)
    if (error) {
      return {
        error: `${error.message} (rows ${i + 1}-${i + chunk.length} of ${rows.length} — ${inserted} row(s) were already saved)`,
        insertedCount: inserted,
      }
    }
    inserted += chunk.length
    onProgress?.(inserted, rows.length)
  }
  return { error: null, insertedCount: inserted }
}
