// Detect real fs support — only in Node.js, skip in Workers/Lambda
let fs = null
let dirname = null

if (typeof globalThis.process?.versions?.node === 'string') {
  try {
    const _fs = await import('node:fs')
    _fs.mkdirSync('.', { recursive: true })
    fs = _fs
    dirname = (await import('node:path')).dirname
  } catch {}
}

export { fs, dirname }
