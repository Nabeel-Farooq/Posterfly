const store = new Map()

export function cacheGet(key) {
    const entry = store.get(key)

    if (!entry) {
        return null
    }

    const isExpired = Date.now() > entry.expiresAt

    if (isExpired) {
        store.delete(key)

        return null
    }

    return entry.data
}

export function cacheSet(key, data, ttlMs) {
    store.set(key, {
        data,
        expiresAt: Date.now() + ttlMs,
    })

    return data
}
