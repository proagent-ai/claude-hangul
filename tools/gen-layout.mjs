// 일회성 생성기: libhangul 키보드 정의(XML template)에서 core/layout-data.ts 를 만든다.
// 사용: node tools/gen-layout.mjs <libhangul/data/keyboards 경로> > core/layout-data.ts
// 출처: https://github.com/libhangul/libhangul  data/keyboards/hangul-keyboard-{2,39,3f}.xml.template
//       (LGPL-2.1; 여기서는 "어느 키가 어느 자모인지"라는 사실 데이터만 옮겼다.)
import { readFileSync } from 'node:fs'
const dir = process.argv[2]
const CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ'
const JUNG = 'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ'
const JONG = 'ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ'
// 세벌식 최종에서 uim만 다른 키. libhangul·Emacs 값을 유지한다.
const UIM_DIFF = { '3f': { '|': '₩' } }

function rows(id) {
  const xml = readFileSync(`${dir}/hangul-keyboard-${id}.xml.template`, 'utf8')
  const out = []
  for (const m of xml.matchAll(/<item key="0x([0-9a-f]+)" value="0x([0-9a-f]+)"/g)) {
    const key = String.fromCharCode(parseInt(m[1], 16))
    const v = parseInt(m[2], 16)
    let def
    if (v >= 0x1100 && v <= 0x1112) def = `${id === '2' ? 'cons' : 'cho'}('${CHO[v - 0x1100]}')`
    else if (v >= 0x1161 && v <= 0x1175) def = `jung('${JUNG[v - 0x1161]}')`
    else if (v >= 0x11a8 && v <= 0x11c2) def = `jong('${JONG[v - 0x11a8]}')`
    else if (String.fromCharCode(v) === key) continue
    else def = `lit(${JSON.stringify(String.fromCharCode(v))})`
    let note = ''
    const uim = UIM_DIFF[id]?.[key]
    if (uim !== undefined) note = ` // uim byeoru만 ${JSON.stringify(uim)}. libhangul·Emacs hangul.el은 이 값. KS/문화원 원문 미확인`
    else if (id === '2' && /[A-Z]/.test(key) && !'QWERTOP'.includes(key)) note = ' // 대문자=소문자와 동일 (libhangul·Emacs·uim 일치, KS X 5002 원문 미확인)'
    out.push(`  ${JSON.stringify(key)}: ${def},${note}`)
  }
  return out.join('\n')
}

console.log(`// 자동 생성 파일: tools/gen-layout.mjs (직접 고치지 말고 생성기를 고칠 것)
// 출처: libhangul (https://github.com/libhangul/libhangul) data/keyboards/hangul-keyboard-{2,39,3f}.xml.template
//   commit 5094421d9586294b2aad09924b9a54e2e6060f06 (2026-09-14)
// 검증 상태 (2026-10-04, 키별 대조. KS X 5002 PDF·한글문화원 인쇄 도표는 구하지 못함 → 표준 원문 대조는 미확인):
//   - 두벌식 자모 52키: libhangul = GNU Emacs lisp/leim/quail/hangul.el (2-bulsik) = uim scm/byeoru.scm (hangul2). 불일치 0.
//   - 세벌식 390 자모+기호: libhangul = Emacs (390) = uim (strict390). 불일치 0.
//   - 세벌식 최종 자모: libhangul = Emacs (final) = uim (strict3final). 불일치 0.
//   - 세벌식 최종 기호: Emacs와 전부 일치. uim만 '|' 가 ₩ (libhangul·Emacs는 백슬래시). 그 행에만 적었다.
//   - 항등 매핑(키가 자기 문자로 나오는 것)은 생략했다. 표에 없는 키 = 그대로 통과.
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
