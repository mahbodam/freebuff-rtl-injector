#!/usr/bin/env node
/**
 * Freebuff RTL Injector — patch-asar.mjs
 *
 * One-time (per-Freebuff-install) patch:
 *   1. Locate Freebuff's app.asar for the current OS.
 *   2. Back it up to app.asar.bak (only if a backup doesn't already exist,
 *      so re-running never overwrites your ORIGINAL pristine copy).
 *   3. Extract it, insert a 6-line hook into electron/main.cjs right after
 *      the existing `did-finish-load` wiring, repack.
 *   4. Copy loader/ (loader.cjs + mod/) into Electron's userData folder so
 *      the patched main.cjs can require() it at runtime.
 *
 * Idempotent: if the hook marker is already present, the script exits
 * without touching anything.
 *
 * Usage:
 *   node scripts/patch-asar.mjs                 # auto-detect path
 *   node scripts/patch-asar.mjs /custom/path/to/app.asar
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, cpSync, rmSync, readdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'

// On Windows, npm/npx ship as .cmd shims — spawning "npx" directly (without
// a shell) throws ENOENT because CreateProcess doesn't resolve .cmd/.bat
// files the way a shell's PATH lookup does. `shell: true` routes the spawn
// through cmd.exe so the same lookup rules as a manually-typed command apply.
// macOS/Linux npx is a real executable, so shell:true there is unnecessary
// but harmless.
function runNpx(args) {
  execFileSync('npx', args, { stdio: 'inherit', shell: process.platform === 'win32' })
}

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.join(__dirname, '..')
const LOADER_SRC = path.join(REPO_ROOT, 'loader')

const HOOK_MARKER = '/* freebuff-rtl-injector:hook */'

function candidateAsarPaths() {
  const home = os.homedir()
  const plat = process.platform
  const candidates = []

  if (plat === 'darwin') {
    candidates.push('/Applications/Freebuff.app/Contents/Resources/app.asar')
    candidates.push(path.join(home, 'Applications/Freebuff.app/Contents/Resources/app.asar'))
    // Fallback: scan /Applications and ~/Applications for any *.app bundle
    // whose name contains "freebuff" (electron-builder can name the bundle
    // after the npm package rather than the display name, as seen on Windows).
    for (const appsDir of ['/Applications', path.join(home, 'Applications')]) {
      try {
        if (existsSync(appsDir)) {
          for (const entry of readdirSync(appsDir)) {
            if (entry.toLowerCase().includes('freebuff') && entry.endsWith('.app')) {
              candidates.push(path.join(appsDir, entry, 'Contents', 'Resources', 'app.asar'))
            }
          }
        }
      } catch {
        /* best-effort */
      }
    }
  } else if (plat === 'win32') {
    const localAppData = process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local')
    // Real observed install folder name (electron-builder uses the npm
    // package name, not the display name): @codebufffreebuff-desktop.
    candidates.push(path.join(localAppData, 'Programs', '@codebufffreebuff-desktop', 'resources', 'app.asar'))
    candidates.push(path.join(localAppData, 'Programs', 'Freebuff', 'resources', 'app.asar'))
    candidates.push(path.join(localAppData, 'Freebuff', 'resources', 'app.asar'))
    // Fallback: scan Programs\* for any folder containing "freebuff" in its name.
    try {
      const programsDir = path.join(localAppData, 'Programs')
      if (existsSync(programsDir)) {
        for (const entry of readdirSync(programsDir)) {
          if (entry.toLowerCase().includes('freebuff')) {
            candidates.push(path.join(programsDir, entry, 'resources', 'app.asar'))
          }
        }
      }
    } catch {
      /* best-effort */
    }
  } else {
    // Linux: AppImage extracts on the fly (no static path); common installs below.
    candidates.push('/opt/Freebuff/resources/app.asar')
    candidates.push(path.join(home, '.local/share/Freebuff/resources/app.asar'))
    // Fallback: scan /opt and ~/.local/share for any folder containing "freebuff".
    for (const baseDir of ['/opt', path.join(home, '.local/share')]) {
      try {
        if (existsSync(baseDir)) {
          for (const entry of readdirSync(baseDir)) {
            if (entry.toLowerCase().includes('freebuff')) {
              candidates.push(path.join(baseDir, entry, 'resources', 'app.asar'))
            }
          }
        }
      } catch {
        /* best-effort */
      }
    }
  }
  return candidates.filter(existsSync)
}

function userDataDir() {
  const home = os.homedir()
  const plat = process.platform
  if (plat === 'darwin') return path.join(home, 'Library', 'Application Support', 'Freebuff')
  if (plat === 'win32') return path.join(process.env.APPDATA || path.join(home, 'AppData', 'Roaming'), 'Freebuff')
  return path.join(home, '.config', 'Freebuff')
}

function findAsar() {
  const argPath = process.argv[2]
  if (argPath) {
    if (!existsSync(argPath)) {
      console.error(`Given path does not exist: ${argPath}`)
      process.exit(1)
    }
    return argPath
  }
  const found = candidateAsarPaths()
  if (found.length === 0) {
    console.error(
      'Could not auto-detect app.asar. Re-run with an explicit path, e.g.\n' +
        '  node scripts/patch-asar.mjs "/path/to/Freebuff/resources/app.asar"\n' +
        '(Linux AppImages: extract first with `./Freebuff.AppImage --appimage-extract`,\n' +
        ' then point this script at squashfs-root/resources/app.asar.)'
    )
    process.exit(1)
  }
  return found[0]
}

function main() {
  const asarPath = findAsar()
  const asarDir = path.dirname(asarPath)
  const backupPath = path.join(asarDir, 'app.asar.bak')
  const workDir = path.join(os.tmpdir(), `freebuff-rtl-patch-${Date.now()}`)

  console.log(`Using app.asar: ${asarPath}`)

  if (!existsSync(backupPath)) {
    cpSync(asarPath, backupPath)
    console.log(`Backed up original to: ${backupPath}`)
  } else {
    console.log(`Backup already exists, leaving it as-is: ${backupPath}`)
  }

  mkdirSync(workDir, { recursive: true })
  runNpx(['--yes', 'asar', 'extract', asarPath, workDir])

  const mainCjsPath = path.join(workDir, 'electron', 'main.cjs')
  let src = readFileSync(mainCjsPath, 'utf8')

  if (src.includes(HOOK_MARKER)) {
    console.log('Hook already present — nothing to patch. (Mod files will still be refreshed.)')
  } else {
    const anchor = `mainWindow.webContents.on('did-finish-load', sendWindowState)`
    if (!src.includes(anchor)) {
      console.error(
        'Could not find the expected anchor line in main.cjs. Freebuff\'s\n' +
          'internals may have changed. Aborting without modifying anything —\n' +
          'please open an issue with your Freebuff version.'
      )
      rmSync(workDir, { recursive: true, force: true })
      process.exit(1)
    }
    const hook = `${anchor}
  ${HOOK_MARKER}
  try {
    const rtlLoaderPath = require('node:path').join(app.getPath('userData'), 'freebuff-rtl', 'loader.cjs')
    if (require('node:fs').existsSync(rtlLoaderPath)) {
      require(rtlLoaderPath).attach(mainWindow)
    }
  } catch (e) {
    console.error('[freebuff-rtl] failed to load injector:', e && e.message)
  }`
    src = src.replace(anchor, hook)
    writeFileSync(mainCjsPath, src, 'utf8')
    console.log('Patched electron/main.cjs')
  }

  // Repack.
  runNpx(['--yes', 'asar', 'pack', workDir, asarPath])
  console.log(`Repacked: ${asarPath}`)
  rmSync(workDir, { recursive: true, force: true })

  // Install the loader + mod files into userData (outside the asar, so
  // future edits don't require re-patching).
  const destDir = path.join(userDataDir(), 'freebuff-rtl')
  mkdirSync(destDir, { recursive: true })
  cpSync(path.join(LOADER_SRC, 'loader.cjs'), path.join(destDir, 'loader.cjs'))
  mkdirSync(path.join(destDir, 'mod'), { recursive: true })
  for (const file of ['rtl.css', 'rtl.js', 'config.json']) {
    const dest = path.join(destDir, 'mod', file)
    // Never overwrite a config.json the user has already customized.
    if (file === 'config.json' && existsSync(dest)) continue
    cpSync(path.join(LOADER_SRC, 'mod', file), dest)
  }
  console.log(`Installed loader + mod to: ${destDir}`)
  console.log('\nDone. (Re)start Freebuff to see RTL support applied.')
}

main()
