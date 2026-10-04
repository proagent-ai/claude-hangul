// 한글 음절 조합에 쓰는 자모 표와 결합 규칙. 순수 데이터/함수 (UI·API 의존 없음).
//
// 근거: 유니코드 한글 음절 영역(U+AC00..U+D7A3) 구성식
//   code = 0xAC00 + (초성idx * 21 + 중성idx) * 28 + 종성idx
// 초성 19 · 중성 21 · 종성 28(0=없음)의 순서는 유니코드 표준의 자모 순서(KS X 1001 순)와 같다.

/** 초성 19자 (유니코드 순서). */
export const CHO = ['ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'] as const
/** 중성 21자 (유니코드 순서). */
export const JUNG = ['ㅏ', 'ㅐ', 'ㅑ', 'ㅒ', 'ㅓ', 'ㅔ', 'ㅕ', 'ㅖ', 'ㅗ', 'ㅘ', 'ㅙ', 'ㅚ', 'ㅛ', 'ㅜ', 'ㅝ', 'ㅞ', 'ㅟ', 'ㅠ', 'ㅡ', 'ㅢ', 'ㅣ'] as const
/** 종성 28칸 (0번 = 받침 없음). */
export const JONG = [
  '', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ', 'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ',
] as const

/** 겹모음: 앞 모음 + 뒤 모음 → 합성 모음. 순서 고정(ㅗ 다음에 ㅏ). */
export const JUNG_COMBINE: Readonly<Record<string, string>> = {
  ㅗㅏ: 'ㅘ', ㅗㅐ: 'ㅙ', ㅗㅣ: 'ㅚ',
  ㅜㅓ: 'ㅝ', ㅜㅔ: 'ㅞ', ㅜㅣ: 'ㅟ',
  ㅡㅣ: 'ㅢ',
}

/** 겹받침(+ 같은 자음 두 번 → 쌍받침). 앞 받침 + 뒤 받침 → 합성 받침. */
export const JONG_COMBINE: Readonly<Record<string, string>> = {
  ㄱㄱ: 'ㄲ', ㄱㅅ: 'ㄳ',
  ㄴㅈ: 'ㄵ', ㄴㅎ: 'ㄶ',
  ㄹㄱ: 'ㄺ', ㄹㅁ: 'ㄻ', ㄹㅂ: 'ㄼ', ㄹㅅ: 'ㄽ', ㄹㅌ: 'ㄾ', ㄹㅍ: 'ㄿ', ㄹㅎ: 'ㅀ',
  ㅂㅅ: 'ㅄ',
  ㅅㅅ: 'ㅆ',
}

/** 세벌식 초성 겹치기: 같은 자음 두 번 → 쌍자음. (유니코드 초성 쌍자음 ㄲ ㄸ ㅃ ㅆ ㅉ) */
export const CHO_COMBINE: Readonly<Record<string, string>> = {
  ㄱㄱ: 'ㄲ', ㄷㄷ: 'ㄸ', ㅂㅂ: 'ㅃ', ㅅㅅ: 'ㅆ', ㅈㅈ: 'ㅉ',
}

const choIndex = new Map<string, number>(CHO.map((c, i) => [c, i]))
const jungIndex = new Map<string, number>(JUNG.map((c, i) => [c, i]))
const jongIndex = new Map<string, number>(JONG.map((c, i) => [c, i]))

export const isCho = (j: string): boolean => choIndex.has(j)
export const isJung = (j: string): boolean => jungIndex.has(j)
/** 종성으로 쓸 수 있는 자모인가 (ㄸ ㅃ ㅉ 는 불가). */
export const isJong = (j: string): boolean => j !== '' && jongIndex.has(j)

/** 초·중·(종) 자모로 완성 음절 한 글자를 만든다. 표에 없는 조합이면 undefined. */
export function composeSyllable(cho: string, jung: string, jong = ''): string | undefined {
  const c = choIndex.get(cho)
  const v = jungIndex.get(jung)
  const t = jongIndex.get(jong)
  if (c === undefined || v === undefined || t === undefined) return undefined
  return String.fromCharCode(0xac00 + (c * 21 + v) * 28 + t)
}
