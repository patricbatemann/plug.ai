// Colours come from Carbon tokens only; fail on any colour literal in app code.
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const literal = /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/
const files = readdirSync('src', { recursive: true })
  .filter((f) => /\.(tsx?|s?css)$/.test(f))
  .map((f) => join('src', f))

const hits = files.flatMap((file) =>
  readFileSync(file, 'utf8')
    .split('\n')
    .flatMap((line, i) => (literal.test(line) ? [`${file}:${i + 1}: ${line.trim()}`] : [])),
)

if (hits.length) {
  console.error(`Colour literals found (use Carbon tokens):\n${hits.join('\n')}`)
  process.exit(1)
}
