import type { PostgrestError } from "@supabase/supabase-js"

/** PostgREST caps every response at the project's `max-rows` — 1000 on a
 *  default Supabase project — and does it silently: no error, no flag, just
 *  a short array. Every cards_with_marks query in the app used to take that
 *  first page as the whole truth, so a student past 1000 words got a
 *  truncated word table, study queues that could never reach the tail of
 *  their decks, and sidebar counts that added up to exactly 1000 while the
 *  server-side flame balance counted all of them. */
const PAGE_SIZE = 1000

/**
 * Runs `page(from, to)` repeatedly until a short page comes back, and
 * concatenates the results. `page` must apply a stable `.order(…)`, or rows
 * can repeat and go missing across page boundaries.
 *
 * On error the rows fetched so far are returned alongside it, matching how
 * the callers already treat a failed load (log it, render what there is).
 */
export async function fetchAllRows<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: PostgrestError | null }>
): Promise<{ data: T[]; error: PostgrestError | null }> {
  const all: T[] = []

  for (;;) {
    const { data, error } = await page(all.length, all.length + PAGE_SIZE - 1)
    if (error) return { data: all, error }
    if (!data || data.length === 0) break
    all.push(...data)
    // A page shorter than what we asked for means the table ran out. (If a
    // project lowers max-rows below PAGE_SIZE this stops early — but so
    // does every other paging idiom that does not probe for the cap.)
    if (data.length < PAGE_SIZE) break
  }

  return { data: all, error: null }
}
