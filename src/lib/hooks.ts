import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db'

export function useCategories() {
  return useLiveQuery(
    async () => (await db.categories.toArray()).sort((a, b) => a.sortOrder - b.sortOrder),
    [],
  )
}
