// 판정을 켠 조합기(register 와 같은 연결)로 단어 끝 결과를 본다.
import { describe, expect, test } from 'claude-code/testing'

import { HangulComposer } from './composer'
import { decide, init } from './judge'
import { LAYOUTS } from './layouts'
import type { LayoutId } from './layouts'

const typed = (id: LayoutId, keys: string) => {
  init({ eng: [], kor: [] })
  const c = new HangulComposer(LAYOUTS[id], { keepKeys: (l, k, h) => decide(l, k, h) === 'en' })
  // 스페이스로 단어를 끝내야 판정이 돈다.
  return c.typeAll(keys + ' ').slice(0, -1)
}
const s3 = (k: string) => typed('sebeolsik-390', k)
const d2 = (k: string) => typed('dubeolsik', k)

describe('단어 판정 (core/judge)', () => {
  test('개발 용어는 영어로: 390 gh·pr·md·https, 두벌식 gh·git', () => {
    expect(['gh', 'pr', 'md', 'https'].map(s3)).toEqual(['gh', 'pr', 'md', 'https'])
    expect(['gh', 'git'].map(d2)).toEqual(['gh', 'git'])
  })

  test('흔한 한 음절 한글과 겹치면 한글: 390 rm → 해, 두벌식 rm → 그', () => {
    expect(s3('rm')).toBe('해')
    expect(d2('rm')).toBe('그')
  })

  test('세벌식 시프트 숫자·기호는 그대로 치환: J → 4, KL → 56 (숫자를 칠 유일한 방법)', () => {
    expect(s3('J')).toBe('4')
    expect(s3('KL')).toBe('56')
  })

  test('한글 단어 끝에 붙은 기호는 단어를 영어로 만들지 않는다: 한글! · 한4', () => {
    expect(s3('mfskgwB')).toBe('한글!')
    expect(s3('mfsJ')).toBe('한4')
  })

  test('음절 사이에 기호가 끼면 영어: 390 GitHub', () => {
    expect(s3('GitHub')).toBe('GitHub')
  })

  test('숫자가 섞인 개발 용어: 390 k8s', () => {
    expect(s3('k8s')).toBe('k8s')
  })

  test('한글은 한글로: 390 mfskgw → 한글, 두벌식 gksrmf → 한글', () => {
    expect(s3('mfskgw')).toBe('한글')
    expect(d2('gksrmf')).toBe('한글')
  })
})
