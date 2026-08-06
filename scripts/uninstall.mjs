#!/usr/bin/env node
/**
 * Freebuff RTL Injector — uninstall.mjs
 * Restores app.asar from app.asar.bak and removes the userData mod folder.
 */

import { existsSync, copyFileSync, rmSync } from 'node:fs'
import path from 'node:path'
import os from 'node:os'

function candidateAsarPaths() {
  const home = os.homedir()
  const plat = process.platform
  const candidates = []
  if (plat === 'darwin') {
    candidates.push('/Applications/Freebuff.app/Contents/Resources/app.asar')
  } else if (plat === 'win32') {
    const localAppData = process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local')
    candidates.push(path.join(localAppData, 'Programs', 'Freebuff', 'resources', 'app.asar'))
  } else {
    candidates.push('/opt/Freebuff/resources/app.asar')
    candidates.push(path.join(home, '.local/share/Freebuff/resources/app.asar'))
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

const argPath = process.argv[2]
const asarPath = argPath || candidateAsarPaths()[0]

if (!asarPath || !existsSync(asarPath)) {
  console.error('Could not find app.asar. Pass the path explicitly:\n  node scripts/uninstall.mjs "/path/to/app.asar"')
  process.exit(1)
}

const backupPath = path.join(path.dirname(asarPath), 'app.asar.bak')
if (!existsSync(backupPath)) {
  console.error(`No backup found at ${backupPath}. Reinstall Freebuff instead.`)
  process.exit(1)
}

copyFileSync(backupPath, asarPath)
console.log(`Restored original app.asar from backup.`)

const modDir = path.join(userDataDir(), 'freebuff-rtl')
if (existsSync(modDir)) {
  rmSync(modDir, { recursive: true, force: true })
  console.log(`Removed mod folder: ${modDir}`)
}

console.log('Done. Freebuff is back to stock.')
