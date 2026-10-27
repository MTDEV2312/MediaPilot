import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import path from 'path'
import fs from 'fs'
import os from 'os'
import { resolveRunner, existeRuta } from '../../electron/resource-paths'

describe('Resource paths and runner resolution', () => {
  const origResourcesPath = (process as any).resourcesPath
  const origTdpPython = process.env.TDP_PYTHON
  let tempDir: string

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mp-test-'))
  })

  afterEach(() => {
    if (origResourcesPath !== undefined) {
      ;(process as any).resourcesPath = origResourcesPath
    } else {
      delete (process as any).resourcesPath
    }
    if (origTdpPython !== undefined) {
      process.env.TDP_PYTHON = origTdpPython
    } else {
      delete process.env.TDP_PYTHON
    }
    try {
      fs.rmSync(tempDir, { recursive: true, force: true })
    } catch {
      /* ignore */
    }
  })

  it('existeRuta returns true for existing file and false for non-existent', () => {
    const testFile = path.join(tempDir, 'sample.txt')
    fs.writeFileSync(testFile, 'hello')
    expect(existeRuta(testFile)).toBe(true)
    expect(existeRuta(path.join(tempDir, 'does-not-exist.txt'))).toBe(false)
    expect(existeRuta('')).toBe(false)
  })

  it('resolveRunner falls back to python interpreter when no .exe is found', () => {
    delete (process as any).resourcesPath
    process.env.TDP_PYTHON = 'custom-python'

    const runner = resolveRunner('subtitles.py', ['fetch', '--title', 'dune'])
    expect(runner.cmd).toBe('custom-python')
    expect(runner.args[0]).toContain('subtitles.py')
    expect(runner.args.slice(1)).toEqual(['fetch', '--title', 'dune'])
  })

  it('resolveRunner prefers compiled .exe when resourcesPath contains the binary', () => {
    ;(process as any).resourcesPath = tempDir
    const fakeExe = path.join(tempDir, 'custom-tool.exe')
    fs.writeFileSync(fakeExe, 'binary')

    const runner = resolveRunner('custom-tool.py', ['search', 'matrix'])
    expect(runner.cmd).toBe(fakeExe)
    expect(runner.args).toEqual(['search', 'matrix'])
  })

  it('resolveRunner handles direct .exe script name in packaged resources', () => {
    ;(process as any).resourcesPath = tempDir
    const fakeExe = path.join(tempDir, 'latino-providers.exe')
    fs.writeFileSync(fakeExe, 'binary')

    const runner = resolveRunner('latino-providers.exe', ['--query', 'dune'])
    expect(runner.cmd).toBe(fakeExe)
    expect(runner.args).toEqual(['--query', 'dune'])
  })

  it('resolveRunner finds binaries in qbit-plugins subfolder within resourcesPath', () => {
    ;(process as any).resourcesPath = tempDir
    const qbitDir = path.join(tempDir, 'qbit-plugins')
    fs.mkdirSync(qbitDir, { recursive: true })
    const fakeRunner = path.join(qbitDir, 'qbit-runner.exe')
    fs.writeFileSync(fakeRunner, 'binary')

    const runner = resolveRunner('qbit-runner.exe', ['query'])
    expect(runner.cmd).toBe(fakeRunner)
    expect(runner.args).toEqual(['query'])
  })
})
