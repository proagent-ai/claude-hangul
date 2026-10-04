// 일회성 생성기: libhangul 키보드 정의(XML template)에서 core/layout-data.ts 를 만든다.
// 사용: node tools/gen-layout.mjs <libhangul/data/keyboards 경로> > core/layout-data.ts
// 출처: https://github.com/libhangul/libhangul  data/keyboards/hangul-keyboard-{2,39,3f}.xml.template
//       (LGPL-2.1; 여기서는 "어느 키가 어느 자모인지"라는 사실 데이터만 옮겼다.)
import { readFileSync } from 'node:fs'
const dir = process.argv[2]
const CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ'
const JUNG = 'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ'
const JONG = 'ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ'
// 세벌식에서 "비(非)문자/시프트 위치" 키는 단일 출처라 미확인으로 표시한다.
const CORE_KEY = /^[a-z0-9;'\/]$/

function rows(id) {
  const xml = readFileSync(`${dir}/hangul-keyboard-${id}.xml.template`, 'utf8')
  const out = []
  for (const m of xml.matchAll(/<item key="0x([0-9a-f]+)" value="0x([0-9a-f]+)"/g)) {
    const key = String.fromCharCode(parseInt(m[1], 16))
    const v = parseInt(m[2], 16)
    let def
    let isLit = false
    if (v >= 0x1100 && v <= 0x1112) def = `${id === '2' ? 'cons' : 'cho'}('${CHO[v - 0x1100]}')`
    else if (v >= 0x1161 && v <= 0x1175) def = `jung('${JUNG[v - 0x1161]}')`
    else if (v >= 0x11a8 && v <= 0x11c2) def = `jong('${JONG[v - 0x11a8]}')`
    else if (String.fromCharCode(v) === key) continue
    else { def = `lit(${JSON.stringify(String.fromCharCode(v))})`; isLit = true }
    let note = ''
    if (id !== '2' && (isLit || !CORE_KEY.test(key))) note = ' // 미확인(libhangul 단일 출처, 공식 도표 대조 안 함)'
    if (id === '2' && /[A-Z]/.test(key) && !'QWERTOP'.includes(key)) note = ' // 대문자=소문자와 동일(libhangul 기준)'
    out.push(`  ${JSON.stringify(key)}: ${def},${note}`)
  }
  return out.join('\n')
}

console.log(`// 자동 생성 파일: tools/gen-layout.mjs (직접 고치지 말고 생성기를 고칠 것)
// 출처: libhangul (https://github.com/libhangul/libhangul) data/keyboards/hangul-keyboard-{2,39,3f}.xml.template
//   commit 5094421d9586294b2aad09924b9a54e2e6060f06 (2026-09-14)
// 검증 상태:
//   - 자모 키(소문자·숫자·; ' /)는 libhangul과 작성자 기억이 일치했으나, 독립 문헌/공식 표준(KS X 5002, 공병우 도표)과의
//     대조는 수행하지 못함 → 전체적으로 "단일 출처, 독립 대조 미확인".
//   - 항등 매핑(키가 자기 문자로 나오는 것)은 생략했다. 표에 없는 키 = 그대로 통과.
//   - 세벌식의 시프트/기호 위치는 개별 행에 '미확인'을 달았다.
import { cho, cons, jong, jung, lit } from './keydef'
import type { KeyDef } from './keydef'

/** 두벌식 (KS X 5002). cons = 초성·종성 겸용 자음. */
export const DUBEOLSIK: Readonly<Record<string, KeyDef>> = {
${rows('2')}
}

/** 세벌식 390 (libhangul id "39"). cho/jung/jong 은 키마다 고정된 역할. */
export const SEBEOLSIK_390: Readonly<Record<string, KeyDef>> = {
${rows('39')}
}

/** 세벌식 최종 (libhangul id "3f"). */
export const SEBEOLSIK_FINAL: Readonly<Record<string, KeyDef>> = {
${rows('3f')}
}
`)
