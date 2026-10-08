// /hangul learn: 이 맥의 Claude Code 대화 기록에서, 사람이 직접 친 한글 프롬프트만 골라
// 그 안의 영어 단어와 한글 어절 빈도를 센다. 원문은 저장하지 않는다. 결과는 core/judge 의 init() 으로 간다.
// 고르는 규칙은 판정 점수를 잰 방식과 같다(docs/ROADMAP.md).
import type { Personal } from '../core/judge'

const HANGUL = /[가-힣]/g
const LATIN = /[A-Za-z]/g
/** 저장할 개수 상한. 빈도순으로 자른다. $.store 는 4 MiB 까지. */
const KEEP = { eng: 3000, kor: 20000 }

/** JSONL 한 줄이 사람이 입력창에 친 프롬프트면 그 글, 아니면 undefined. */
export function promptOf(line: string): string | undefined {
  if (!line.includes('"type":"user"')) return undefined
  let r: any
  try {
    r = JSON.parse(line)
  } catch {
    return undefined
  }
  if (r?.type !== 'user' || r.isSidechain === true || r.isMeta === true) return undefined
  let c = r.message?.content
  if (Array.isArray(c)) {
    if (c.some(x => x?.type === 'tool_result')) return undefined
    c = c.filter(x => x?.type === 'text').map(x => x.text ?? '').join(' ')
  }
  if (typeof c !== 'string') return undefined
  const t = c.trim()
  if (t === '' || t.startsWith('<') || t.slice(0, 40).includes('Caveat:') || t.includes('```') || t.length > 1500) return undefined
  // 한글 문장이어야 한다. 영어 위주(자동 생성 템플릿 등)는 뺀다.
  const h = t.match(HANGUL)?.length ?? 0
  const a = t.match(LATIN)?.length ?? 0
  if (h === 0 || h < 0.3 * (h + a)) return undefined
  return t
}

/** 프롬프트들에서 영어 단어·한글 어절 빈도를 센다. 같은 글과 앞 40자가 4번 이상 반복되는 템플릿은 뺀다. */
export function countPrompts(prompts: Iterable<string>): Personal & { prompts: number } {
  const unique = [...new Set(prompts)]
  const heads = new Map<string, number>()
  for (const t of unique) heads.set(t.slice(0, 40), (heads.get(t.slice(0, 40)) ?? 0) + 1)
  const eng = new Map<string, number>()
  const kor = new Map<string, number>()
  let n = 0
  for (const t of unique) {
    if ((heads.get(t.slice(0, 40)) ?? 0) > 3) continue
    n++
    for (const tok of t.split(/[^A-Za-z0-9가-힣]+/)) {
      if (/^[A-Za-z][A-Za-z0-9]*$/.test(tok)) eng.set(tok, (eng.get(tok) ?? 0) + 1)
      else if (/^[가-힣]+$/.test(tok)) kor.set(tok, (kor.get(tok) ?? 0) + 1)
    }
  }
  const top = (m: Map<string, number>, k: number) => [...m].sort((x, y) => y[1] - x[1]).slice(0, k)
  return { eng: top(eng, KEEP.eng), kor: top(kor, KEEP.kor), prompts: n }
}
