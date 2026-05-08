const PAGE_SIZE = 1000

export async function fetchAllItems(client, { userId, publicOnly = false, columns = '*, tags(id, name, is_private)' } = {}) {
  let from = 0
  const all = []
  for (;;) {
    let query = client
      .from('items')
      .select(columns)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(from, from + PAGE_SIZE - 1)
    if (publicOnly) query = query.eq('is_private', false)
    const { data, error } = await query
    if (error) throw error
    all.push(...data)
    if (data.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }
  return all
}

export async function fetchItemCount(client, { userId, publicOnly = false } = {}) {
  let query = client
    .from('items')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
  if (publicOnly) query = query.eq('is_private', false)
  const { count, error } = await query
  if (error) throw error
  return count ?? 0
}
