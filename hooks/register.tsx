// 한글 입력 mod 진입점.
// 이벤트 이름·$.command.register·$.ui.status·$.env.get 는 이 환경의 Claude Code 2.1.289 가
// 생성한 .claude-plugin/types 와 맞춘다. 키 이벤트 본문의 실측은 SPEC 을 본다.
import type { PromptEditInput, Register } from 'claude-code'

import { HangulComposer } from '../core/composer'
import { LAYOUTS, parseLayout } from '../core/layouts'
import { HangulEditor } from './editor'
import type { Edit } from './editor'

const DESCRIPTION = 'Turn Hangul (dubeolsik / sebeolsik 390 / sebeolsik final) input on or off. Args: on | off | 2 | 390 | final'

let editor: HangulEditor | undefined
let trace = false

function applyHangul(ed: HangulEditor, argRaw: string): { text: string; touchStatus: boolean } {
  const arg = argRaw.trim()
  const layout = parseLayout(arg)
  if (arg === '') ed.setOn(!ed.isOn)
  else if (arg === 'on') ed.setOn(true)
  else if (arg === 'off') ed.setOn(false)
  else if (layout !== undefined) {
    ed.setLayout(layout)
    ed.setOn(true)
  } else return { text: `unknown argument "${arg}" (on | off | 2 | 390 | final)`, touchStatus: false }
  // 화면에는 엔진이 `hangul: ` 을 앞에 붙인다. 여기서 또 붙이면 `hangul: hangul: on` 이 된다.
  return { text: ed.isOn ? `on (${ed.layout.name})` : 'off', touchStatus: true }
}

function editOf(e: PromptEditInput): Edit {
  return { text: e.text, cursor: e.cursor, start: e.start, end: e.end, inputText: e.inputText, key: e.key }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const wanted = await $.env.get('HANGUL_LAYOUT')
    const order = await $.env.get('HANGUL_SEBEOL_ORDER')
    trace = (await $.env.get('HANGUL_TRACE')) === '1'
    const layout = parseLayout(wanted === undefined || wanted === '' ? undefined : wanted) ?? LAYOUTS.dubeolsik
    // strict 만 libhangul 기본(역순 확정). 그 외·미설정은 SPEC 4.2 의 순서 무관.
    editor = new HangulEditor(new HangulComposer(layout, { autoReorder: order !== 'strict' }))
    $.ui.status(editor.status())
    await $.command.register({
      name: 'hangul',
      description: DESCRIPTION,
      argumentHint: '[on|off|2|390|final]',
      immediate: true,
    })
    return next(e)
  })

  on('command.run', { command: 'hangul' }, async ($, e) => {
    if (editor === undefined) return { text: 'not ready yet' }
    const answer = applyHangul(editor, e.args)
    if (answer.touchStatus) $.ui.status(editor.status())
    return { text: answer.text }
  })

  on('prompt.edit', async ($, e, next) => {
    if (trace) {
      $.ui.log(
        // keyField: 엔진이 key 를 빼는지(absent) null 로 주는지 가린다. 원격 키 묶음 처리가 이 값에 달렸다.
        `prompt.edit ${JSON.stringify({ keyField: !('key' in e) ? 'absent' : e.key === undefined ? 'undefined' : e.key === null ? 'null' : 'set', key: e.key ?? null, inputText: e.inputText, len: e.inputText.length, start: e.start, end: e.end, cursor: e.cursor, text: e.text })}`,
        { to: 'debug' },
      )
    }
    if (editor === undefined) return next(e)
    const answer = editor.edit(editOf(e))
    if (answer.kind === 'pass') {
      const edit = answer.edit
      return next(edit === undefined ? e : { ...e, text: edit.text, start: edit.start, end: edit.end, cursor: edit.cursor })
    }
    return answer.box
  })

  on('prompt.submit', async ($, e, next) => {
    if (trace) $.ui.log(`prompt.submit ${JSON.stringify({ origin: e.origin.kind, text: e.text })}`, { to: 'debug' })
    // 입력창에서 친 글만 확정한다. Remote Control(bridge)·SDK 등에서 온 글은 이 입력창의 조합과 무관하다.
    if (editor === undefined || e.origin.kind !== 'composer') return next(e)
    const text = editor.commitForSubmit(e.text)
    return next(text === e.text ? e : { ...e, text })
  })
}
