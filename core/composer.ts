// 한글 조합 상태머신. UI/Claude Code API에 의존하지 않는 순수 모듈.
//
// 설계 요약 (모든 규칙은 이 주석과 테스트가 근거):
//  * 조합 중인 음절 하나를 Syl{cho, jung, jong[]} 로 들고 있다. 확정된 글자는 commit 문자열로 내보낸다.
//  * 두벌식(kind 'dubeol'): 자음 키는 문맥으로 초성/종성이 결정된다.
//      - 받침이 있는 상태에서 모음이 오면 도깨비불: 마지막 받침 자모가 다음 음절 초성으로 넘어간다.
//        (겹받침이면 뒤 자모만 넘어간다. 시프트로 직접 친 ㄲ/ㅆ 받침은 한 덩어리로 넘어간다.)
//      - 받침이 될 수 없는 자음(ㄸ ㅃ ㅉ) 또는 결합 불가 자음은 현재 음절을 확정하고 새 음절을 연다.
//  * 세벌식(kind 'sebeol'): 키가 역할(초/중/종)을 고정한다. 도깨비불 없음.
//      - 기본(autoReorder true): 한 음절 안에서 초·중·종 입력 순서가 무관하다. 비어 있는 칸에 들어간다.
//        libhangul 의 option_auto_reorder 를 켠 것과 같다. libhangul 기본값(hangul_ic_new)은 false 라서,
//        기본 libhangul 은 중·종이 이미 있으면 빈 초성을 채우지 않고 확정한다. 순서 무관은 SPEC 4.2 의 설계 선택.
//      - autoReorder false: 그 기본 libhangul 처럼, 빈 초성인데 중/종이 있거나 빈 중성인데 종이 있으면 확정 후 새 음절.
//      - 이미 찬 칸에 같은 역할이 오면, 결합 규칙이 있으면 결합하고 없으면 확정 후 새 음절.
//      - 초성 겹치기는 중성·종성이 비어 있을 때만. 겹모음은 종성이 없고 앞 모음이 스택의 마지막일 때만(ㅗ→ㅏ).
//        모음끼리의 순서 무관은 없다. libhangul 도 peek 가 중성일 때만 겹모음을 합친다.
//  * 한 단어(공백·기호 전까지)가 완성 음절만이면 한글이다. 음절이 아닌 조각이 확정되면
//    그 단어 전체를 친 키로 되돌린다. 세벌식 hello 는 녀llo 가 아니라 hello.
//    공백·문장부호로 단어가 끝나면, 한글+낱자가 섞인 채로 두지 않고 키로 되돌린다.
//  * 숫자만인 단어는 숫자다. 기호(lit)는 기본으로 레이아웃 치환(390 J → 4)이고 단어의 일부다.
//    세벌식은 숫자·기호가 시프트 자리에만 있어서 치환하지 않으면 칠 방법이 없다.
//    단어가 음절이 아니게 되면 기호 키도 함께 친 키로 돌아간다. 390 Hello 는 'ello 가 아니라 Hello.
//    passthroughLiterals:true 면 기호 키는 친 문자 그대로 통과한다.
//  * 백스페이스는 열린 단어의 마지막 키를 지우고 다시 조합한다.
//  * 레이아웃에 없는 키(공백, 두벌식 숫자 등)는 consumed=false 로 돌려주고, 조합 중이던 글자는 확정시킨다.
import { CHO_COMBINE, composeSyllable, isCho, isJong, JONG_COMBINE, JUNG_COMBINE } from './jamo'
import type { KeyDef } from './keydef'
import type { Layout, LayoutId } from './layouts'

/** 조합 중 음절. jong 은 받침을 이루는 키 입력 자모들(최대 2개; 직접 겹받침 키는 1개짜리 합성 자모). */
interface Syl {
  readonly cho: string
  readonly jung: string
  readonly jong: readonly string[]
  /** 이 덩어리를 만든 원문 키. 음절이 아니면 화면에 이 문자열을 낸다. */
  readonly keys: string
}

const EMPTY: Syl = { cho: '', jung: '', jong: [], keys: '' }
const isEmpty = (s: Syl): boolean => s.cho === '' && s.jung === '' && s.jong.length === 0

/** 받침 자모 목록을 하나의 받침 문자로. 겹치지 않으면 undefined. */
function jongChar(parts: readonly string[]): string | undefined {
  if (parts.length === 0) return ''
  if (parts.length === 1) return parts[0]
  if (parts.length === 2) return JONG_COMBINE[parts[0]! + parts[1]!]
  return undefined
}

/**
 * 완성 음절이면 한글, 아니면 친 키 그대로.
 * 숫자만인 경우는 단어 단위로 replay 가 거른다. 음절 단위로 거르면 세벌식 큐(05)·쿠(09)가 숫자가 된다.
 */
function render(s: Syl): string {
  if (isEmpty(s)) return ''
  const t = jongChar(s.jong) ?? ''
  if (s.cho !== '' && s.jung !== '') {
    const syl = composeSyllable(s.cho, s.jung, t)
    if (syl !== undefined) return syl
  }
  return s.keys
}

interface Step {
  /** 이번 입력으로 확정된 글자(없으면 ''). */
  readonly commit: string
  readonly next: Syl
  /** 새 음절이 열렸을 때 백스페이스 기록의 시작값(기본 [EMPTY]). */
  readonly seed?: readonly Syl[]
}

/** 두벌식 자음. */
function dubeolConsonant(s: Syl, c: string, key: string): Step {
  if (isEmpty(s)) return { commit: '', next: { ...EMPTY, cho: c, keys: key } }
  // 초성만 있거나(ㄱㄱ은 합치지 않음) 모음만 있으면 확정하고 새 음절.
  if (s.jung === '' || s.cho === '') return { commit: render(s), next: { ...EMPTY, cho: c, keys: key } }
  if (s.jong.length === 0) {
    if (isJong(c)) return { commit: '', next: { ...s, jong: [c], keys: s.keys + key } }
    return { commit: render(s), next: { ...EMPTY, cho: c, keys: key } }
  }
  if (s.jong.length === 1 && JONG_COMBINE[s.jong[0]! + c] !== undefined) {
    return { commit: '', next: { ...s, jong: [s.jong[0]!, c], keys: s.keys + key } }
  }
  return { commit: render(s), next: { ...EMPTY, cho: c, keys: key } }
}

/** 모음(두벌식·세벌식 공통의 중성 처리 중 "받침 없음/겹모음" 부분). 처리 불가면 undefined. */
function tryJung(s: Syl, v: string): Syl | undefined {
  if (s.jung === '') return { ...s, jung: v }
  if (s.jong.length === 0) {
    const combined = JUNG_COMBINE[s.jung + v]
    if (combined !== undefined) return { ...s, jung: combined }
  }
  return undefined
}

function dubeolVowel(s: Syl, v: string, key: string): Step {
  if (s.jong.length > 0) {
    // 도깨비불: 마지막 받침 자모가 다음 음절의 초성이 된다.
    // libhangul hangul_ic_process_jamo: 종성 뒤 중성이면 pop. peek 가 종성이면
    // hangul_jongseong_get_diff 로 뒤 자모만 초성으로 넘기고, 아니면 종성 전체를 초성으로 넘긴다.
    // ㄱ+ㄱ→ㄲ 는 diff 가 ㄱ을 넘긴다(낚+ㅣ→낙기). 시프트로 한 번에 넣은 ㅆ/ㄲ 는 스택에 한 덩어리라 통째로 넘어간다.
    const moved = s.jong[s.jong.length - 1]!
    const movedKey = s.keys.slice(-1)
    const stay: Syl = { ...s, jong: s.jong.slice(0, -1), keys: s.keys.slice(0, -1) }
    const first: Syl = { ...EMPTY, cho: moved, keys: movedKey }
    return { commit: render(stay), next: { ...first, jung: v, keys: movedKey + key }, seed: [EMPTY, first] }
  }
  const joined = tryJung(s, v)
  if (joined !== undefined) return { commit: '', next: { ...joined, keys: s.keys + key } }
  return { commit: render(s), next: { ...EMPTY, jung: v, keys: key } }
}

function sebeolCho(s: Syl, c: string, key: string, autoReorder: boolean): Step {
  if (s.cho === '') {
    // libhangul process_jaso, auto_reorder 꺼짐: 중성이나 종성이 이미 있으면 빈 초성을 채우지 않고 확정한다.
    if (!autoReorder && (s.jung !== '' || s.jong.length > 0)) return { commit: render(s), next: { ...EMPTY, cho: c, keys: key } }
    return { commit: '', next: { ...s, cho: c, keys: s.keys + key } }
  }
  if (s.jung === '' && s.jong.length === 0) {
    const combined = CHO_COMBINE[s.cho + c]
    if (combined !== undefined) return { commit: '', next: { ...s, cho: combined, keys: s.keys + key } }
  }
  return { commit: render(s), next: { ...EMPTY, cho: c, keys: key } }
}

function sebeolJung(s: Syl, v: string, key: string, autoReorder: boolean): Step {
  // libhangul process_jaso, auto_reorder 꺼짐: 종성이 있으면 빈 중성을 채우지 않고 확정한다.
  if (!autoReorder && s.jung === '' && s.jong.length > 0) return { commit: render(s), next: { ...EMPTY, jung: v, keys: key } }
  const joined = tryJung(s, v)
  if (joined !== undefined) return { commit: '', next: { ...joined, keys: s.keys + key } }
  return { commit: render(s), next: { ...EMPTY, jung: v, keys: key } }
}

function sebeolJong(s: Syl, t: string, key: string): Step {
  if (s.jong.length === 0) return { commit: '', next: { ...s, jong: [t], keys: s.keys + key } }
  if (s.jong.length === 1 && JONG_COMBINE[s.jong[0]! + t] !== undefined) {
    return { commit: '', next: { ...s, jong: [s.jong[0]!, t], keys: s.keys + key } }
  }
  return { commit: render(s), next: { ...EMPTY, jong: [t], keys: key } }
}

export interface FeedResult {
  /** 키를 조합기가 처리했는가. false 면 호출자가 원래 키를 그대로 통과시켜야 한다(commit 은 먼저 삽입). */
  readonly consumed: boolean
  /** 이번 입력으로 확정되어 preedit 앞에 들어갈 글자. */
  readonly commit: string
  /** 현재 조합 중인 글자('' 이면 없음). */
  readonly preedit: string
}

export interface ComposerOptions {
  /**
   * 레이아웃 기호 키(lit)를 친 문자 그대로 통과시킬지. 기본 false: 세벌식 표의 치환(`<`→`2`, 최종 `?`→`!`)을 적용한다.
   * true 면 `<` `?` 같은 키는 친 문자 그대로.
   */
  readonly passthroughLiterals?: boolean
  /**
   * 세벌식에서 빈 초·중·종 칸을 입력 순서와 무관하게 채울지. 기본 true (SPEC 4.2).
   * false 는 libhangul 기본(option_auto_reorder = false)과 같이 역순이면 확정한다.
   */
  readonly autoReorder?: boolean
  /**
   * 단어가 끝났을 때(완성 음절만이라 한글로 남을 단어) 친 키로 되돌릴지 묻는다. true 면 친 키.
   * 없으면 지금처럼 완성 음절이면 한글. register 는 core/judge 의 decide 를 넣는다.
   */
  readonly keepKeys?: (layout: LayoutId, keys: string, hangul: string) => boolean
}

/** 반복해서 자모만으로 쓰는 말(ㅋㅋ ㅎㅎ ㅠㅠ ㄷㄷ …)에 쓰이는 자모와, 흔한 자모 줄임말. */
const REPEATABLE_JAMO = new Set('ㅋㅎㅠㅜㄷㅇㄴㄱㅂㅅㅈㅊ')
const JAMO_ABBREVIATIONS = new Set(['ㅇㅋ', 'ㅊㅋ', 'ㅅㄱ', 'ㄱㅅ', 'ㅈㅅ', 'ㅎㅇ', 'ㅂㅇ', 'ㄹㅇ', 'ㅇㅈ'])

function isHangulRun(text: string): boolean {
  if (text === '') return true
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0
    if (code < 0xac00 || code > 0xd7a3) return false
  }
  return true
}

export class HangulComposer {
  /** 공백·문장부호 전까지의 원문 키. 화면은 이 키를 다시 조합해 만든다. */
  private wordKeys = ''

  constructor(
    private layout: Layout,
    private readonly options: ComposerOptions = {},
  ) {}

  getLayout(): Layout {
    return this.layout
  }

  /** 레이아웃을 바꾼다. 조합 중이던 글자는 확정 문자열로 돌려준다. */
  setLayout(layout: Layout): string {
    const committed = this.flush()
    this.layout = layout
    return committed
  }

  preedit(): string {
    return this.wordKeys === '' ? '' : this.replay(this.wordKeys, false)
  }

  isComposing(): boolean {
    return this.wordKeys !== ''
  }

  /** 조합 중인 단어를 확정하고 상태를 비운다. 한글이 아닌 단어는 친 키로 되돌린다. */
  flush(): string {
    const out = this.wordKeys === '' ? '' : this.replay(this.wordKeys, true)
    this.wordKeys = ''
    return out
  }

  /** 조합을 버린다(확정하지 않음). */
  reset(): void {
    this.wordKeys = ''
  }

  /**
   * 단어를 다시 조합한다.
   * closing 이면 단어가 끝난 것. 완성 음절만 아니면 친 키를 돌려준다.
   */
  private replay(keys: string, closing: boolean): string {
    // ㅋㅋ·ㅠㅠ 처럼 자모만으로 쓰는 말은 단어가 끝날 때 자모로 낸다. 세벌식 ㅋㅋ 는 숫자 키(00)라 숫자 규칙보다 먼저 본다.
    if (closing) {
      const jamo = this.jamoWord(keys)
      if (jamo !== undefined && this.options.keepKeys?.(this.layout.id, keys, jamo) !== true) return jamo
    }
    if (/^\d+$/.test(keys)) return keys
    let syl: Syl = EMPTY
    let text = ''
    let latin = false
    const reorder = this.options.autoReorder !== false
    for (const ch of keys) {
      const def = this.layout.map[ch]
      if (def === undefined) continue
      if (def.role === 'lit') {
        // 기호는 조합 중이던 음절을 닫고 그 자리에 치환 문자를 낸다. 닫힌 조각이 음절이 아니면 단어 전체가 키.
        const pending = render(syl)
        if (!isHangulRun(pending)) latin = true
        text += pending + def.text
        syl = EMPTY
        continue
      }
      const step = this.step(syl, def, ch, reorder)
      if (step.commit !== '' && !isHangulRun(step.commit)) latin = true
      if (!latin) text += step.commit
      syl = step.next
    }
    if (latin) return keys
    const tail = render(syl)
    if (closing && !isHangulRun(tail)) return keys
    const word = text + tail
    if (closing && word !== keys && this.options.keepKeys?.(this.layout.id, keys, word) === true) return keys
    return word
  }

  /** keys 가 자모만인 말(같은 자모 반복, 흔한 줄임말)이면 그 자모 문자열. 받침 키·기호 키가 섞이면 아니다. */
  private jamoWord(keys: string): string | undefined {
    if (keys.length < 2) return undefined
    let out = ''
    for (const ch of keys) {
      const def = this.layout.map[ch]
      if (def === undefined || def.role === 'lit' || def.role === 'jong') return undefined
      out += def.jamo
    }
    const repeated = REPEATABLE_JAMO.has(out[0]!) && [...out].every(j => j === out[0])
    return repeated || JAMO_ABBREVIATIONS.has(out) ? out : undefined
  }

  private step(syl: Syl, def: Exclude<KeyDef, { role: 'lit' }>, ch: string, reorder: boolean): Step {
    const jamo = def.jamo
    if (this.layout.kind === 'dubeol') {
      if (def.role === 'jung') return dubeolVowel(syl, jamo, ch)
      if (!isCho(jamo)) return { commit: render(syl), next: EMPTY }
      return dubeolConsonant(syl, jamo, ch)
    }
    if (def.role === 'cho') return sebeolCho(syl, jamo, ch, reorder)
    if (def.role === 'jung') return sebeolJung(syl, jamo, ch, reorder)
    return sebeolJong(syl, jamo, ch)
  }

  /** 문자 하나(키보드가 만든 ASCII 문자, 시프트 반영)를 넣는다. */
  feed(ch: string): FeedResult {
    const def: KeyDef | undefined = this.layout.map[ch]
    const passLit = def?.role === 'lit' && this.options.passthroughLiterals === true
    if (def === undefined || passLit) {
      const commit = this.flush()
      return { consumed: false, commit, preedit: '' }
    }
    this.wordKeys += ch
    // commit 은 비운다. 단어 전체가 preedit 이라, 녀llo 처럼 섞이면 앞의 녀 까지 원문으로 바꿀 수 있다.
    return { consumed: true, commit: '', preedit: this.replay(this.wordKeys, false) }
  }

  /**
   * 백스페이스. 열린 단어가 있으면 마지막 키를 지우고 consumed=true.
   * 단어가 없으면 consumed=false (호출자가 편집기에 그대로 넘긴다).
   */
  backspace(): { consumed: boolean; preedit: string } {
    if (this.wordKeys === '') return { consumed: false, preedit: '' }
    this.wordKeys = this.wordKeys.slice(0, -1)
    return { consumed: true, preedit: this.preedit() }
  }

  /** 편의 함수: 문자열을 한 키씩 넣고 (확정 + 조합중) 전체를 돌려준다. 테스트·디버깅용. */
  typeAll(keys: string): string {
    let out = ''
    for (const k of keys) {
      const r = this.feed(k)
      out += r.commit
      if (!r.consumed) out += k
    }
    return out + this.preedit()
  }
}
