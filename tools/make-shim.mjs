// 단독 `bun test core/` 용 보조: node_modules/claude-code/testing 을 bun:test 로 연결한다 (gitignore 대상).
// 공식 실행 경로는 `claude plugin test .` 이며 이 스크립트가 필요 없다.
import { mkdirSync, writeFileSync } from 'node:fs'
mkdirSync('node_modules/claude-code', { recursive: true })
writeFileSync('node_modules/claude-code/package.json', JSON.stringify({ name: 'claude-code', version: '0.0.0-shim', exports: { './testing': './testing.js' } }))
// bun 은 내장 모듈 bun:test 의 재export(`export *`, `export { } from`)를 풀지 못해 값으로 받아 내보낸다.
writeFileSync('node_modules/claude-code/testing.js', "import * as t from 'bun:test'\nexport const { describe, expect, test, mock } = t\n")
