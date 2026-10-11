#!/usr/bin/env node
/**
 * Download the real-file corpus listed in `manifest.json` into `.corpus/` (git-ignored).
 *
 * Idempotent: files that already exist with the expected size are skipped. Every download is
 * checked against the manifest's `sizeBytes`; a mismatch fails the run. The files keep their
 * original licences (see `license` in the manifest) and are never committed.
 *
 *   node scripts/corpus/fetch.mjs            # download what is missing
 *   node scripts/corpus/fetch.mjs --check    # only verify what is there, no network
 */
import { spawnSync } from 'node:child_process'
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// Node's fetch honours HTTPS_PROXY only with NODE_USE_ENV_PROXY (Node ≥ 22.21): re-run with it set.
if ((process.env.HTTPS_PROXY || process.env.https_proxy) && !process.env.NODE_USE_ENV_PROXY) {
    const r = spawnSync(process.execPath, ['--disable-warning=UNDICI-EHPA', ...process.argv.slice(1)], { stdio: 'inherit', env: { ...process.env, NODE_USE_ENV_PROXY: '1' } })
    process.exit(r.status ?? 1)
}

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '../..')
const target = resolve(root, '.corpus')
const manifest = JSON.parse(await readFile(resolve(here, 'manifest.json'), 'utf8'))
const checkOnly = process.argv.includes('--check')
const CONCURRENCY = 8
const RETRIES = 4

const sizeOf = async (path) => {
    try {
        return (await stat(path)).size
    } catch {
        return -1
    }
}

async function download(entry) {
    let lastError
    for (let attempt = 0; attempt < RETRIES; attempt++) {
        if (attempt > 0) await new Promise((r) => setTimeout(r, 2000 * 2 ** (attempt - 1)))
        try {
            const res = await fetch(entry.url)
            if (!res.ok) throw new Error(`HTTP ${res.status}`)
            const bytes = Buffer.from(await res.arrayBuffer())
            if (bytes.length !== entry.sizeBytes) throw new Error(`size ${bytes.length}, expected ${entry.sizeBytes}`)
            await writeFile(resolve(target, entry.file), bytes)
            return
        } catch (e) {
            lastError = e
        }
    }
    throw lastError
}

await mkdir(target, { recursive: true })
const counts = { present: 0, downloaded: 0, failed: 0 }
const failures = []
const queue = [...manifest]
await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
        for (let entry = queue.shift(); entry; entry = queue.shift()) {
            if ((await sizeOf(resolve(target, entry.file))) === entry.sizeBytes) {
                counts.present++
                continue
            }
            if (checkOnly) {
                counts.failed++
                failures.push(`${entry.file}: missing or wrong size`)
                continue
            }
            try {
                await download(entry)
                counts.downloaded++
            } catch (e) {
                counts.failed++
                failures.push(`${entry.file}: ${e instanceof Error ? e.message : e}`)
            }
        }
    }),
)

console.log(`corpus: ${manifest.length} files — ${counts.present} present, ${counts.downloaded} downloaded, ${counts.failed} failed (${target})`)
for (const f of failures) console.error(`  ✗ ${f}`)
process.exit(counts.failed > 0 ? 1 : 0)
