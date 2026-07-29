# Performance Optimization Guide

## Completed Optimizations

✅ **Optimistic Updates** 
- `useCards.setMark()` and `clearMark()` now update UI immediately before server confirmation
- Only refetch on error
- Same for `useTeacherLinks.removeLink()`

✅ **Fixed Realtime Subscriptions**
- Removed `crypto.randomUUID()` from channel names (was creating duplicate channels)
- Use stable channel names like `cards_${deckId}`, `teacher_links_${user.id}`
- Added event filtering for `UPDATE` only on card_marks (don't reload on INSERTs we don't care about)

## Next Priority Optimizations

### 1. **Implement Request Deduplication** (HIGH IMPACT)
Current: Multiple components mounting simultaneously = multiple identical queries
Solution: Use React Query or TanStack Query for automatic caching + deduplication

```
npm install @tanstack/react-query
```

Benefits:
- Deduplicate identical queries within a time window
- Automatic cache invalidation
- Background refetch
- Eliminates "pending" query pile-up

### 2. **Add Pagination to Data Lists** (HIGH IMPACT)
Current: Load ALL cards/decks at once
Problem: 1000 cards = huge payload

Solution: 
- Load first 20 cards, lazy-load on scroll
- Implement `limit: 20, offset: 0` in Supabase queries
- Add infinite scroll in StudentDashboard

### 3. **Batch Profile Updates** (MEDIUM IMPACT)
Current: Each setting change triggers separate `updateProfile()` call
Solution:
- Debounce changes (300ms)
- Batch updates into single call
- Example: streak, vibrate, leaderboard opt-in can all go in one update

### 4. **Selective Field Loading** (MEDIUM IMPACT)
Current: `select("*")` loads everything
Solution:
```typescript
// Instead of:
.select("*")

// Do:
.select("id, name, deck_id, word_de, translation_ru, own_status")
```

Benefit: Smaller payloads (examples, descriptions, group_en rarely needed at once)

### 5. **Memoize Expensive Filters** (LOW IMPACT)
Already done in useAllStudentCards with `useMemo`
- newCards, reviewQueue, masteredCards are memoized
- Consider adding shallow equality check for cards array before recalc

## Architecture Recommendations

### Use Composition for Shared Data
```typescript
// Instead of: 5 hooks all fetching different things
// Create a single "dashboard context" that:
// - Loads user, decks, all cards in one batch
// - Provides deriv computed values (reviewCount, masteredCount)
// - Single source of truth for invalidation
```

### Profile Updates Pattern
```typescript
const debouncedUpdateProfile = useMemo(
  () => debounce((patch) => updateProfile(patch), 300),
  [updateProfile]
)
```

### Monitoring
- Add performance markers in Chrome DevTools
- Track query count per page load
- Alert if single page triggers 20+ queries

## Database Optimizations (Backend)

- Verify indexes exist on: `owner_id`, `deck_id`, `student_id`, `teacher_id`
- Consider materialized view for `cards_with_marks` if not already
- Add RLS policy indexes

## Current Code Debt
- No loading states during initial mount (add skeletons)
- Rerender storm on auth state change (add shallow equality in providers)
- No error boundaries (add catch blocks with user-facing messages)
