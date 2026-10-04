// 한글 조합 상태머신. UI/Claude Code API에 의존하지 않는 순수 모듈.
//
// 설계 요약 (모든 규칙은 이 주석과 테스트가 근거):
//  * 조합 중인 음절 하나를 Syl{cho, jung, jong[]} 로 들고 있다. 확정된 글자는 commit 문자열로 내보낸다.
//  * 두벌식(kind 'dubeol'): 자음 키는 문맥으로 초성/종성이 결정된다.
//      - 받침이 있는 상태에서 모음이 오면 도깨비불: 마지막 받침 자모가 다음 음절 초성으로 넘어간다.
//        (겹받침이면 뒤 자모만 넘어간다. 시프트로 직접 친 ㄲ/ㅆ 받침은 한 덩어리로 넘어간다.)
//      - 받침이 될 수 없는 자음(ㄸ ㅃ ㅉ) 또는 결합 불가 자음은 현재 음절을 확정하고 새 음절을 연다.
//  * 세벌식(kind 'sebeol'): 키가 역할(초/중/종)을 고정한다. 도깨비불 없음.
//      - 한 음절 안에서는 초·중·종 입력 순서가 무관하다(모아치기식). 비어 있는 칸에 들어간다.
//      - 이미 찬 칸에 같은 역할이 오면, 결합 규칙(쌍자음/겹모음/겹받침)이 있으면 결합하고 없으면 확정 후 새 음절.
//      - 초성 겹치기는 중성·종성이 비어 있을 때만. 겹모음은 종성이 비어 있을 때만, 앞 모음이 먼저여야 한다(ㅗ→ㅏ).
//        (모음끼리의 순서 무관은 지원하지 않는다: 이것은 이 프로토타입의 설계 선택이며 실제 세벌식 IME와의 대조는 미확인.)
//  * 백스페이스는 조합 중인 음절 안에서 입력 이전 상태로 되돌린다(자모 단위 해체). 이미 확정된 글자는 건드리지 않는다.
//  * 레이아웃에 없는 키(공백, 숫자 등)는 consumed=false 로 돌려주고, 조합 중이던 글자는 확정시킨다.
import { CHO_COMBINE, composeSyllable, isCho, isJong, JONG_COMBINE, JUNG_COMBINE } from './jamo'
import type { KeyDef } from './keydef'
import type { Layout } from './layouts'

/** 조합 중 음절. jong 은 받침을 이루는 키 입력 자모들(최대 2개; 직접 겹받침 키는 1개짜리 합성 자모). */
interface Syl {
  readonly cho: string
  readonly jung: string
  readonly jong: readonly string[]
}

const EMPTY: Syl = { cho: '', jung: '', jong: [] }
const isEmpty = (s: Syl): boolean => s.cho === '' && s.jung === '' && s.jong.length === 0

/** 받침 자모 목록을 하나의 받침 문자로. 겹치지 않으면 undefined. */
function jongChar(parts: readonly string[]): string | undefined {
  if (parts.length === 0) return ''
  if (parts.length === 1) return parts[0]
  if (parts.length === 2) return JONG_COMBINE[parts[0]! + parts[1]!]
  return undefined
}

/** 음절 상태를 화면 문자열로. 초+중이 있으면 완성 음절, 아니면 호환 자모를 나열한다. */
function render(s: Syl): string {
  const t = jongChar(s.jong) ?? ''
  if (s.cho !== '' && s.jung !== '') {
    const syl = composeSyllable(s.cho, s.jung, t)
    if (syl !== undefined) return syl
  }
  return s.cho + s.jung + t
}

interface Step {
  /** 이번 입력으로 확정된 글자(없으면 ''). */
  readonly commit: string
  readonly next: Syl
  /** 새 음절이 열렸을 때 백스페이스 기록의 시작값(기본 [EMPTY]). */
  readonly seed?: readonly Syl[]
}

/** 두벌식 자음. */
function dubeolConsonant(s: Syl, c: string): Step {
  if (isEmpty(s)) return { commit: '', next: { ...EMPTY, cho: c } }
  // 초성만 있거나(ㄱㄱ은 합치지 않음) 모음만 있으면 확정하고 새 음절.
  if (s.jung === '' || s.cho === '') return { commit: render(s), next: { ...EMPTY, cho: c } }
  if (s.jong.length === 0) {
    if (isJong(c)) return { commit: '', next: { ...s, jong: [c] } }
    return { commit: render(s), next: { ...EMPTY, cho: c } }
  }
  if (s.jong.length === 1 && JONG_COMBINE[s.jong[0]! + c] !== undefined) {
    return { commit: '', next: { ...s, jong: [s.jong[0]!, c] } }
  }
  return { commit: render(s), next: { ...EMPTY, cho: c } }
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

function dubeolVowel(s: Syl, v: string): Step {
  if (s.jong.length > 0) {
    // 도깨비불: 마지막 받침 자모가 다음 음절의 초성이 된다.
    const moved = s.jong[s.jong.length - 1]!
    const stay: Syl = { ...s, jong: s.jong.slice(0, -1) }
    const first: Syl = { ...EMPTY, cho: moved }
    return { commit: render(stay), next: { ...first, jung: v }, seed: [EMPTY, first] }
  }
  const joined = tryJung(s, v)
  if (joined !== undefined) return { commit: '', next: joined }
  return { commit: render(s), next: { ...EMPTY, jung: v } }
}

function sebeolCho(s: Syl, c: string): Step {
  if (s.cho === '') return { commit: '', next: { ...s, cho: c } }
  if (s.jung === '' && s.jong.length === 0) {
    const combined = CHO_COMBINE[s.cho + c]
    if (combined !== undefined) return { commit: '', next: { ...s, cho: combined } }
  }
  return { commit: render(s), next: { ...EMPTY, cho: c } }
}

function sebeolJung(s: Syl, v: string): Step {
  const joined = tryJung(s, v)
  if (joined !== undefined) return { commit: '', next: joined }
  return { commit: render(s), next: { ...EMPTY, jung: v } }
}

function sebeolJong(s: Syl, t: string): Step {
  if (s.jong.length === 0) return { commit: '', next: { ...s, jong: [t] } }
  if (s.jong.length === 1 && JONG_COMBINE[s.jong[0]! + t] !== undefined) {
    return { commit: '', next: { ...s, jong: [s.jong[0]!, t] } }
  }
  return { commit: render(s), next: { ...EMPTY, jong: [t] } }
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
  /** true 면 레이아웃의 기호/숫자 치환(lit)을 무시하고 원래 문자를 통과시킨다. 기본 false. */
  readonly passthroughLiterals?: boolean
}

export class HangulComposer {
  private syl: Syl = EMPTY
  private history: Syl[] = []

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
    return render(this.syl)
  }

  isComposing(): boolean {
    return !isEmpty(this.syl)
  }

  /** 조합 중인 글자를 확정하고 상태를 비운다. */
  flush(): string {
    const out = render(this.syl)
    this.syl = EMPTY
    this.history = []
    return out
  }

  /** 조합을 버린다(확정하지 않음). */
  reset(): void {
    this.syl = EMPTY
    this.history = []
  }

  /** 문자 하나(키보드가 만든 ASCII 문자, 시프트 반영)를 넣는다. */
  feed(ch: string): FeedResult {
    const def: KeyDef | undefined = this.layout.map[ch]
    if (def === undefined || (def.role === 'lit' && this.options.passthroughLiterals === true)) {
      const commit = this.flush()
      return { consumed: false, commit, preedit: '' }
    }
    if (def.role === 'lit') {
      const commit = this.flush() + def.text
      return { consumed: true, commit, preedit: '' }
    }
    const jamo = def.jamo
    const prev = this.syl
    let step: Step
    if (this.layout.kind === 'dubeol') {
      if (def.role === 'jung') step = dubeolVowel(prev, jamo)
      else if (!isCho(jamo)) step = { commit: this.flush(), next: EMPTY } // 방어: 두벌식 표에 없는 자음
      else step = dubeolConsonant(prev, jamo)
    } else if (def.role === 'cho') step = sebeolCho(prev, jamo)
    else if (def.role === 'jung') step = sebeolJung(prev, jamo)
    else step = sebeolJong(prev, jamo)

    if (step.commit !== '') this.history = [...(step.seed ?? [EMPTY])]
    else this.history.push(prev)
    this.syl = step.next
    return { consumed: true, commit: step.commit, preedit: render(this.syl) }
  }

  /**
   * 백스페이스. 조합 중인 글자가 있으면 한 자모 되돌리고 consumed=true.
   * 조합 중인 글자가 없으면 consumed=false (호출자가 편집기에 그대로 넘긴다).
   */
  backspace(): { consumed: boolean; preedit: string } {
    if (isEmpty(this.syl)) return { consumed: false, preedit: '' }
    this.syl = this.history.pop() ?? EMPTY
    return { consumed: true, preedit: render(this.syl) }
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
