import { describe, expect, test } from 'claude-code/testing'

import { countPrompts, promptOf } from './learn'

const user = (content: unknown, extra: Record<string, unknown> = {}) => JSON.stringify({ type: 'user', message: { role: 'user', content }, ...extra })

describe('/hangul learn: 기록에서 사람이 친 한글 프롬프트만 고른다', () => {
  test('한글 문장 프롬프트는 고른다', () => {
    expect(promptOf(user('gh pr 목록 보여줘'))).toBe('gh pr 목록 보여줘')
    expect(promptOf(user([{ type: 'text', text: 'README 고쳐줘' }]))).toBe('README 고쳐줘')
  })

  test('도구 결과·서브에이전트·메타·명령 출력·코드 블록·영어 위주 글은 뺀다', () => {
    expect(promptOf(user([{ type: 'tool_result', content: '결과' }]))).toBeUndefined()
    expect(promptOf(user('한글', { isSidechain: true }))).toBeUndefined()
    expect(promptOf(user('한글', { isMeta: true }))).toBeUndefined()
    expect(promptOf(user('<command-name>/hangul</command-name> 한글'))).toBeUndefined()
    expect(promptOf(user('코드 ```ts x```'))).toBeUndefined()
    expect(promptOf(user('Review this change for security vulnerabilities 확인'))).toBeUndefined()
    expect(promptOf(JSON.stringify({ type: 'assistant', message: { content: '한글' } }))).toBeUndefined()
    expect(promptOf('not json "type":"user"')).toBeUndefined()
  })

  test('영어 단어와 한글 어절을 세고, 같은 글은 한 번만 센다', () => {
    const r = countPrompts(['gh pr 열어줘', 'gh pr 열어줘', 'gh 이슈 확인'])
    expect(r.prompts).toBe(2)
    expect(r.eng).toEqual([['gh', 2], ['pr', 1]])
    expect(r.kor).toEqual([['열어줘', 1], ['이슈', 1], ['확인', 1]])
  })

  test('앞 40자가 4번 넘게 반복되는 템플릿은 뺀다', () => {
    const head = '이 변경을 보안 관점에서 검토하고 결과를 아래 형식으로 정리해 주세요. 파일 목록은 다음과 같다'
    const r = countPrompts([1, 2, 3, 4].map(i => `${head} ${i}`).concat(['직접 친 글']))
    expect(r.prompts).toBe(1)
  })
})
