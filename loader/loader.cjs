/**
 * Freebuff RTL Injector — loader.cjs
 *
 * This file is NOT inside app.asar. It lives in Electron's userData folder
 * (see scripts/patch-asar.mjs for the one line that requires it from the
 * patched main.cjs). Because it lives outside the asar, editing it — or
 * anything under mod/ — takes effect on the next app launch with no
 * repacking step.
 *
 * Responsibilities:
 *   1. Watch the mod folder for rtl.css / rtl.js / config.json.
 *   2. On every did-finish-load (initial load AND any later reload —
 *      Freebuff's own updater/menu can call loadURL again), (re)inject them.
 *   3. Fail silently and log to console rather than ever crashing the host
 *      app — a broken mod must never take Freebuff down with it.
 */

'use strict'

const fs = require('node:fs')
const path = require('node:path')

const MOD_DIR = path.join(__dirname, 'mod')
const CSS_PATH = path.join(MOD_DIR, 'rtl.css')
const JS_PATH = path.join(MOD_DIR, 'rtl.js')
const CONFIG_PATH = path.join(MOD_DIR, 'config.json')

function readSafe(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8')
  } catch (err) {
    console.error(`[freebuff-rtl] could not read ${filePath}:`, err.message)
    return ''
  }
}

function readConfig() {
  try {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf8')
    return JSON.parse(raw)
  } catch {
    // Defaults if config.json is missing or invalid — the mod must still work.
    return { enabled: true, mode: 'auto', forceDir: null }
  }
}

let insertedCssKey = null

/**
 * Inject (or re-inject) the mod into a webContents.
 * Safe to call multiple times — CSS keys are tracked so we remove the old
 * one before adding the new one instead of stacking duplicates.
 */
async function inject(webContents) {
  if (webContents.isDestroyed()) return
  const config = readConfig()
  if (!config.enabled) return

  const css = readSafe(CSS_PATH)
  const js = readSafe(JS_PATH)

  try {
    if (insertedCssKey) {
      await webContents.removeInsertedCSS(insertedCssKey).catch(() => {})
      insertedCssKey = null
    }
    if (css) {
      insertedCssKey = await webContents.insertCSS(css)
    }
  } catch (err) {
    console.error('[freebuff-rtl] insertCSS failed:', err.message)
  }

  try {
    if (js) {
      // Wrap in an IIFE and pass config in so rtl.js doesn't need its own
      // file-reading logic — it only runs inside the renderer's world.
      const wrapped = `
        (function () {
          try {
            window.__freebuffRtlConfig = ${JSON.stringify(config)};
            ${js}
          } catch (e) {
            console.error('[freebuff-rtl]', e);
          }
        })();
      `
      await webContents.executeJavaScript(wrapped, true)
    }
  } catch (err) {
    console.error('[freebuff-rtl] executeJavaScript failed:', err.message)
  }
}

/**
 * Attach the injector to a BrowserWindow. Call this once per window,
 * right after did-finish-load is wired up in main.cjs (or from inside
 * the same handler).
 */
function attach(mainWindow) {
  if (!mainWindow || mainWindow.isDestroyed()) return

  const run = () => inject(mainWindow.webContents)

  // Cover the very first load...
  mainWindow.webContents.on('did-finish-load', run)
  // ...and any later full reload (menu "reload", updater re-point, etc).
  mainWindow.webContents.on('did-navigate', run)

  // Hot-reload the mod itself during development: editing rtl.css/rtl.js
  // re-injects without restarting Freebuff. Best-effort — fs.watch is
  // flaky on some network filesystems, so failures here are non-fatal.
  try {
    fs.watch(MOD_DIR, { persistent: false }, () => run())
  } catch (err) {
    console.error('[freebuff-rtl] fs.watch unavailable:', err.message)
  }

  // Run once immediately in case the window already finished loading
  // before attach() was called (defensive; normally it hasn't).
  if (!mainWindow.webContents.isLoading()) run()
}

module.exports = { attach, inject }
