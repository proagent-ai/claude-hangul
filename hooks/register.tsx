// 한글 입력 mod 진입점.
// 이벤트 이름·$.command.register·$.ui.status·$.env.get 는 이 환경의 Claude Code 2.1.289 가
// 생성한 .claude-plugin/types 와 맞춘다. 키 이벤트 본문의 실측은 SPEC 을 본다.
import type { EngineInterface, PromptEditInput, Register } from 'claude-code'

import { HangulComposer } from '../core/composer'
import { decide, init } from '../core/judge'
import type { Personal } from '../core/judge'
import { LAYOUTS, parseLayout } from '../core/layouts'
import { HangulEditor } from './editor'
import type { Edit } from './editor'
import { countPrompts, promptOf } from './learn'

const DESCRIPTION =
  'Turn Hangul (dubeolsik / sebeolsik 390 / sebeolsik final) input on or off. Args: on | off | 2 | 390 | final | learn | forget'
const LEARNED = 'learn.v1'
const MAX_READ = 4 * 1024 * 1024

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

/**
 * 이 맥의 대화 기록(<설정 폴더>/projects 아래 폴더별 .jsonl)에서 직접 친 한글 프롬프트를 세어 $.store 에 둔다.
 * 사용자 줄만 grep 으로 걸러 읽는다(파일 크기 제한 없음). grep 을 못 쓰면 4 MiB 이하 파일만 직접 읽는다.
 */
async function learn($: EngineInterface): Promise<string> {
  const config = (await $.env.get('CLAUDE_CONFIG_DIR')) || `${await $.env.get('HOME')}/.claude`
  const root = `${config}/projects`
  if (!(await $.fs.exists(root))) return `no transcripts under ${root}`
  const files: { path: string; size: number }[] = []
  for (const dir of await $.fs.list(root)) {
    if (dir.kind !== 'dir') continue
    for (const f of await $.fs.list(`${root}/${dir.name}`)) {
      if (f.kind === 'file' && f.name.endsWith('.jsonl')) files.push({ path: `${root}/${dir.name}/${f.name}`, size: f.size })
    }
  }
  const prompts: string[] = []
  let skipped = 0
  try {
    let rest = ''
    for await (const { stream, text } of $.process.spawn({ argv: ['grep', '-h', '"type":"user"', ...files.map(f => f.path)] })) {
      if (stream !== 'stdout') continue
      const lines = (rest + text).split('\n')
      rest = lines.pop() ?? ''
      for (const line of lines) {
        const t = promptOf(line)
        if (t !== undefined) prompts.push(t)
      }
    }
    const t = promptOf(rest)
    if (t !== undefined) prompts.push(t)
  } catch {
    prompts.length = 0
    for (const f of files) {
      if (f.size > MAX_READ) {
        skipped++
        continue
      }
      const text = await $.fs.read(f.path)
      for (const line of text.split('\n')) {
        const t = promptOf(line)
        if (t !== undefined) prompts.push(t)
      }
    }
  }
  const counted = countPrompts(prompts)
  await $.store.set(LEARNED, { eng: counted.eng, kor: counted.kor, prompts: counted.prompts, at: new Date().toISOString() })
  init(counted)
  const note = skipped > 0 ? `, ${skipped} large files skipped` : ''
  return `learned from ${counted.prompts} prompts in ${files.length} transcripts: ${counted.eng.length} English words, ${counted.kor.length} Korean words${note}`
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
    const learned = (await $.store.get(LEARNED)) as Personal | undefined
    init(learned ?? { eng: [], kor: [] })
    // 단어가 끝날 때 친 키가 영어로 더 그럴듯하면 키로 되돌린다(core/judge).
    const keepKeys = (id: typeof layout.id, keys: string, hangul: string) => decide(id, keys, hangul) === 'en'
    editor = new HangulEditor(new HangulComposer(layout, { autoReorder: order !== 'strict', keepKeys }))
    $.ui.status(editor.status())
    await $.command.register({
      name: 'hangul',
      description: DESCRIPTION,
      argumentHint: '[on|off|2|390|final|learn|forget]',
      immediate: true,
    })
    return next(e)
  })

  on('command.run', { command: 'hangul' }, async ($, e) => {
    if (editor === undefined) return { text: 'not ready yet' }
    const arg = e.args.trim()
    if (arg === 'learn') return { text: await learn($) }
    if (arg === 'forget') {
      await $.store.delete(LEARNED)
      init({ eng: [], kor: [] })
      return { text: 'forgot learned words' }
    }
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
