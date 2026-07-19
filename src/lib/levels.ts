export function splitIntoLevels<T>(items: T[], levelSize: number): T[][] {
  const levels: T[][] = []
  for (let i = 0; i < items.length; i += levelSize) {
    levels.push(items.slice(i, i + levelSize))
  }
  return levels
}
