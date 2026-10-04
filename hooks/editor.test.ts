import { describe, expect, test } from 'claude-code/testing'

import { HangulComposer } from '../core/composer'
import { LAYOUTS } from '../core/layouts'
import type { LayoutId } from '../core/layouts'
import { HangulEditor } from './editor'
import type { Answer, Edit, KeyEvent } from './editor'

// 입력창을 흉내 낸다: 어댑터가 box 를 돌려주면 그대로 채택하고, pass 면 편집기가 평소처럼 splice 한다.
// [미검증] 이 모델(키 이벤트 모양, backspace 가 start=cursor-1..end=cursor 로 오는 것)은 claude-vime 테스트 하네스를 따른 것.
class Box {
  text = ''
  cursor = 0
  decorations: unknown[] = []
  constructor(readonly editor: HangulEditor) {}

  edit(edit: Omit<Edit, 'text' | 'cursor'>): Answer {
    const full: Edit = { ...edit, text: this.text, cursor: this.cursor }
    const answer = this.editor.edit(full)
    if (answer.kind === 'box') {
      this.text = answer.box.text
      this.cursor = answer.box.cursor
      this.decorations = answer.box.decorations
    } else {
      const e = answer.edit ?? full
      this.text = e.text.slice(0, e.start) + e.inputText + e.text.slice(e.end)
      this.cursor = e.start + e.inputText.length
      this.decorations = []
    }
    return answer
  }
  type(chars: string) {
    for (const ch of chars) this.edit({ start: this.cursor, end: this.cursor, inputText: ch, key: { key: ch === ' ' ? 'space' : ch } })
  }
  backspace() {
    this.edit({ start: this.cursor - 1, end: this.cursor, inputText: '', key: { key: 'backspace' } })
  }
  paste(text: string) {
    this.edit({ start: this.cursor, end: this.cursor, inputText: text })
  }
  press(key: KeyEvent) {
    this.edit({ start: this.cursor, end: this.cursor, inputText: '', key })
  }
}

const newBox = (id: LayoutId = 'dubeolsik', on = true) => {
  const editor = new HangulEditor(new HangulComposer(LAYOUTS[id]))
  editor.setOn(on)
  return new Box(editor)
}

describe('HangulEditor (prompt.edit 어댑터)', () => {
  test('꺼져 있으면 입력을 건드리지 않는다', () => {
    const b = newBox('dubeolsik', false)
    b.type('gks')
    expect(b.text).toBe('gks')
  })

  test('두벌식 gksrmf → 한글. 열린 단어 전체에 밑줄', () => {
    const b = newBox()
    b.type('gksrmf')
    expect(b.text).toBe('한글')
    expect(b.cursor).toBe(2)
    expect(b.decorations).toEqual([{ start: 0, end: 2, underline: true }])
  })

  test('공백으로 확정되고 다음 단어가 이어진다', () => {
    const b = newBox()
    b.type('gks gks')
    expect(b.text).toBe('한 한')
    expect(b.decorations).toEqual([{ start: 2, end: 3, underline: true }])
  })

  test('백스페이스는 열린 단어의 키를 되돌리고, 단어가 비면 멈춘다', () => {
    const b = newBox()
    b.type('gksrmf')
    b.backspace()
    expect(b.text).toBe('한그')
    b.backspace()
    expect(b.text).toBe('한r')
    b.backspace()
    expect(b.text).toBe('한')
    b.backspace()
    expect(b.text).toBe('하')
    b.backspace()
    expect(b.text).toBe('g')
    b.backspace()
    expect(b.text).toBe('')
  })

  test('도깨비불: 입력창에서도 갈 + ㅏ → 가라', () => {
    const b = newBox()
    b.type('rkfk')
    expect(b.text).toBe('가라')
    expect(b.cursor).toBe(2)
  })

  test('세벌식 390: hello? 와 390 은 영어·숫자·기호 그대로', () => {
    const b = newBox('sebeolsik-390')
    b.type('hello? 390')
    expect(b.text).toBe('hello? 390')
    expect(b.decorations).toEqual([{ start: 7, end: 10, underline: true }])
  })

  test('세벌식 390: mfskgw → 한글', () => {
    const b = newBox('sebeolsik-390')
    b.type('mfskgw')
    expect(b.text).toBe('한글')
  })

  test('세벌식 최종: 슬래시 명령 이름은 그대로 입력된다 (/ 는 ㅗ 이지만 맨 앞이면 통과)', () => {
    const b = newBox('sebeolsik-final')
    b.type('/hangul')
    expect(b.text).toBe('/hangul')
  })

  test('다른 슬래시 명령은 이름 뒤 공백부터 다시 한글', () => {
    const b = newBox()
    b.type('/compact gks')
    expect(b.text).toBe('/compact 한')
  })

  test('/hangul 인자는 영어 그대로라 off 와 390 을 칠 수 있다', () => {
    const dubeol = newBox()
    dubeol.type('/hangul off')
    expect(dubeol.text).toBe('/hangul off')
    const sebeol = newBox('sebeolsik-390')
    sebeol.type('/hangul 390')
    expect(sebeol.text).toBe('/hangul 390')
    const final = newBox('sebeolsik-final')
    final.type('/hangul final')
    expect(final.text).toBe('/hangul final')
  })

  test('문장 중간의 / 는 레이아웃을 따른다 (세벌식: ㅗ)', () => {
    const b = newBox('sebeolsik-390')
    b.type('j/f')
    expect(b.text).toBe('와')
  })

  test('붙여넣기(여러 글자·키 없음)는 변환하지 않고 확정 후 원문 그대로', () => {
    const b = newBox()
    b.type('gks')
    b.paste('hello')
    expect(b.text).toBe('한hello')
    expect(b.decorations).toEqual([])
  })

  test('ctrl 조합은 조합 글자를 확정하고 통과', () => {
    const b = newBox()
    b.type('gks')
    b.press({ key: 'a', ctrl: true })
    b.type('k')
    expect(b.text).toBe('한k')
  })

  test('커서가 조합 구간 밖에서 입력되면 기존 조합은 확정하고 새 조합을 시작', () => {
    const b = newBox()
    b.type('gks')
    b.cursor = 0
    b.type('k')
    // 'k' 는 한글 규칙으로 새로 조합된다: 한 앞에 ㅏ
    expect(b.text).toBe('k한')
  })

  test('밖에서 입력창이 비워지면 조합 상태를 버리고 새로 시작', () => {
    const b = newBox()
    b.type('gks')
    b.text = ''
    b.cursor = 0
    b.type('k')
    expect(b.text).toBe('k')
  })

  test('끄면 조합 중이던 글자는 그대로 남고 이후 입력은 원문', () => {
    const b = newBox()
    b.type('gks')
    b.editor.setOn(false)
    b.type('gks')
    expect(b.text).toBe('한gks')
  })

  test('상태줄: 켜짐 한 + 레이아웃 이름, 꺼짐 undefined', () => {
    const b = newBox('sebeolsik-final')
    expect(b.editor.status()).toBe('한 세벌식 최종')
    b.editor.setOn(false)
    expect(b.editor.status()).toBeUndefined()
  })

  test('return 키는 조합을 확정하고 편집기에 넘긴다', () => {
    const b = newBox()
    b.type('gks')
    b.press({ key: 'return' })
    expect(b.text).toBe('한')
    expect(b.decorations).toEqual([])
  })

  test('선택영역 치환은 확정 후 원문 그대로', () => {
    const b = newBox()
    b.type('gks')
    b.edit({ start: 0, end: 1, inputText: 'x' })
    expect(b.text).toBe('x')
    expect(b.decorations).toEqual([])
  })

  test('meta 조합은 확정하고 통과', () => {
    const b = newBox()
    b.type('gks')
    b.press({ key: 'left', meta: true })
    expect(b.text).toBe('한')
    expect(b.decorations).toEqual([])
  })

  test('세벌식 최종에서 문장 중간의 / 는 ㅗ', () => {
    const b = newBox('sebeolsik-final')
    b.type('j/f')
    expect(b.text).toBe('와')
  })

  test('조합 끝이 아닌 백스페이스는 자모 해체를 하지 않고 확정한다', () => {
    const b = newBox()
    b.type('gks')
    b.edit({ start: 0, end: 0, inputText: '', key: { key: 'backspace' } })
    expect(b.text).toBe('한')
    expect(b.decorations).toEqual([])
  })

  test('레이아웃 전환은 조합 상태를 비운다', () => {
    const b = newBox()
    b.type('gks')
    b.editor.setLayout(LAYOUTS['sebeolsik-390'])
    b.type('mfs')
    expect(b.text).toBe('한한')
  })
})
