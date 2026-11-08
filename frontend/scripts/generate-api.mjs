import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

const root = fileURLToPath(new URL('../', import.meta.url))
const config = JSON.parse(await readFile(resolve(root, 'openapi-generator.json'), 'utf8'))
const jar = resolve(root, `.cache/openapi-generator/${config.version}.jar`)
let bytes
try {
  bytes = await readFile(jar)
} catch (error) {
  if (error.code !== 'ENOENT') throw error
  console.log(`Downloading OpenAPI Generator ${config.version}…`)
  const url = `https://repo.maven.apache.org/maven2/org/openapitools/openapi-generator-cli/${config.version}/openapi-generator-cli-${config.version}.jar`
  const response = await fetch(url, { signal: AbortSignal.timeout(120_000) })
  if (!response.ok) throw new Error(`Generator download failed: HTTP ${response.status}`)
  bytes = Buffer.from(await response.arrayBuffer())
}
if (createHash('sha256').update(bytes).digest('hex') !== config.sha256) {
  throw new Error('OpenAPI Generator checksum does not match the pinned version.')
}
await mkdir(resolve(root, '.cache/openapi-generator'), { recursive: true })
await writeFile(jar, bytes)
const result = spawnSync('java', [
  '-Dorg.slf4j.simpleLogger.defaultLogLevel=warn', '-jar', jar, 'generate',
  '-i', config.inputSpec, '-g', config.generatorName, '-o', config.outputDir,
  '--additional-properties', Object.entries(config.additionalProperties).map(([key, value]) => `${key}=${value}`).join(','),
  '--global-property', 'apiDocs=false,modelDocs=false,apiTests=false,modelTests=false',
], { cwd: root, stdio: 'inherit' })
if (result.error) throw new Error(`Cannot start Java. Install JDK 21 and retry: ${result.error.message}`)
process.exit(result.status ?? 1)
