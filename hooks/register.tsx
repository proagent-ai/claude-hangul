// 한글 입력 mod 진입점. 구조는 claude-vime 의 hooks/register.tsx 를 따랐다.
//
// ⚠ 이 파일 전체가 [미검증]이다.
//   - API 모양(on 이벤트 이름, $.command.register, $.ui.status, $.env.get, 이벤트 인자)은 claude-vime 소스에서 옮겼고,
//     README 기준 Claude Code 2.1.288 의 초기(early access) API 이다. 이 박스의 claude CLI 는 2.1.278 이라 일치하지 않는다.
//   - 실제 Claude Code 세션에서 로드·실행해 본 적이 없다.
import type { Register } from 'claude-code'

import { HangulComposer } from '../core/composer'
import { LAYOUTS, parseLayout } from '../core/layouts'
import { HangulEditor } from './editor'

const DESCRIPTION = 'Turn Hangul (dubeolsik / sebeolsik 390 / sebeolsik final) input on or off. Args: on | off | 2 | 390 | final'

// 모듈 상태: session.start 에서 만들고 reload 때 새로 만든다(꺼진 상태).
let editor: HangulEditor | undefined

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    // 시작 레이아웃: 환경변수 HANGUL_LAYOUT (두벌식 2 / 390 / final). 없으면 두벌식.
    // [미검증] $.env.get 의 반환형(string | undefined)은 vime 의 사용에서 추정.
    const wanted = await $.env.get('HANGUL_LAYOUT')
    const layout = parseLayout(wanted === undefined || wanted === '' ? undefined : wanted) ?? LAYOUTS.dubeolsik
    editor = new HangulEditor(new HangulComposer(layout))
    // reload 직후 이전 상태줄이 남지 않게 지운다(vime 도 동일).
    $.ui.status(editor.status())
    await $.command.register({ name: 'hangul', description: DESCRIPTION, immediate: true })
    // TODO [미검증]: 한글 이름 슬래시 명령(/한글)이 허용되는지 모른다. 거부되면 예외를 삼키고 영문 /hangul 만 쓴다.
    try {
      await $.command.register({ name: '한글', description: DESCRIPTION, immediate: true })
    } catch {
      // 영문 별칭만 사용
    }
    return next(e)
  })

  // /hangul [on|off|2|390|final]
  // TODO [미검증]: command.run 이벤트에 args 문자열이 있다는 근거는 claude-vime 테스트의
  //   `$.command.run({ command, args: '', ... })` 호출뿐이다(핸들러 쪽에서 읽는 코드는 vime 에 없다).
  on('command.run', { command: 'hangul' }, async ($, e) => {
    if (editor === undefined) return { text: 'hangul: not ready yet' }
    const arg = (e as { args?: string }).args?.trim() ?? ''
    const layout = parseLayout(arg)
    if (arg === '') editor.setOn(!editor.isOn)
    else if (arg === 'on') editor.setOn(true)
    else if (arg === 'off') editor.setOn(false)
    else if (layout !== undefined) {
      editor.setLayout(layout)
      editor.setOn(true)
    } else return { text: `hangul: unknown argument "${arg}" (on | off | 2 | 390 | final)` }
    $.ui.status(editor.status())
    return { text: editor.isOn ? `hangul: on (${editor.layout.name})` : 'hangul: off' }
  })

  // 한글 별칭: 핸들러 로직은 위와 같다(on 의 정적 분석 제약 때문에 함수 공유 대신 복제; 미검증).
  on('command.run', { command: '한글' }, async ($, e) => {
    if (editor === undefined) return { text: 'hangul: not ready yet' }
    const arg = (e as { args?: string }).args?.trim() ?? ''
    const layout = parseLayout(arg)
    if (arg === '') editor.setOn(!editor.isOn)
    else if (arg === 'on') editor.setOn(true)
    else if (arg === 'off') editor.setOn(false)
    else if (layout !== undefined) {
      editor.setLayout(layout)
      editor.setOn(true)
    } else return { text: `hangul: unknown argument "${arg}" (on | off | 2 | 390 | final)` }
    $.ui.status(editor.status())
    return { text: editor.isOn ? `hangul: on (${editor.layout.name})` : 'hangul: off' }
  })

  // 입력창 키 가로채기. vime 과 같이 composer 가 box 를 돌려주면 키를 소비하고, pass 면 편집기에 맡긴다.
  on('prompt.edit', async ($, e, next) => {
    if (editor === undefined) return next(e)
    const answer = editor.edit(e)
    if (answer.kind === 'pass') {
      const edit = answer.edit
      return next(edit === undefined ? e : { ...e, text: edit.text, start: edit.start, end: edit.end, cursor: edit.cursor })
    }
    return answer.box
  })

  // Enter 가 prompt.edit 에 오지 않고 곧바로 전송될 때: 조합 상태를 정리한다.
  on('prompt.submit', async ($, e, next) => {
    if (editor === undefined) return next(e)
    const text = editor.commitForSubmit(e.text)
    return next(text === e.text ? e : { ...e, text })
  })
}
