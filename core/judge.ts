// 단어 판정: 단어가 끝났을 때, 조합된 한글을 둘지 친 키(영어)로 되돌릴지 정한다.
// 친 키가 그럴듯한 영어·개발 용어인지, 조합된 한글이 흔한 한국어 단어인지를 차례로 본다.
// 데이터: judge-data.ts (SCOWL 단어 등급 + KS X 1001 음절)와 아래 손으로 쓴 목록(일반 지식).
// 사용자의 대화 기록에서 나온 개인 빈도는 init() 으로만 들어온다. 저장소에는 들어가지 않는다.
import { KS, WORDS } from './judge-data'
import type { LayoutId } from './layouts'

type Layout = LayoutId

// ---- English side -------------------------------------------------------------------------
const TIER = new Map<string, number>()
for (const [t, s] of Object.entries(WORDS)) for (const w of s.split(' ')) TIER.set(w, +t)

const SUF = ['s', 'es', 'ed', 'd', 'ing', 'ly', 'er', 'ers']
/** most common SCOWL tier of the word or of its base form (inflections were folded out of the data) */
function tierOf(w: string): number | undefined {
  let best = TIER.get(w)
  const see = (b: string) => { const t = TIER.get(b); if (t !== undefined && (best === undefined || t < best)) best = t }
  for (const x of SUF) {
    if (!w.endsWith(x) || w.length - x.length < 3) continue
    const b = w.slice(0, -x.length); see(b)
    if (x === 'ing' || x === 'ed' || x === 'er' || x === 'ers') { see(b + 'e'); if (b.length > 3 && b[b.length - 1] === b[b.length - 2]) see(b.slice(0, -1)) }
  }
  if (w.endsWith('ies') || w.endsWith('ied')) see(w.slice(0, -3) + 'y')
  return best
}

// Developer vocabulary, acronyms, file extensions, protocols, CLI tools, short English words.
const DEV = new Set((`
github gitlab bitbucket google ai ml llm gpt rag mcp nlp ocr tts stt api apis sdk cli ide gui tui ui ux db dbs pr prs ci cd qa id ids ip os io vm vms
js ts jsx tsx py rb rs go md mdx gh gl git svn npm npx pnpm yarn bun deno node nvm pip uv brew apt yum
ls cp mv rm mkdir rmdir chmod chown cat grep sed awk curl wget ssh scp rsync tar zip unzip gzip gz tgz make cmake gcc clang llvm
vim vi nvim nano emacs tmux zsh bash sh fish sudo su ps kill top htop df du env cron jq yq fd rg fzf bat
url urls uri dns ssh ssl tls tcp udp http https ftp sftp smtp imap ws wss rest grpc rpc graphql jwt oauth sso otp mfa saml ldap
html css scss sass less xml json jsonl yaml yml toml ini csv tsv pdf png jpg jpeg gif svg webp ico mp3 mp4 wav mov txt log logs
sql nosql orm crud cdn vpc iam aws gcp gke eks ecs ec2 rds sqs sns ses kms k8s helm docker podman nginx redis kafka mysql postgres
dev prod stg staging env envs cfg conf config tmp temp app apps bin lib libs src dist build builds test tests spec specs doc docs
readme todo todos fixme wip tbd fyi asap eta afk lgtm ptal imo imho btw tldr ack nit nits poc mvp kpi okr roi sla slo
cpu gpu tpu ram ssd hdd usb hd sd hdmi wifi lan wan vpn mac pc ios ipad iphone android linux unix macos win
pm po ceo cto cfo hr ok okay hi hey yes no
com net org kr us uk eu jp cn co
oss ssr csr spa pwa seo cms crm saas paas iaas
src dst fs ui vs etc via per re
a an the and or not but nor if then else for of to in on at by as is it be am are was were been do does did done has have had
can could will would shall should may might must
we you he she they me my our your his her its their them us this that these those there here what when where who why how which
all any each few more most other some such only own same so than too very just also new old use used uses fix fixed fixes
add adds added get gets got set sets run runs ran see saw put let lets say says said make made take took give gave
one two three four five six ten first last next prev up down out off over into from with without about after before
code bug bugs file files line lines page pages user users data type types key keys value values list item items name names
show shows today now then
`).trim().split(/\s+/))

// ---- Korean side --------------------------------------------------------------------------
const KSSET = new Set(KS)
// Very frequent standalone one-syllable Korean words: these beat even a developer token.
const KO_STRONG = new Set((`
수 것 더 또 내 새 개 그 이 저 좀 잘 안 못 왜 뭐 뭘 꼭 다 각 위 후 전 중 등 및 한 두 세 네 너 나 난 날 게 거 걸 건 데 때 줄 듯 만
고 도 에 은 는 을 를 의 가 와 과 로 해 했 할 된 될 돼 됨 함 시 자 야 어 아 예 응 음 일 월 년 분 번 명 원 곳 점 말 글 집 돈 길 물 밥
앞 뒤 옆 밖 속 막 곧 늘 꽤 딱 참 영 채 체 척 뻔 법 리 지 터 바 셈 탓 덕 대 간 차 회 권 쪽 편 면 행 칸 끝 맘 몸 손 눈 발 키 팀 표 값 앱 웹
`).trim().split(/\s+/))
// Common standalone Korean eojeols (1–2 syllables), general knowledge. Hangul here always stays Hangul
// unless the user's own history says otherwise.
const KO = new Set((`
가 각 간 갈 감 갑 값 강 개 거 건 걍 걸 검 것 게 겸 계 고 곧 곳 공 과 관 구 군 권 그 근 글 금 기 길 김 깐 깊 꼭 꽤 꾹 꽉 끝 끈
나 난 날 남 낮 내 너 넌 널 네 넷 년 놈 놓 누 눈 늘 니 님
다 단 달 답 당 대 댁 더 덕 던 데 도 독 돈 동 두 둘 둥 뒤 듯 등 딱 딴 땅 때 떼 또 뜻 띠
라 란 랑 래 량 런 려 로 론 료 루 류 륙 를 리 린 림 립
마 막 만 말 맘 맛 망 매 맨 맹 먼 멀 메 면 명 몇 모 목 몫 몸 못 무 묵 문 물 뭐 뭔 뭘 미 민 밑
바 박 반 받 발 밤 밥 방 배 백 뱀 번 벌 범 법 벽 별 병 보 복 본 볼 봄 봐 부 북 분 불 비 빈 빛 빨 빵 뻔 뼈 뿐
사 산 살 삶 상 새 색 생 서 석 선 설 성 세 셈 셋 소 속 손 솔 쇼 수 순 술 숨 쉬 스 시 식 신 실 싹 쌍 쑥 쓴 씨 씩
아 안 알 암 앞 애 액 야 약 양 얘 어 억 언 얼 엄 업 에 여 역 연 열 염 엿 영 예 옛 오 옥 온 올 옷 와 완 왜 외 요 욕 용 우 운 울 움 원 월 위 유 육 윤 은 을 음 응 의 이 익 인 일 임 입 잇 있
자 작 잔 잘 잠 장 재 쟤 저 적 전 절 점 정 제 조 족 존 종 좀 좋 죄 주 죽 준 줄 중 쥐 즉 증 지 직 진 질 짐 집 짓 짝 짧 째 쪽 쭉 쯤 찜
차 착 참 창 채 책 처 척 천 철 첫 청 체 초 촌 총 최 추 축 춤 충 취 층 치 칙 친 칠 침 칸 칼 캡 컵 켜 코 콩 큰 키
타 탁 탄 탈 탑 탓 태 택 터 턱 털 텅 토 톤 통 퇴 투 툭 틀 틈 티 팀 팁
파 판 팔 팩 퍽 편 평 폐 포 폭 표 푹 풀 품 풍 피 필
하 학 한 할 함 합 항 해 핵 했 행 향 허 헌 헐 현 형 혜 호 혹 혼 홀 홈 확 환 활 황 회 획 효 후 훅 훨 휴 흑 흠 흥 흰 힘
가끔 가장 각각 거의 결국 계속 고려 그냥 그래 그런 그럼 그리 그만 금방 꼭꼭 나중 너무 늘상 다만 다시 단지 대개 대신 더욱 도대 드디 따로 때문
마치 마침 만약 매우 먼저 모두 모드 무슨 물론 바로 반드 별로 보통 아까 아마 아직 아주 아니 약간 어떤 언제 얼마 여기 역시 예를 오늘 오직 왜냐
우선 원래 이미 이제 일단 자꾸 잠깐 저기 전부 점점 정말 제발 조금 좀더 주로 즉시 지금 진짜 참고 처음 특히 함께 해소 혹시 훨씬
`).trim().split(/\s+/))

// ---- Personal ----------------------------------------------------------------------------
let pEng = new Map<string, number>(), pKor = new Map<string, number>()
export type Personal = { eng: readonly (readonly [string, number])[]; kor: readonly (readonly [string, number])[] }

/** 개인 빈도를 넣는다. /hangul learn 결과. 빈 값이면 일반 규칙만. */
export function init(personal: Personal): void {
  pEng = new Map(); pKor = new Map()
  for (const [w, n] of personal.eng) { const l = w.toLowerCase(); pEng.set(l, (pEng.get(l) ?? 0) + n) }
  for (const [w, n] of personal.kor) pKor.set(w, (pKor.get(w) ?? 0) + n)
}

const isSyl = (c: string) => c >= '가' && c <= '힣'

/** hangul 은 keys 를 조합한 결과(keys 와 다를 때만 부른다). 'en' 이면 친 키로 되돌린다. */
export function decide(layout: Layout, keys: string, hangul: string): 'ko' | 'en' {
  if (/[A-Za-z]/.test(hangul)) return 'en' // letters left unconverted: not a Korean word
  const lower = keys.toLowerCase()
  // 세벌식은 숫자 키가 자모다. 숫자가 섞인 키는 한글로 보되, k8s 같은 개발 용어만 영어.
  if (!/^[A-Za-z]+$/.test(keys)) return /^[a-z0-9]+$/.test(lower) && DEV.has(lower) ? 'en' : 'ko'
  // 1. 숫자·기호뿐(세벌식 시프트 치환 J → 4)이면 그대로 둔다. 세벌식에서 숫자를 칠 유일한 방법이다.
  //    390 UI → 78 처럼 약어와 겹치는 숫자도 숫자 쪽을 지킨다.
  if (![...hangul].some(isSyl)) return 'ko'
  // 앞뒤에 붙은 숫자·기호(한글! · 한4)는 떼고 한글 부분만 본다. 음절 사이에 끼면(GitHub → /머'두) 영어.
  const body = hangul.replace(/^[^가-힣]+|[^가-힣]+$/g, '')
  if (/[^가-힣]/.test(body)) return 'en'
  const edged = body !== hangul
  // 2. Personal history
  const e = pEng.get(lower) ?? 0, k = pKor.get(body) ?? 0
  if (e > 0 && k === 0) return 'en'
  if (k > 0 && e === 0) return 'ko'
  if (e > 0 && k > 0) return e > 3 * k ? 'en' : 'ko'
  // 3. Off-repertoire syllable → never real Korean
  for (const c of body) if (!KSSET.has(c)) return 'en'
  // 4. 두벌식: shift on a key that has no shifted jamo
  if (layout === 'dubeolsik' && /[ABCDFGHIJKLMNSUVXYZ]/.test(keys)) return 'en'
  // 기호가 붙은 단어는 키 쪽 사전 비교가 맞지 않으니(키에 시프트 글자가 섞임) 한글로 둔다.
  if (edged) return 'ko'
  // 5. Very common Korean word beats everything general
  if (KO_STRONG.has(body)) return 'ko'
  // 6. Curated developer / short English vocabulary
  if (DEV.has(lower)) return 'en'
  // 7. Other common Korean words veto dictionary / n-gram guesses
  if (KO.has(body)) return 'ko'
  if (lower.length >= 4) {
    const t = tierOf(lower)
    if (t !== undefined) return 'en'
  }
  return 'ko'
}
