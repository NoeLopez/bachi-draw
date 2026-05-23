// Fija el nombre de la app en el bundle de Electron usado en DESARROLLO.
//
// En macOS el primer ítem del menú toma CFBundleName del .app que se ejecuta, y
// en dev ese .app es node_modules/electron/dist/Electron.app (CFBundleName =
// "Electron"). app.setName() no lo sobreescribe en dev, así que parcheamos su
// Info.plist. Corre en postinstall para sobrevivir a reinstalaciones/updates.
//
// En la app EMPAQUETADA manda productName (electron-builder.yml); esto es solo
// para que el menú diga "Bachi Draw" también durante el desarrollo en macOS.
const { execFileSync } = require('node:child_process')
const { existsSync } = require('node:fs')
const path = require('node:path')

const APP_NAME = 'Bachi Draw'

// Solo aplica a macOS; en otros SO no hay menú-bar atado al bundle.
if (process.platform !== 'darwin') process.exit(0)

const plist = path.join(
  __dirname,
  '..',
  'node_modules',
  'electron',
  'dist',
  'Electron.app',
  'Contents',
  'Info.plist'
)

if (!existsSync(plist)) {
  console.log('[patch-electron-name] Electron.app no encontrado; se omite.')
  process.exit(0)
}

for (const key of ['CFBundleName', 'CFBundleDisplayName']) {
  try {
    execFileSync('/usr/libexec/PlistBuddy', ['-c', `Set :${key} ${APP_NAME}`, plist])
  } catch {
    // La clave puede no existir todavía: la añadimos.
    try {
      execFileSync('/usr/libexec/PlistBuddy', ['-c', `Add :${key} string ${APP_NAME}`, plist])
    } catch {
      /* PlistBuddy no disponible o clave no editable; no es crítico. */
    }
  }
}

console.log(`[patch-electron-name] menú de dev de macOS → "${APP_NAME}"`)
