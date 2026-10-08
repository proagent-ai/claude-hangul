// 기대값은 (1) 한글 조합 규칙, (2) layout-data.ts 의 키→자모 표에서 손으로 도출했다. 근거 없는 값은 넣지 않는다.
// 표기: d = 두벌식, s3 = 세벌식 390, sf = 세벌식 최종. type(keys) = 확정+조합중 전체 문자열.
import { describe, expect, test } from 'claude-code/testing'
import { HangulComposer, LAYOUTS, composeSyllable, parseLayout } from './index'
import { isCho, isJong, isJung } from './jamo'
import type { LayoutId } from './index'

const make = (id: LayoutId, options = {}) => new HangulComposer(LAYOUTS[id], options)
const d = (keys: string) => make('dubeolsik').typeAll(keys)
const s3 = (keys: string) => make('sebeolsik-390').typeAll(keys)
const sf = (keys: string) => make('sebeolsik-final').typeAll(keys)

/** 한 키씩 넣으며 매 단계의 (확정된 누적 + 조합중)을 기록. */
function trace(c: HangulComposer, keys: string): string[] {
  let done = ''
  const out: string[] = []
  for (const k of keys) {
    const r = c.feed(k)
    done += r.commit
    if (!r.consumed) done += k
    out.push(done + r.preedit)
  }
  return out
}

describe('유니코드 음절 구성식', () => {
  test('가 = U+AC00, 힣 = U+D7A3', () => {
    expect(composeSyllable('ㄱ', 'ㅏ')).toBe('가')
    expect(composeSyllable('ㅎ', 'ㅣ', 'ㅎ')).toBe('힣')
  })
  test('한 = ㅎ+ㅏ+ㄴ, 닭 = ㄷ+ㅏ+ㄺ, 괜 = ㄱ+ㅙ+ㄴ', () => {
    expect(composeSyllable('ㅎ', 'ㅏ', 'ㄴ')).toBe('한')
    expect(composeSyllable('ㄷ', 'ㅏ', 'ㄺ')).toBe('닭')
    expect(composeSyllable('ㄱ', 'ㅙ', 'ㄴ')).toBe('괜')
  })
  test('ㄸ ㅃ ㅉ 는 받침이 될 수 없다', () => {
    expect(composeSyllable('ㄱ', 'ㅏ', 'ㄸ')).toBeUndefined()
  })
})

describe('두벌식: 기본 조합', () => {
  test("'gksrmf' → 한글", () => expect(d('gksrmf')).toBe('한글'))
  test('단계별: 음절 전 키는 원문. g → 하 → 한 → 한r → 한그 → 한글', () => {
    expect(trace(make('dubeolsik'), 'gksrmf')).toEqual(['g', '하', '한', '한r', '한그', '한글'])
  })
  test('모음만은 음절이 아니므로 k 는 k', () => {
    const c = make('dubeolsik')
    expect(c.feed('k')).toEqual({ consumed: true, commit: '', preedit: 'k' })
    expect(c.flush()).toBe('k')
  })
  test('자음 단독은 음절이 아니므로 r 은 r', () => expect(d('r')).toBe('r'))
  test('안녕: ㅇㅏㄴ + ㄴ(받침 결합 불가→확정) ㅕ ㅇ', () => expect(d('dkssud')).toBe('안녕'))
  test('두 번 친 같은 초성은 합치지 않는다: rr 은 rr (쌍자음은 시프트)', () => expect(d('rr')).toBe('rr'))
  test('시프트 쌍자음: Rk → 까, Tk → 싸, Wk → 짜, Ek → 따, Qk → 빠', () => {
    expect(d('Rk')).toBe('까')
    expect(d('Tk')).toBe('싸')
    expect(d('Wk')).toBe('짜')
    expect(d('Ek')).toBe('따')
    expect(d('Qk')).toBe('빠')
  })
  test('시프트 ㅒ ㅖ: O → ㅒ, P → ㅖ', () => {
    expect(d('dO')).toBe('얘')
    expect(d('dP')).toBe('예')
  })
  test('대문자인 일반 키는 소문자와 같다: K = ㅏ', () => expect(d('rK')).toBe('가'))
  test('받침이 될 수 없는 자음은 확정하고 새 음절: 가 + ㅃ(Q)', () => {
    expect(trace(make('dubeolsik'), 'rkQk')).toEqual(['r', '가', '가Q', '가빠'])
  })
  test('모음만 연속은 음절이 아니므로 kk', () => expect(d('kk')).toBe('kk'))
})

describe('두벌식: 겹받침', () => {
  test('닭 = ekfr (ㄷㅏ + ㄹ+ㄱ)', () => expect(d('ekfr')).toBe('닭'))
  test('값 = rkqt (ㄱㅏ + ㅂ+ㅅ)', () => expect(d('rkqt')).toBe('값'))
  test('앉 = dksw, 읽 = dlfr, 삶 = tkfa, 없 = djqt', () => {
    expect(d('dksw')).toBe('앉')
    expect(d('dlfr')).toBe('읽')
    expect(d('tkfa')).toBe('삶')
    expect(d('djqt')).toBe('없')
  })
  test('겹받침 11종 전부 (가+받침): rk + {rt:ㄳ sw:ㄵ sg:ㄶ fr:ㄺ fa:ㄻ fq:ㄼ ft:ㄽ fx:ㄾ fv:ㄿ fg:ㅀ qt:ㅄ}', () => {
    const cases: Record<string, string> = {
      rt: 'ㄳ', sw: 'ㄵ', sg: 'ㄶ', fr: 'ㄺ', fa: 'ㄻ', fq: 'ㄼ', ft: 'ㄽ', fx: 'ㄾ', fv: 'ㄿ', fg: 'ㅀ', qt: 'ㅄ',
    }
    for (const [tail, jong] of Object.entries(cases)) expect(d('rk' + tail)).toBe(composeSyllable('ㄱ', 'ㅏ', jong)!)
  })
  test('쌍받침: 낚 = skrr, 았 = dkT(시프트 ㅆ 받침), 갔 = rktt', () => {
    expect(d('skrr')).toBe('낚')
    expect(d('dkT')).toBe('았')
    expect(d('rktt')).toBe('갔')
  })
  test('겹받침 뒤에 자음이 또 오면 확정: 읽다 = dlfrek', () => {
    expect(trace(make('dubeolsik'), 'dlfrek')).toEqual(['d', '이', '일', '읽', '읽e', '읽다'])
  })
  test('결합 불가 ㄴ 이 확정되면 단어 전체를 키로: dksss', () => expect(d('dksss')).toBe('dksss'))
})

describe('두벌식: 도깨비불(받침이 다음 모음으로 넘어감)', () => {
  test('갈 + ㅏ → 가라 (rkfk)', () => {
    expect(trace(make('dubeolsik'), 'rkfk')).toEqual(['r', '가', '갈', '가라'])
  })
  test('한글 → 하 + 글 처럼: 한 + ㅡ → 하느 (gksm)', () => expect(d('gksm')).toBe('하느'))
  test('겹받침은 뒤 자모만 넘어간다: 닭 + ㅣ → 달기 (ekfrl)', () => expect(d('ekfrl')).toBe('달기'))
  test('값 + ㅣ → 갑시 (rkqtl), 앉 + ㅏ → 안자 (dkswk)', () => {
    expect(d('rkqtl')).toBe('갑시')
    expect(d('dkswk')).toBe('안자')
  })
  test('쌍받침(ㄱㄱ)은 분리: 낚 + ㅣ → 낙기 (skrrl)', () => expect(d('skrrl')).toBe('낙기'))
  test('시프트 ㅆ 은 한 덩어리로 넘어간다: 았+ㅏ→아싸 (dkTk). 근거: libhangul process_jamo, peek 가 종성이 아니면 jongseong_to_choseong(pop)', () => {
    expect(d('dkTk')).toBe('아싸')
  })
  test('시프트 ㄲ 도 한 덩어리: 갂+ㅏ→가까 (rkRk). ㄱ+ㄱ 으로 만든 ㄲ(낚+ㅣ→낙기)와 다르다', () => {
    expect(d('rkRk')).toBe('가까')
  })
  test('받침 없는 음절 뒤 모음은 새 덩어리. 음절이 아니면 키: 가 + k', () => expect(d('rkk')).toBe('가k'))
  test('연속: 한국어 = gksrnrdj (한 / 국 / 어)', () => expect(d('gksrnrdj')).toBe('한국어'))
})

describe('두벌식: 겹모음', () => {
  test('ㅘ ㅙ ㅚ ㅝ ㅞ ㅟ ㅢ', () => {
    const cases: Record<string, string> = { dhk: '와', dho: '왜', dhl: '외', dnj: '워', dnp: '웨', dnl: '위', dml: '의' }
    for (const [keys, want] of Object.entries(cases)) expect(d(keys)).toBe(want)
  })
  test('겹모음 순서 고정: ㅏ 다음 ㅗ 는 결합 안 함. 음절이 아니면 kh', () => expect(d('kh')).toBe('kh'))
  test('결합표에 없는 모음쌍: ㅗ + ㅓ → 오 + j', () => expect(d('dhj')).toBe('오j'))
  test('겹모음 + 받침: 왕 = dhkd, 괜 = rhos', () => {
    expect(d('dhkd')).toBe('왕')
    expect(d('rhos')).toBe('괜')
  })
  test('겹모음 뒤 받침 + 모음: 완 + ㅏ → 와나 (dhksk)', () => expect(d('dhksk')).toBe('와나'))
  test('받침이 있으면 모음 결합 대신 도깨비불: 곳 + ㅏ → 고사 (rhtk)', () => {
    // r h t(ㅅ) = 곳, + k(ㅏ) → 고 + 사
    expect(d('rhtk')).toBe('고사')
  })
})

describe('두벌식: 백스페이스(자모 단위 해체)', () => {
  const bsAll = (keys: string, n: number) => {
    const c = make('dubeolsik')
    c.typeAll(keys)
    const seen: string[] = []
    for (let i = 0; i < n; i++) seen.push(c.backspace().preedit)
    return seen
  }
  test('글(그+ㄹ): 글 → 그 → r → 빈', () => expect(bsAll('rmf', 3)).toEqual(['그', 'r', '']))
  test('한글은 단어가 열려 있는 동안 키 단위로 되돌린다', () => {
    const c = make('dubeolsik')
    c.typeAll('gksrmf')
    expect(c.backspace()).toEqual({ consumed: true, preedit: '한그' })
    expect(c.backspace()).toEqual({ consumed: true, preedit: '한r' })
    expect(c.backspace()).toEqual({ consumed: true, preedit: '한' })
    expect(c.backspace()).toEqual({ consumed: true, preedit: '하' })
    expect(c.backspace()).toEqual({ consumed: true, preedit: 'g' })
    expect(c.backspace()).toEqual({ consumed: true, preedit: '' })
    expect(c.backspace()).toEqual({ consumed: false, preedit: '' })
  })
  test('겹받침 해체: 닭 → 달 → 다 → e', () => expect(bsAll('ekfr', 3)).toEqual(['달', '다', 'e']))
  test('겹모음 해체: 와 → 오 → d', () => expect(bsAll('dhk', 2)).toEqual(['오', 'd']))
  test('도깨비불 뒤 BS: 가라 에서 마지막 키를 지우면 갈. 단어가 아직 열려 있다', () => {
    const c = make('dubeolsik')
    expect(c.typeAll('rkfk')).toBe('가라')
    expect(c.backspace().preedit).toBe('갈')
    expect(c.backspace().preedit).toBe('가')
    expect(c.backspace().preedit).toBe('r')
    expect(c.backspace().preedit).toBe('')
  })
  test('BS 후 다시 입력하면 이어서 조합: 닭 → BS → 달 → r → 닭', () => {
    const c = make('dubeolsik')
    c.typeAll('ekfr')
    c.backspace()
    expect(c.feed('r').preedit).toBe('닭')
  })
  test('조합 중이 아니면 consumed=false', () => expect(make('dubeolsik').backspace().consumed).toBe(false))
})

describe('통과 키와 확정', () => {
  test('공백은 조합을 확정하고 통과: "gks" + " " → 한 + 공백', () => {
    const c = make('dubeolsik')
    c.typeAll('gks')
    const r = c.feed(' ')
    expect(r).toEqual({ consumed: false, commit: '한', preedit: '' })
    expect(c.isComposing()).toBe(false)
  })
  test('숫자·기호는 두벌식에서 그대로: gks1 → 한1', () => expect(d('gks1')).toBe('한1'))
  test('typeAll 은 통과 키를 확정 뒤에 붙인다: "gks gks" → 한 한', () => expect(d('gks gks')).toBe('한 한'))
  test('flush 후 상태 초기화', () => {
    const c = make('dubeolsik')
    c.typeAll('rk')
    expect(c.flush()).toBe('가')
    expect(c.flush()).toBe('')
  })
  test('reset 은 확정하지 않고 버린다', () => {
    const c = make('dubeolsik')
    c.typeAll('rk')
    c.reset()
    expect(c.preedit()).toBe('')
  })
  test('setLayout 은 조합 중인 글자를 확정해 돌려준다', () => {
    const c = make('dubeolsik')
    c.typeAll('rk')
    expect(c.setLayout(LAYOUTS['sebeolsik-390'])).toBe('가')
    expect(c.getLayout().id).toBe('sebeolsik-390')
  })
})

describe('세벌식 390', () => {
  test('한글 = m f s / k g w (ㅎ ㅏ ㄴ / ㄱ ㅡ ㄹ)', () => {
    expect(s3('mfskgw')).toBe('한글')
    expect(trace(make('sebeolsik-390'), 'mfskgw')).toEqual(['m', '하', '한', '한k', '한그', '한글'])
  })
  test('도깨비불 없음: 갈 뒤 ㅏ는 음절이 아니면 키 f', () => {
    expect(s3('kfwf')).toBe('갈f')
  })
  test('초성 ㅇ 을 쳐야 모음 음절: 아가 = j f k f', () => expect(s3('jfkf')).toBe('아가'))
  test('ㅏ 단독은 음절이 아니므로 f', () => expect(s3('f')).toBe('f'))
  test('초성 키 단독은 음절이 아니므로 k', () => expect(s3('k')).toBe('k'))
  test('쌍자음은 같은 초성 키 두 번: kkf → 까, uuf → 따, ;;f → 빠, nnf → 싸, llf → 짜', () => {
    expect(s3('kkf')).toBe('까')
    expect(s3('uuf')).toBe('따')
    expect(s3(';;f')).toBe('빠')
    expect(s3('nnf')).toBe('싸')
    expect(s3('llf')).toBe('짜')
  })
  test('중성이 차면 같은 초성 반복은 새 덩어리: kfk → 가k', () => expect(s3('kfk')).toBe('가k'))
  test('겹모음은 ㅗ/ㅜ 키 뒤에 모음: 와 = j v f, 왜 = j v r, 외 = j v d, 워 = j b t, 웨 = j b c, 위 = j b d, 의 = j g d', () => {
    expect(s3('jvf')).toBe('와')
    expect(s3('jvr')).toBe('왜')
    expect(s3('jvd')).toBe('외')
    expect(s3('jbt')).toBe('워')
    expect(s3('jbc')).toBe('웨')
    expect(s3('jbd')).toBe('위')
    expect(s3('jgd')).toBe('의')
  })
  test('ㅗ 의 두 키(v, /)와 ㅜ 의 두 키(b, 9) 는 같은 자모', () => {
    expect(s3('j/f')).toBe('와')
    expect(s3('j9t')).toBe('워')
  })
  test('겹받침은 받침 키 두 개로: 닭 = u f w x (ㄹ+ㄱ)', () => expect(s3('ufwx')).toBe('닭'))
  test('겹받침 직접 키(시프트): 닭 = u f D, 값 = k f 3 q, 값 = k f X', () => {
    expect(s3('ufD')).toBe('닭')
    expect(s3('kf3q')).toBe('값')
    expect(s3('kfX')).toBe('값')
  })
  test('쌍받침: 갂 = k f x x, 갔 = k f q q, 갔 = k f 2', () => {
    expect(s3('kfxx')).toBe('갂')
    expect(s3('kfqq')).toBe('갔')
    expect(s3('kf2')).toBe('갔')
  })
  test('괜 = k v r s, 없 = j t 3 q', () => {
    expect(s3('kvrs')).toBe('괜')
    expect(s3('jt3q')).toBe('없')
  })
  test('대표 단어: 한국어 = (m f s)(k b x)(j t)', () => {
    expect(s3('mfskbxjt')).toBe('한국어')
  })
  test('대표 단어: 대한민국 = (u r)(m f s)(i d s)(k b x)', () => {
    expect(s3('urmfsidskbx')).toBe('대한민국')
  })
  test('삶 = n f w z (받침 ㄹ+ㅁ=ㄻ)', () => expect(s3('nfwz')).toBe('삶'))
  test('통과: 공백은 확정 후 통과', () => expect(s3('mfs mfs')).toBe('한 한'))
  test('초성만 이어지면 한글이 아니라 친 키: hoy', () => {
    expect(s3('hoy')).toBe('hoy')
    expect(sf('hoy')).toBe('hoy')
  })
  test('숫자만이면 세벌식 자모로 바꾸지 않는다: 390', () => {
    expect(s3('390')).toBe('390')
    expect(sf('390')).toBe('390')
  })

  test('ㅋ(0)·ㅠ(5)처럼 숫자 키로 된 음절도 단어 안에서는 한글: 큐를, 쿠키. 숫자만인 단어는 숫자', () => {
    expect(s3('05ygw')).toBe('큐를')
    expect(s3('090d')).toBe('쿠키')
    expect(s3('390')).toBe('390')
  })
  test('백스페이스 자모 해체: 한 → 하 → ㅎ → 빈', () => {
    const c = make('sebeolsik-390')
    c.typeAll('mfs')
    expect([c.backspace().preedit, c.backspace().preedit, c.backspace().preedit]).toEqual(['하', 'm', ''])
  })
  test('백스페이스: 닭(ufwx) → 달 → 다 → ㄷ', () => {
    const c = make('sebeolsik-390')
    c.typeAll('ufwx')
    expect([c.backspace().preedit, c.backspace().preedit, c.backspace().preedit]).toEqual(['달', '다', 'u'])
  })
  test('시프트 숫자·기호는 기본으로 레이아웃 치환: < → 2, J K L → 4 5 6, B → !', () => {
    expect(s3('<')).toBe('2')
    expect(s3('mfs<')).toBe('한2')
    expect(s3('JKL')).toBe('456')
    expect(s3('mfsJ')).toBe('한4')
    expect(s3('mfsB')).toBe('한!')
  })
  test('기호 뒤에도 같은 단어에서 한글이 이어진다: 한4한', () => expect(s3('mfsJmfs')).toBe('한4한'))
  test('passthroughLiterals:true 면 기호 키는 친 문자 그대로 < 는 <', () => {
    expect(make('sebeolsik-390', { passthroughLiterals: true }).typeAll('mfs<')).toBe('한<')
  })
})

describe('영어·숫자·특수문자는 한글이 아닌 단어로 남긴다', () => {
  test('대문자 섞인 영어는 기호 키까지 친 키로: 390 Hello, amazingBBBBB!', () => {
    expect(s3('Hello')).toBe('Hello')
    expect(s3('amazingBBBBB!')).toBe('amazingBBBBB!')
  })
  test('세벌식 hello 는 녀llo 가 아니라 hello', () => {
    expect(s3('hello')).toBe('hello')
    expect(sf('hello')).toBe('hello')
    expect(d('hello')).toBe('hello')
  })
  test('how are you 는 세 단어 모두 영어', () => {
    expect(s3('how are you')).toBe('how are you')
    expect(d('how are you')).toBe('how are you')
  })
  test('물음표·쉼표·느낌표는 친 문자 그대로', () => {
    expect(s3('hello?')).toBe('hello?')
    expect(s3('hello,')).toBe('hello,')
    expect(d('gksrmf!')).toBe('한글!')
    expect(sf('hello?')).toBe('hello?')
  })
  test('숫자만인 단어는 숫자: 390, 123, 3.14', () => {
    expect(s3('390')).toBe('390')
    expect(s3('123')).toBe('123')
    expect(s3('3.14')).toBe('3.14')
    expect(d('123')).toBe('123')
  })
  test('한글 단어와 영어·숫자를 한 문장에 섞는다', () => {
    expect(s3('mfskgw hello 390')).toBe('한글 hello 390')
    expect(d('gksrmf hello 123')).toBe('한글 hello 123')
  })
  test('단어가 끝날 때 한글과 낱자가 섞여 있으면 키로 되돌린다: hell?', () => {
    expect(s3('hell?')).toBe('hell?')
  })
  test('한 음절로 끝나는 영어는 한글로 남는다: 두벌식 to → 새', () => {
    expect(d('to')).toBe('새')
  })
})

describe('세벌식: 순서 무관은 기본값. libhangul 기본(option_auto_reorder=false, hangul_ic_new)과 다르고 SPEC 4.2 의 설계 선택이다', () => {
  const PERMS = (a: string, b: string, c: string) => [a + b + c, a + c + b, b + a + c, b + c + a, c + a + b, c + b + a]
  test('한 = {m(ㅎ), f(ㅏ), s(ㄴ)} 의 6가지 순서 모두', () => {
    for (const keys of PERMS('m', 'f', 's')) expect(s3(keys)).toBe('한')
  })
  test('값 = {k, f} + 받침 3,q 순서 일부: 받침→중성→초성→받침', () => {
    expect(s3('3fkq')).toBe('값')
    expect(s3('fk3q')).toBe('값')
  })
  test('받침 먼저: s f m → 한 (단계: s → sf → 한). 음절 전엔 키를 보인다', () => {
    expect(trace(make('sebeolsik-390'), 'sfm')).toEqual(['s', 'sf', '한'])
  })
  test('초성 없는 중성+종성은 음절이 아니므로 fs', () => expect(s3('fs')).toBe('fs'))
  test('순서가 달라도 칸이 이미 찼으면 새 덩어리: 한 + ㅎ 초성 → 한m', () => expect(s3('mfsm')).toBe('한m'))
  test('최종에서도 동일: 한 의 6가지 순서', () => {
    for (const keys of PERMS('m', 'f', 's')) expect(sf(keys)).toBe('한')
  })
  test('겹모음은 앞 모음이 먼저여야 한다(순서 무관 적용 안 함): f v → 아 + v', () => {
    expect(s3('jfv')).toBe('아v')
  })
  test('겹모음은 받침이 없을 때만: 곡(k v x) 뒤 ㅏ → 곡f', () => {
    expect(s3('kvxf')).toBe('곡f')
  })
})

describe('세벌식 autoReorder:false 는 libhangul 기본(process_jaso, auto_reorder 꺼짐)처럼 역순을 확정한다', () => {
  const strict = (keys: string) => make('sebeolsik-390', { autoReorder: false }).typeAll(keys)
  test('정순 mfs 는 그대로 한', () => expect(strict('mfs')).toBe('한'))
  test('종성 다음 중성은 채우지 않고 확정. 음절이 아니면 sf', () => expect(strict('sf')).toBe('sf'))
  test('중성 다음 초성은 채우지 않고 확정. 음절이 아니면 fm', () => expect(strict('fm')).toBe('fm'))
  test('sfm 은 음절이 안 되어 sfm. 기본 autoReorder 는 한', () => expect(strict('sfm')).toBe('sfm'))
})

describe('세벌식 최종', () => {
  test('한글 = m f s k g w', () => expect(sf('mfskgw')).toBe('한글'))
  test('겹받침 11종은 전용 키: 값(X) 닭(@) 앉(E) ㅇㅏㄼ(D) 삶(F) 곬(T) 핥(%) 읊($) 앓(R) 많(S) 몫(V)', () => {
    expect(sf('kfX')).toBe('값')
    expect(sf('uf@')).toBe('닭')
    expect(sf('jfE')).toBe('앉')
    expect(sf('jfD')).toBe(composeSyllable('ㅇ', 'ㅏ', 'ㄼ')!)
    expect(sf('nfF')).toBe('삶')
    expect(sf('kvT')).toBe(composeSyllable('ㄱ', 'ㅗ', 'ㄽ')!)
    expect(sf('mf%')).toBe(composeSyllable('ㅎ', 'ㅏ', 'ㄾ')!)
    expect(sf('jg$')).toBe(composeSyllable('ㅇ', 'ㅡ', 'ㄿ')!)
    expect(sf('jfR')).toBe(composeSyllable('ㅇ', 'ㅏ', 'ㅀ')!)
    expect(sf('ifS')).toBe(composeSyllable('ㅁ', 'ㅏ', 'ㄶ')!)
    expect(sf('ivV')).toBe(composeSyllable('ㅁ', 'ㅗ', 'ㄳ')!)
  })
  test('받침 키 두 개로도 겹받침: 닭 = u f w x', () => expect(sf('ufwx')).toBe('닭'))
  test('쌍받침 전용 키: 갂 = k f !, 갔 = k f 2', () => {
    expect(sf('kf!')).toBe('갂')
    expect(sf('kf2')).toBe('갔')
  })
  test('ㅒ ㅖ ㅢ 전용 키: jG → 얘, j7 → 예, j8 → 의', () => {
    expect(sf('jG')).toBe('얘')
    expect(sf('j7')).toBe('예')
    expect(sf('j8')).toBe('의')
  })
  test('최종 시프트 기호는 기본으로 레이아웃 치환: J → 1, B → ?, > → .', () => {
    expect(sf('J')).toBe('1')
    expect(sf('mfsJ')).toBe('한1')
    expect(sf('mfsB')).toBe('한?')
    expect(sf('mfs>')).toBe('한.')
  })
  test('최종 . 은 단어를 끊지 않는다: 한.한, 뒤에 영어가 오면 단어 전체가 키', () => {
    expect(sf('mfs>mfs')).toBe('한.한')
    expect(sf('mfs>hello')).toBe('mfs>hello')
  })
  test('passthroughLiterals:true 면 최종 J 는 J', () => {
    expect(make('sebeolsik-final', { passthroughLiterals: true }).typeAll('mfsJ')).toBe('한J')
  })
  test('390 과 최종의 차이: 같은 키 D 는 390 에서 ㄺ, 최종에서 ㄼ', () => {
    expect(s3('ufD')).toBe('닭')
    expect(sf('jfD')).toBe(composeSyllable('ㅇ', 'ㅏ', 'ㄼ')!)
    expect(s3('jfD')).toBe(composeSyllable('ㅇ', 'ㅏ', 'ㄺ')!)
  })
  test('쌍자음·겹모음·도깨비불 없음은 390 과 동일: kkf → 까, jvf → 와, kfwf → 갈ㅏ', () => {
    expect(sf('kkf')).toBe('까')
    expect(sf('jvf')).toBe('와')
    expect(sf('kfwf')).toBe('갈f')
  })
  test('백스페이스: 앉(jfE) → 아 → ㅇ', () => {
    const c = make('sebeolsik-final')
    c.typeAll('jfE')
    expect([c.backspace().preedit, c.backspace().preedit]).toEqual(['아', 'j'])
  })
})

describe('레이아웃 표 일관성', () => {
  const entries = (id: LayoutId) => Object.entries(LAYOUTS[id].map)
  test('두벌식은 cons/jung 만, 세벌식은 cho/jung/jong/lit 만 쓴다', () => {
    for (const [, def] of entries('dubeolsik')) expect(['cons', 'jung']).toContain(def.role)
    for (const id of ['sebeolsik-390', 'sebeolsik-final'] as const) {
      for (const [, def] of entries(id)) expect(['cho', 'jung', 'jong', 'lit']).toContain(def.role)
    }
  })
  test('세벌식 jong 키의 자모는 모두 실제 종성, cho 는 초성, jung 은 중성', () => {
    for (const id of ['sebeolsik-390', 'sebeolsik-final'] as const) {
      for (const [, def] of entries(id)) {
        if (def.role === 'jong') expect(isJong(def.jamo)).toBe(true)
        if (def.role === 'cho') expect(isCho(def.jamo)).toBe(true)
        if (def.role === 'jung') expect(isJung(def.jamo)).toBe(true)
      }
    }
  })
  test('세벌식 초성 키는 14종(ㄱㄴㄷㄹㅁㅂㅅㅇㅈㅊㅋㅌㅍㅎ)을 정확히 한 번씩', () => {
    for (const id of ['sebeolsik-390', 'sebeolsik-final'] as const) {
      const chos = entries(id).filter(([, d]) => d.role === 'cho').map(([, d]) => (d as { jamo: string }).jamo).sort()
      expect(chos).toEqual([...'ㄱㄴㄷㄹㅁㅂㅅㅇㅈㅊㅋㅌㅍㅎ'].sort())
    }
  })
  test('두벌식 소문자 자음 14 + 모음 10 키 (ㅐ=o ㅔ=p 포함)', () => {
    const lower = entries('dubeolsik').filter(([k]) => /[a-z]/.test(k))
    expect(lower.filter(([, d]) => d.role === 'cons')).toHaveLength(14)
    expect(lower.filter(([, d]) => d.role === 'jung')).toHaveLength(12)
  })
  test('parseLayout 별칭', () => {
    expect(parseLayout('두벌식')?.id).toBe('dubeolsik')
    expect(parseLayout(' Dubeolsik ')?.id).toBe('dubeolsik')
    expect(parseLayout('390')?.id).toBe('sebeolsik-390')
    expect(parseLayout('세벌식 390')?.id).toBe('sebeolsik-390')
    expect(parseLayout('final')?.id).toBe('sebeolsik-final')
    expect(parseLayout('세벌식 최종')?.id).toBe('sebeolsik-final')
    expect(parseLayout('qwerty')).toBeUndefined()
    expect(parseLayout(undefined)).toBeUndefined()
  })
})
