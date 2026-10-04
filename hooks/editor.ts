// prompt.edit 한 번의 입력을 한글 조합기(core)에 연결하는 어댑터.
// Claude Code API에 대한 "런타임 의존"은 없다(타입 모양만 claude-vime 의 hooks/editor.ts 를 따라 로컬 정의).
//
// Edit 필드는 Claude Code 2.1.289 생성 타입 PromptEditInput 의 부분집합이다.
// 2026-10-04 세션에서 한 글자 키는 {key, inputText, start, end, cursor, text} 로 왔다.
// TODO [미검증]: 한영·Caps Lock·Globe 키. 그 세션의 tmux 로는 한영 키 이벤트를 넣지 못했다.
import { HangulComposer } from '../core/composer'
import type { Layout } from '../core/layouts'

export type KeyEvent = { key: string; ctrl?: true; shift?: true; meta?: true }

/** prompt.edit 이 주는 한 번의 편집: 편집 전 입력창 + 치환 구간. (claude-vime 의 Edit 와 같은 모양) */
export type Edit = { text: string; cursor: number; start: number; end: number; inputText: string; key?: KeyEvent }

export type Decoration = { start: number; end: number; underline: true; bold?: true; backgroundColor?: string }
export type BoxAnswer = { text: string; cursor: number; decorations: Decoration[] }
/** box: 우리가 입력창을 직접 정해 돌려줌(키 소비). pass: 편집기가 평소처럼 처리(edit 가 있으면 그 내용으로). */
export type Answer = { kind: 'box'; box: BoxAnswer } | { kind: 'pass'; edit?: Edit }

// 맨 앞에서 슬래시 명령 이름을 치는 중이면 그대로 통과시킨다. 세벌식에서 '/' 는 ㅗ 이므로 필수.
// 다른 명령은 이름 뒤 공백부터 다시 한글. /hangul 만은 인자(on off 2 390 final)까지 영어 그대로.
const isSlashCommandName = (head: string) => /^\/\S*$/.test(head)
const isHangulCommand = (head: string) => /^\/hangul(?:\s+\S*)?$/.test(head)

/** 조합기에 넘길 단일 인쇄 가능 ASCII 문자. 공백은 레이아웃에 없으므로 통과 키가 된다. */
const SINGLE_KEY = /^[\x20-\x7e]$/

export class HangulEditor {
  private on = false
  /** 입력창 안에서 조합 중인 글자의 시작 위치. */
  private anchor = 0
  /** 입력창에 현재 표시된 조합 중 글자('' 이면 조합 없음). */
  private shown = ''

  constructor(private readonly composer: HangulComposer) {}

  get isOn(): boolean {
    return this.on
  }

  get layout(): Layout {
    return this.composer.getLayout()
  }

  /** 켜고 끈다. 끄면 조합 중인 글자는 입력창에 그대로 남는다(확정). */
  setOn(on: boolean): void {
    if (this.on && !on) this.commit()
    this.on = on
  }

  setLayout(layout: Layout): void {
    this.composer.setLayout(layout)
    this.shown = ''
  }

  /** 상태줄 문자열. 꺼져 있으면 undefined. */
  status(): string | undefined {
    if (!this.on) return undefined
    return `한 ${this.composer.getLayout().name}`
  }

  /** 조합 중인 글자를 확정(입력창 텍스트는 이미 그 글자를 담고 있으므로 상태만 비운다). */
  commit(): void {
    this.composer.flush()
    this.shown = ''
  }

  /** 전송 직전. 열린 단어가 한글이 아니면 친 키로 되돌린다. */
  commitForSubmit(sent: string): string {
    return this.seal(sent)
  }

  edit(e: Edit): Answer {
    if (!this.on) return { kind: 'pass' }

    // 입력창이 밖에서 바뀌어(비우기·전송·vim 노멀 모드 편집 등) 조합 글자가 사라졌으면 처음부터.
    if (this.shown !== '' && e.text.slice(this.anchor, this.anchor + this.shown.length) !== this.shown) {
      this.composer.reset()
      this.shown = ''
    }
    let composing = this.shown !== ''
    const runEnd = this.anchor + this.shown.length

    // ctrl/meta 조합(ctrl+a, option+←, ctrl+k …)은 건드리지 않는다: 확정하고 통과.
    if (e.key?.ctrl === true || e.key?.meta === true) return this.commitAndPass(e)

    if (e.key?.key === 'backspace') {
      // 조합 구간의 마지막 글자를 지우는 백스페이스만 자모 단위로 처리.
      if (composing && e.start === e.end - 1 && e.end === runEnd) {
        const r = this.composer.backspace()
        if (r.consumed) return this.render(e.text, '', r.preedit)
      }
      return this.commitAndPass(e)
    }

    // 한 글자 입력만 조합 대상. 붙여넣기·여러 글자·선택영역 치환은 확정 후 원문 그대로 통과.
    const isSingle = e.start === e.end && SINGLE_KEY.test(e.inputText)
    if (!isSingle) return this.commitAndPass(e)

    if (composing && e.start !== runEnd) {
      // 조합 구간 끝이 아닌 곳에서 입력: 기존 조합은 확정하고, 이 키는 새 조합의 시작으로 처리한다.
      this.commit()
      composing = false
    }
    const head = e.text.slice(0, e.start) + e.inputText
    if (isSlashCommandName(head) || isHangulCommand(head)) {
      if (composing) this.commit()
      return { kind: 'pass' }
    }

    const r = this.composer.feed(e.inputText)
    if (!r.consumed) return this.passBoundary(e, r.commit)
    if (!composing) this.anchor = e.start
    return this.render(e.text, r.commit, r.preedit)
  }

  /** 조합 구간을 (commit + preedit) 으로 바꾼 입력창을 돌려준다. */
  private render(text: string, commit: string, preedit: string): Answer {
    const before = text.slice(0, this.anchor)
    const after = text.slice(this.anchor + this.shown.length)
    this.anchor += commit.length
    this.shown = preedit
    const next = before + commit + preedit + after
    const cursor = this.anchor + preedit.length
    const decorations: Decoration[] = preedit === '' ? [] : [{ start: this.anchor, end: cursor, underline: true }]
    return { kind: 'box', box: { text: next, cursor, decorations } }
  }

  /** 공백·숫자·특수문자. 열린 단어를 확정(한글이 아니면 원문)한 뒤 그 글자를 넣는다. */
  private passBoundary(e: Edit, closed: string): Answer {
    const shift = closed.length - this.shown.length
    const before = e.text.slice(0, this.anchor)
    const after = e.text.slice(this.anchor + this.shown.length)
    this.shown = ''
    const text = before + closed + after
    return {
      kind: 'pass',
      edit: { ...e, text, start: e.start + shift, end: e.end + shift, cursor: e.cursor + shift },
    }
  }

  /** 열린 단어를 sent 안에서 확정한다. 화면의 조합과 확정문이 같으면 글자를 그대로 둔다. */
  private seal(sent: string): string {
    const closed = this.composer.flush()
    if (this.shown === '' || closed === this.shown) {
      this.shown = ''
      return sent
    }
    const before = sent.slice(0, this.anchor)
    const after = sent.slice(this.anchor + this.shown.length)
    this.shown = ''
    return before + closed + after
  }

  private commitAndPass(e: Edit): Answer {
    const text = this.seal(e.text)
    const shift = text.length - e.text.length
    return {
      kind: 'pass',
      edit: { ...e, text, start: e.start + shift, end: e.end + shift, cursor: e.cursor + shift },
    }
  }
}
