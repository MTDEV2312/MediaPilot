// resource-paths.ts — dónde está de verdad un script o un motor.
//
// La app empaquetada los tiene en sus recursos (process.resourcesPath). Al
// ejecutarla desde el código, esa carpeta es node_modules/electron/dist/resources
// y ahí no hay ningún .py ni ningún motor: la app buscaba tmdb-provider.py
// dentro de Electron y fallaba con
//   can't open file ...node_modules/electron/dist/resources/tmdb-provider.py
//
// Aquí se prueban los sitios posibles (recursos, raíz del proyecto y la carpeta
// electron/ del proyecto) y se devuelve el primero que exista.
import fs from 'fs'
import path from 'path'

function getAppPathSafe(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const electron = require('electron')
    const appObj = electron && typeof electron === 'object' ? electron.app : null
    if (appObj && typeof appObj.getAppPath === 'function') {
      return appObj.getAppPath()
    }
  } catch {
    /* ignore */
  }
  return ''
}

function candidatos(partes: string[]): string[] {
  const raiz = getAppPathSafe()
  const cwd = typeof process !== 'undefined' && process.cwd ? process.cwd() : ''
  const resources = typeof process !== 'undefined' ? process.resourcesPath : ''

  return [
    resources ? path.join(resources, ...partes) : '',
    resources ? path.join(resources, 'qbit-plugins', ...partes) : '',
    raiz ? path.join(raiz, ...partes) : '',
    raiz ? path.join(raiz, 'electron', ...partes) : '',
    path.join(__dirname, '..', ...partes),
    path.join(__dirname, '..', 'electron', ...partes),
    path.join(__dirname, ...partes),
    cwd ? path.join(cwd, ...partes) : '',
    cwd ? path.join(cwd, 'electron', ...partes) : '',
  ].filter(Boolean)
}

export function existeRuta(p: string): boolean {
  if (!p) return false
  try {
    return fs.existsSync(p)
  } catch {
    return false
  }
}

/** Primera ruta existente de las posibles (o la primera, para que el error diga algo útil). */
export function rutaDeRecurso(...partes: string[]): string {
  const lista = candidatos(partes)
  for (const c of lista) {
    if (existeRuta(c)) return c
  }
  return lista[0] || path.join(...partes)
}

export interface RunnerCommand {
  cmd: string
  args: string[]
}

/**
 * Resuelve el ejecutable o comando a invocar.
 * En producción (app empaquetada), busca primero si existe el binario nativo .exe
 * (p.ej. tmdb-provider.exe, latino-providers.exe) en process.resourcesPath.
 * Si existe, lo invoca directamente sin requerir Python del sistema ni abrir archivos dentro del ASAR.
 * Si no existe (p.ej. en desarrollo o Linux), recurre al intérprete de Python con el script .py.
 */
export function resolveRunner(scriptOrExeName: string, extraArgs: string[] = []): RunnerCommand {
  // 1. Si es un script .py, comprobar primero si existe un .exe compilado equivalente
  if (scriptOrExeName.endsWith('.py')) {
    const exeName = scriptOrExeName.replace(/\.py$/, '.exe')
    const exePath = rutaDeRecurso(exeName)
    if (existeRuta(exePath)) {
      return { cmd: exePath, args: extraArgs }
    }
  }

  // 2. Si es directamente un .exe (o subpath como 'qbit-plugins/qbit-runner.exe')
  if (scriptOrExeName.endsWith('.exe')) {
    const exePath = rutaDeRecurso(scriptOrExeName)
    if (existeRuta(exePath)) {
      return { cmd: exePath, args: extraArgs }
    }
  }

  // 3. Fallback: invocar con Python el script .py
  const scriptPath = rutaDeRecurso(scriptOrExeName)
  const py = process.env.TDP_PYTHON || (process.platform === 'win32' ? 'python' : 'python3')
  return { cmd: py, args: [scriptPath, ...extraArgs] }
}
