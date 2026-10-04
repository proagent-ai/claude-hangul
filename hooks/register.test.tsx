import { expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'
import type { Engine } from 'claude-code/testing'

// [미검증] 하네스 사용법은 claude-vime 의 hooks/register.test.tsx 를 그대로 따랐다.
const runHangul = ($: Engine, args = '') =>
  $.command.run({ command: 'hangul', args, origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 90 } })

function standInForEngine(on: On) {
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  on('command.register', (_$, e) => ({ value: { command: e.name } }))
}

function recordStatus(on: On) {
  const shown: (string | undefined)[] = []
  on('ui.status', (_$, e) => {
    shown.push(e.text)
    return { value: undefined }
  })
  return shown
}

test('시작하면 상태줄을 비운다', async ($, on) => {
  standInForEngine(on)
  mock.env(on, {})
  const shown = recordStatus(on)
  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
  expect(shown).toEqual([undefined])
})

test('/hangul 로 켜고 끄며 상태줄에 레이아웃을 보인다', async ($, on) => {
  standInForEngine(on)
  mock.env(on, {})
  const shown = recordStatus(on)
  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
  const first = await runHangul($)
  const second = await runHangul($)
  expect({ answers: [first.text, second.text], shown }).toEqual({
    answers: ['on (두벌식)', 'off'],
    shown: [undefined, '한 두벌식', undefined],
  })
})

test('/hangul 390 은 레이아웃을 바꾸며 켠다', async ($, on) => {
  standInForEngine(on)
  mock.env(on, {})
  const shown = recordStatus(on)
  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
  const r = await runHangul($, '390')
  expect({ text: r.text, shown }).toEqual({ text: 'on (세벌식 390)', shown: [undefined, '한 세벌식 390'] })
})

test('등록하는 명령은 hangul 하나뿐이다', async ($, on) => {
  const names: string[] = []
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  on('command.register', (_$, e) => {
    names.push(e.name)
    return { value: { command: e.name } }
  })
  on('ui.status', () => ({ value: undefined }))
  mock.env(on, {})
  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
  expect(names).toEqual(['hangul'])
})

test('HANGUL_LAYOUT=final 이면 시작 레이아웃이 세벌식 최종', async ($, on) => {
  standInForEngine(on)
  mock.env(on, { HANGUL_LAYOUT: 'final' })
  recordStatus(on)
  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
  const r = await runHangul($)
  expect(r.text).toBe('on (세벌식 최종)')
})

test('prompt.submit 은 보낸 텍스트를 그대로 둔다', async ($, on) => {
  standInForEngine(on)
  on('prompt.submit', (_$, e) => ({ text: e.text }))
  mock.env(on, {})
  recordStatus(on)
  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
  await runHangul($)
  const submitted = await $.prompt.submit({ text: '한글', wait: false, origin: { kind: 'composer' } })
  expect(submitted.text).toBe('한글')
})
