# claude-hangul 구현 스펙 (Cursor Cloud 에이전트 인계용)

작성: 2026-10-04 · 대상: Claude Code 프롬프트 입력창에서 OS IME 없이 한글을 직접 조합하는 mod
기준 프로토타입: `/workspace/claude-hangul` (박스, `git init`만 됨, 커밋 없음)
표기: **미검증** = 실제로 돌려 보거나 독립 근거로 확인하지 못한 것. **미확인** = 근거 자체를 못 찾은 것.

---

## 1. 목표 / 비목표

### 목표
- Claude Code 프롬프트 입력창에서 OS IME 없이 한글을 직접 조합해 입력하는 mod(플러그인).
- 레이아웃 **세 가지 모두 필수**: 두벌식, 세벌식 390, 세벌식 최종.
- 구조는 [claude-vime](https://github.com/skanehira/claude-vime)(로마자→일본어 mod)와 같은 방식: `prompt.edit` 훅으로 키를 가로채고, 슬래시 명령으로 토글하고, 상태줄에 표시.
- 조합 코어(`core/`)는 Claude Code API와 완전히 분리된 순수 TypeScript로 유지.

### 비목표
- 한자 변환, 후보 띠, 사전, 자동완성, 학습 (이번 범위 밖).
- 세벌식 390/최종 외의 변형(세벌식 순아래, 노시프트, 안마태 등), 옛한글.
- OS 전역 IME 대체, Claude Code 이외 앱 지원.
- Claude Code 키 바인딩 수정/한영 키 강제 바인딩 (사용자 환경 변경에 해당).

---

## 2. 현재 프로토타입 상태

### 파일 구조
```
.claude-plugin/plugin.json      플러그인 매니페스트 (name: hangul)
hooks/hooks.json                { "modules": ["./register.tsx"] }
hooks/register.tsx              훅 등록: session.start / command.run(hangul) / prompt.edit / prompt.submit
hooks/editor.ts                 prompt.edit ↔ 코어 어댑터 (HangulEditor)                                           [미검증]
hooks/editor.test.ts            어댑터 테스트 16개 (claude-code/testing)
hooks/register.test.tsx         register 테스트 4개 (claude-code/testing)
core/jamo.ts                    CHO/JUNG/JONG 표, 겹모음·겹받침·쌍자음 결합표, composeSyllable
core/keydef.ts                  KeyDef 타입 (cons/cho/jung/jong/lit)
core/layout-data.ts             키 매핑표 3종 (tools/gen-layout.mjs 가 만든 생성 파일)
core/layouts.ts                 LAYOUTS, parseLayout(별칭)
core/composer.ts                HangulComposer 상태머신 (feed / backspace / flush / reset / setLayout)
core/index.ts                   공개 export
core/composer.test.ts           코어 테스트 91개
tools/gen-layout.mjs            libhangul XML → core/layout-data.ts 생성기
tools/make-shim.mjs             단독 bun test 용 claude-code/testing 심 (node_modules, gitignore)
package.json / tsconfig.json / .gitignore / README.md
```

### 테스트 현황 (2026-10-04, 샌드박스 claude CLI 2.1.289. 통과 수는 PR/아래 명령을 본다)
- `bun run test` → core 91 통과 / 0 실패.
- `claude plugin test .` → **111 통과 / 0 실패** (core 91 + 어댑터 16 + register 4).
- `claude plugin validate .claude-plugin/plugin.json` → 통과.
- `tsc` 타입체크: **미수행**(§6 참고).

### 코어 규칙 요약 (구현 완료·테스트됨)
- 두벌식: 자음은 문맥으로 초/종성 결정, 도깨비불(받침→다음 모음 초성; 겹받침은 뒤 자모만; 직접 친 시프트 ㄲ/ㅆ 받침은 통째로 이동), 겹받침 11종 + ㄱㄱ→ㄲ, ㅅㅅ→ㅆ, 겹모음 7종, 시프트 쌍자음, ㄸㅃㅉ는 받침 불가.
- 세벌식: 키가 초/중/종 고정, 도깨비불 없음. 한 음절 안에서 초·중·종 **입력 순서 무관**(빈 칸에 채움, 찬 칸에 같은 역할이 오면 결합 규칙 없을 때 확정 후 새 음절). 초성 겹치기는 중·종성이 비었을 때만, 겹모음은 종성이 비었고 앞 모음이 먼저일 때만, 겹받침은 받침 키 두 개로도 직접 키로도 가능.
- 백스페이스: 조합 중인 음절 안에서 입력 이전 상태로 되돌림(자모 단위). 확정된 글자는 코어가 건드리지 않음(`consumed:false` 반환 → 편집기가 지움). 도깨비불로 확정된 앞 글자는 복원하지 않음.
- 레이아웃에 없는 키(공백, 두벌식 숫자 등)는 `consumed:false` + 조합 확정. 레이아웃이 정의한 기호 치환(`lit`)은 기본 적용, `passthroughLiterals` 옵션으로 해제.

### 미검증 hooks
`hooks/register.tsx`, `hooks/editor.ts`의 **모든 Claude Code API 사용**이 미검증이다. 근거는 claude-vime 소스(README 기준 Claude Code 2.1.288)뿐이며 실제 세션에서 로드해 본 적이 없다. 박스 CLI는 2.1.278이라 버전도 다르다. `claude plugin test`/`validate` 통과는 "정적 검사 + 모의 엔진 테스트 통과"일 뿐 실동작 증거가 아니다.

---

## 3. claude-vime mod API 요약 (근거 경로)

저장소: `https://github.com/skanehira/claude-vime` (박스 클론: `/workspace/claude-vime`, HEAD `6c353e5`). README는 Claude Code 2.1.288 기준·early access API로 API가 릴리스 간 바뀔 수 있다고 명시.

| 항목 | 내용 | 근거 파일 |
|---|---|---|
| 매니페스트 | `.claude-plugin/plugin.json` (`name`, `version`, `description`, `author`, `types`) | `.claude-plugin/plugin.json` |
| 훅 모듈 등록 | `hooks/hooks.json` = `{ "modules": ["./register.tsx"] }` | `hooks/hooks.json` |
| 진입점 | `export const register: Register = on => { on('<event>', [filter,] async ($, e, next) => ...) }` | `hooks/register.tsx` |
| 세션 시작 | `on('session.start', …)`: 초기화, `$.command.register({name, description, immediate:true})`, `next(e)` 호출 | `hooks/register.tsx` |
| 슬래시 명령 | `on('command.run', { command: 'vime' }, async $ => ({ text }))` — 반환 `{text}`가 응답 | `hooks/register.tsx`, `hooks/register.test.tsx` |
| **키 가로채기** | `on('prompt.edit', …)`: 이벤트 `{ text, cursor, start, end, inputText, key? }`, `key = { key, ctrl?, shift?, meta? }`. 반환 `{ text, cursor, decorations }`면 키 소비, `next(e)`/수정된 편집이면 편집기가 처리 | `hooks/register.tsx`, `hooks/editor.ts`(Edit/Answer 타입, `applied()`) |
| 밑줄 표시 | `decorations: [{ start, end, underline:true, bold?, backgroundColor? }]` — 조합 글자는 입력창 텍스트에 실제로 들어 있음 | `hooks/editor.ts` |
| 전송 | `on('prompt.submit', …)`: Enter가 `prompt.edit`에 안 오고 곧바로 전송될 때 조합분 확정 | `hooks/register.tsx` |
| 상태줄 | `$.ui.status(text \| undefined)` (undefined = 지움) | `hooks/register.tsx`, `hooks/register.test.tsx` |
| 토스트 | `$.ui.toast(message)` | `hooks/register.tsx` |
| 입력창 위 렌더 | `on('ui.render', { component: 'AbovePrompt' }, …)` + `$.ui.resolve(e)` (후보 띠) | `hooks/register.tsx`, `hooks/band.ts` |
| 환경변수 | `$.env.get(name)` | `hooks/register.tsx` |
| 프로세스 | `$.process.run(argv, {timeoutMs})` (anthy 호출용; 우리는 불필요) | `hooks/register.tsx`, `hooks/anthy.ts` |
| 상태 공유 | `atom/read/update` (claude-code 모듈), 타입은 `types/index.d.ts`의 `PluginState` 확장 | `hooks/register.tsx`, `types/index.d.ts` |
| 키 관측 사실 | 일반 Enter는 `prompt.edit`에 안 옴(전송됨), option+화살표=`meta`, ctrl+화살표=`ctrl`, shift+화살표는 불안정, 키 이름은 문자 자체·Space=`space`·`backspace`·`left`/`right` | `hooks/editor.ts` 주석, `hooks/editor.test.ts` |
| 엔진이 먼저 넣은 키 | 비동기 응답 대기 중 친 키는 엔진이 raw로 넣음 → vime은 복구 로직(`last/guessed/raw`) 보유. 우리 코어는 동기라 불필요하다고 판단(**미검증**) | `hooks/editor.ts` |
| 토글 키 없음 | "어느 터미널에서나 mod까지 도달하는 키가 없다"며 `/vime` 명령으로만 토글 | `README.md` |
| Esc/vim | Esc는 mod에 안 닿음(취소키/노멀모드 전환). 노멀 모드 편집은 mod를 안 거침 | `README.md` |
| 다중 문자 편집 | 붙여넣기/묶음 키는 `key` 없이 `inputText.length>1`로 옴 | `hooks/editor.ts` |
| 테스트 | `claude plugin test .` (훅 모듈과 `hooks/*.test.ts(x)`를 Claude Code 자체 mod 런타임에서 실행), `import … from 'claude-code/testing'` (`test, expect, mock, describe`), `$.session.start`, `$.command.run`, `mock.env`, `on('process.run'|'ui.status'|…)` 스텁 | `hooks/register.test.tsx`, `README.md`, `.github/workflows/ci.yml` |
| 모듈 제약 | 훅 모듈은 **상대경로 import와 `claude-code`만** 허용(우리가 `bun:test` import로 직접 확인). `$`는 같은 파일 함수에만 전달 가능(다른 모듈 함수로 넘기면 `validate` 오류, 2.1.278에서 vime 자신이 이로 실패) | 박스 실측 |
| 타입 | `.claude-plugin/types/tsconfig.json`은 Claude Code가 플러그인 로드 시 생성(gitignore). `tsc -p .`로 검사 | `README.md`, `.gitignore`, `.github/workflows/ci.yml` |

---

## 4. 요구사항

### 4.1 레이아웃 (필수 3종)
| id | 이름 | kind | 비고 |
|---|---|---|---|
| `dubeolsik` | 두벌식 | dubeol | KS X 5002 계열. 시프트: Q W E R T O P 만 별도 자모, 나머지 대문자는 소문자와 동일 |
| `sebeolsik-390` | 세벌식 390 | sebeol | 초성=오른쪽, 종성=왼쪽, 모음=가운데. 숫자·기호 일부 치환(`lit`) |
| `sebeolsik-final` | 세벌식 최종 | sebeol | 겹받침 전용 키 전부 보유. 숫자 시프트 위치 |

매핑 출처: libhangul `data/keyboards/hangul-keyboard-{2,39,3f}.xml.template` (commit `5094421d9586294b2aad09924b9a54e2e6060f06`). 키별 대조: GNU Emacs `lisp/leim/quail/hangul.el`, uim `scm/byeoru.scm`. 자모는 세 구현 불일치 0. 세벌식 최종 `|` 만 uim 이 `₩`(표는 libhangul·Emacs 의 백슬래시). KS X 5002 PDF 와 한글문화원 인쇄 도표는 구하지 못해 **표준 원문 대조는 미확인**.

### 4.2 조합 규칙 (구현·테스트 완료, 회귀 금지)
1. 두벌식 **도깨비불**: `rkf`+`k` → `가라`; 겹받침은 뒤 자모만 이동(`닭`+`ㅣ` → `달기`); 쌍받침 ㄱㄱ은 분리(`낚`+`ㅣ` → `낙기`).
2. **겹받침** 11종(ㄳ ㄵ ㄶ ㄺ ㄻ ㄼ ㄽ ㄾ ㄿ ㅀ ㅄ) 및 쌍받침(ㄲ ㅆ). 두벌식은 자음 연타, 세벌식은 받침 키 연타 또는 전용 키.
3. **겹모음** 7종(ㅘ ㅙ ㅚ ㅝ ㅞ ㅟ ㅢ), 앞 모음 먼저. 받침이 있으면 결합하지 않음.
4. **자모 단위 백스페이스**: `글→그→ㄱ→(빈)`, `닭→달→다→ㄷ`, `와→오→ㅇ`. 조합이 없으면 편집기에 넘김(`consumed:false`).
5. **세벌식 순서 무관 조합**: 기본(`autoReorder` true, `HANGUL_SEBEOL_ORDER` 미설정)은 한 음절 안에서 초·중·종 6가지 순서가 모두 같은 글자. libhangul `option_auto_reorder=true` 와 같고, libhangul 기본값(false, `hangul_ic_new`)과는 다르다. `autoReorder: false` / `HANGUL_SEBEOL_ORDER=strict` 이면 역순은 확정한다. 겹모음은 종성이 없고 앞 모음이 먼저일 때만(libhangul 도 peek 가 중성일 때만 결합). macOS/Windows IME 실기 대조는 안 했다.
6. 확정 규칙: 공백·레이아웃에 없는 키·ctrl/meta 키·붙여넣기·커서 이동은 조합 확정 후 통과.

### 4.3 mod 껍데기 (**전부 미검증**)
- `/hangul` 토글, `/hangul on|off`, `/hangul 2|390|final`(선택 즉시 켬). `/한글` 은 쓰지 않는다. 2.1.289 명령 이름은 `^[a-zA-Z0-9_-]{1,64}$` 라 한글 이름은 등록되지 않았다(세션 로그에 `/hangul listed` 만 있고 `/한글` 은 없음).
- 시작 레이아웃: 환경변수 `HANGUL_LAYOUT=2|390|final` (기본 두벌식). `HANGUL_SEBEOL_ORDER=strict` 이면 세벌식 `autoReorder` 를 끈다(기본은 순서 무관). `$.store` 는 타입에 있으나 레이아웃 기억에는 쓰지 않는다. 세션 간 저장 실측은 안 했다.
- `command.run` 의 인자 필드명은 생성 타입 `CommandRunInput.args: string` 이다. 캐스트는 제거했다.
- 상태줄: 켜짐 `한 두벌식` / `한 세벌식 390` / `한 세벌식 최종`, 꺼짐 `undefined`(지움), reload 직후에도 지움. 표시 형식·길이 적합성 **미검증**.
- 끄면 조합 중인 글자는 입력창에 확정된 채 남음.

---

## 5. 엣지 케이스

| 항목 | 현재 처리 | 상태 |
|---|---|---|
| **붙여넣기**(여러 글자, `key` 없음) | 변환 없이 조합 확정 후 원문 그대로 | 실제 이벤트 모양 **미검증** |
| **vim 모드** | Esc는 mod에 안 닿음(README). 노멀 모드에서 입력창 텍스트가 바뀌면 조합 구간 불일치로 조합 폐기 | 실동작 **미검증** |
| **Enter 확정** | 일반 Enter는 `prompt.edit`에 안 오고 전송됨 → `prompt.submit`에서 조합 상태 정리(텍스트는 이미 입력창에 있음) | **미검증** |
| **한영 키 도달** | 설계상 의존하지 않음(`/hangul` 토글). 한/영·Caps Lock·Globe 키가 `prompt.edit`/`key`로 오는지 **미확인** | 실측 필요 |
| **세벌식 `/`** | 세벌식에서 `/`=ㅗ. 입력창 맨 앞 `/\S*` 구간(슬래시 명령 이름 입력 중)은 변환 없이 통과, 명령 이름 뒤 공백부터 다시 한글. 문장 중간 `/`는 ㅗ | 어댑터 테스트 통과, 실세션 **미검증** |
| 커서가 조합 구간 밖 | 기존 조합 확정, 해당 키는 새 조합 시작 | 모의 테스트만 |
| 선택영역 치환 | 확정 후 원문 통과 | **미검증** |
| 외부 변경 | 조합 구간 텍스트가 달라지면 조합 폐기 | 모의 테스트만 |
| ctrl/meta 조합 | 확정 후 통과 | **미검증** |
| 세벌식 숫자·기호 치환 | 표대로 적용(예: 390 `<`→`2`, 최종 `J`→`1`). libhangul·Emacs·uim 일치. KS/문화원 원문은 미확인. 최종 세로막대 키만 uim 이 `₩`(표는 백슬래시). `passthroughLiterals` 는 코드 옵션만, 명령에는 없음 | 명령 노출 안 함으로 결정 |
| Caps Lock | 대문자로 들어오면 두벌식은 소문자와 같고 세벌식은 시프트 키로 해석 | **미검증** |
| 비동기 대기 중 키 | 코어가 동기라 vime식 `raw` 복구 불필요하다고 가정 | **미검증** |

---

## 6. 남은 작업 (우선순위 순)

1. **실세션 로드 및 로그 확인** (최우선): Claude Code ≥ 2.1.288 환경(Cloud 에이전트 샌드박스에서 가능한 범위)에서 `claude --plugin-dir .`로 로드. `prompt.edit`에 들어오는 `{inputText,key,start,end}`를 로그로 남겨 §3·§5의 가정(키 이름, 붙여넣기 모양, backspace의 start/end, Enter, 한영/Caps 키)을 실측 후 SPEC 갱신. 실제 터미널 상호작용이 불가능하면 불가능했다고 명시하고 '미검증'으로 남길 것.
2. **tsc 타입체크**: 로드 시 생성되는 `.claude-plugin/types/tsconfig.json`을 확보한 뒤 `npx -p typescript@5.9.3 tsc -p .` 통과시키기. (vime CI는 `claude --plugin-dir . -p x` 를 무효 API 키로 실행해 타입만 생성시킴 — 우리도 실제 모델 호출·과금 없이 하는 방법만 사용.) `register.tsx`의 `(e as {args?:string})` 같은 우회 캐스트를 실제 타입으로 교체.
3. **매핑 공식 도표 대조**: libhangul 단일 출처 → KS X 5002(두벌식), 공병우 세벌식 390/최종 공식 배열도(공신력 있는 두 번째 출처)와 키별 대조. 불일치·미확인 행 정리하고 `core/layout-data.ts` 머리말/행 주석 갱신(생성 파일이므로 `tools/gen-layout.mjs` 수정). 특히 시프트·기호·숫자 행.
4. **실제 IME와 도깨비불 대조**: macOS/Windows 두벌식·세벌식 IME(또는 libhangul 동작)와 비교해 다음을 확정: 시프트 ㅆ/ㄲ 받침 + 모음(`았`+ㅏ), 쌍받침 ㄱㄱ 분리, 겹받침 분리 후 백스페이스 복원 여부, 세벌식 겹모음 순서 무관 여부. 결정을 테스트 이름에 "근거" 포함해 반영.
5. **상태줄**: `$.ui.status` 실표시 확인(길이, 한글 폭), reload 시 잔상 없음, 꺼짐 시 지움. 영문/한글 이중 표기 필요 여부 결정.
6. 명령 이름: `/한글` 허용 여부 실측. 불가하면 별칭 제거하고 README·SPEC 수정. `command.run`의 `args` 실제 필드명 확인(미확인이면 대안: 명령 3개 분리 등록).
7. 설정: 레이아웃 기억(환경변수 외 방법)이 필요한지 결정 — 필요하면 플러그인이 쓸 수 있는 설정 저장 API가 있는지부터 조사. 없으면 환경변수 유지.
8. 마무리: README를 실측 결과로 갱신, 미검증 표기 제거/유지 정리.

---

## 7. 검증 방법과 완료 기준

### 명령
```
bun run test                                   # core 단독
claude plugin test .                           # core + hooks (현재 111 통과)
claude plugin validate .claude-plugin/plugin.json
npx -p typescript@5.9.3 tsc -p .               # 타입 생성 후
```

### 완료 기준 (모두 충족)
- [ ] `claude plugin test .` 전부 통과, 테스트 수가 111개 미만으로 줄지 않음(기존 규칙 회귀 금지).
- [ ] `claude plugin validate` 통과, `tsc -p .` 오류 0.
- [ ] §6-3 매핑 대조 완료: 3개 레이아웃의 모든 `cho/jung/jong` 키가 두 출처 이상으로 확인되었거나, 불일치 키가 목록으로 문서화됨.
- [ ] §6-4 도깨비불·백스페이스 규칙이 실제 IME 또는 libhangul 동작과 대조되어 결정 근거가 테스트/SPEC에 기록됨.
- [ ] 실세션 로그로 §5의 "한영 키 도달", "붙여넣기", "vim 모드", "Enter" 항목이 각각 '확인됨' 또는 '실측 불가(사유)'로 바뀜.
- [ ] 두벌식 `gksrmf`→`한글`, 세벌식 390 `mfskgw`→`한글`, 세벌식 최종 `mfskgw`→`한글`이 **실제 Claude Code 입력창**에서 재현(가능한 환경이면). 불가하면 불가 사유를 보고서에 기재.
- [ ] 미검증 항목이 남으면 코드(`TODO`)·README·SPEC 모두에 '미검증'으로 일관되게 표시.
- [ ] 기대값을 규칙/표에서 도출하지 못한 테스트를 추가하지 않음(근거 없는 값 금지).

---

## 8. 하지 말 것

- **맥(또는 사용자 로컬 환경)에 설치·설정 변경 금지**: `claude plugin install`, `/plugin marketplace add`, 사용자 `~/.claude` 수정, 키 바인딩·시스템 입력기 설정 변경 금지. 작업은 Cloud 샌드박스/박스의 `claude-hangul` 디렉터리 안에서만.
- **머지 금지**: PR을 만들더라도 머지하지 않는다(사람 승인 후 사용자가 머지). main/기본 브랜치에 직접 푸시 금지. 레포 생성·푸시가 필요하면 먼저 사용자 승인을 받는다.
- 외부에 보이는 행위(이슈·PR 코멘트, 메시지 전송, 마켓플레이스 배포) 금지.
- 실제 모델 호출·API 키 사용·과금이 드는 실행 금지(타입 생성은 무효 키 방식 등 비과금 방법만, 그것도 사용자 승인 하에).
- 근거 없는 값 창작 금지: 키 매핑·IME 동작을 모르면 코드와 문서에 '미확인'/'미검증'으로 남긴다.
- claude-vime 소스 코드를 그대로 복사해 붙이지 않는다(§9).

---

## 9. 라이선스

### claude-vime (`skanehira/claude-vime`)
- 확인 결과: 박스 클론(`/workspace/claude-vime`)에 `LICENSE`/`COPYING` 파일이 **없음**. `README.md`, `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json` 어디에도 라이선스 표기 **없음**. GitHub 웹 페이지 요약에서도 라이선스 정보가 보이지 않았고, GitHub API 조회는 rate limit으로 실패.
- 결론: **라이선스 미확인(명시된 라이선스 없음).** 일반적으로 라이선스가 없는 코드는 모든 권리가 저작자에게 유보된 것으로 취급하므로, 재사용 허락이 있다고 가정하지 않는다.
- 조치: claude-vime에서는 **구조와 API 사용 방식(사실·아이디어)만 참고**하고 코드를 복사하지 않는다. 현재 `hooks/register.tsx`, `hooks/editor.ts`의 타입 정의, `hooks/*.test.*`의 하네스는 vime의 구조를 따라 새로 쓴 것이지만 모양이 매우 유사하므로, **Cloud 에이전트는 공개 전에 유사 부분을 검토해 필요하면 독자적으로 다시 쓰거나, 저작자(skanehira)에게 라이선스 확인/허락을 요청하도록 사용자에게 보고**한다(요청 메시지 발송은 사용자 승인 필요).

### libhangul (`libhangul/libhangul`)
- 키 매핑 데이터의 출처. 저장소 `COPYING`은 GNU LGPL v2.1. `core/layout-data.ts`는 "어느 키가 어느 자모인가"라는 사실 데이터만 옮긴 생성물이며 libhangul 코드는 포함하지 않았다. 다만 공개 배포 시 이 파일의 데이터 출처 표기와 LGPL 적용 여부에 대한 판단은 **미검증**(법률 검토 아님) — 대조 작업(§6-3)에서 공식 도표 기반으로 표를 재구성하면 의존을 줄일 수 있다.

### 이 프로젝트
- 라이선스 미정(사용자 결정 필요). 결정 전에는 `package.json`의 `"private": true` 유지.

---

## 10. 인계 시 참고 사실

- 박스의 claude CLI는 `2.1.278`, vime README 기준은 `2.1.288`. 이 차이로 vime 자체 테스트가 120개 중 4개 실패(`update($, …)` 교차 import 오류)하는 것을 확인함 → 버전 의존성 주의.
- `claude plugin test`는 `core/*.test.ts`도 수집하므로 테스트 파일은 `claude-code/testing`에서만 import할 것(`bun:test` import 금지).
- `core/layout-data.ts`는 생성 파일. 직접 수정하지 말고 `tools/gen-layout.mjs`를 고쳐 재생성(libhangul 클론 경로는 인자). 현재 박스의 클론은 `/workspace/ref/libhangul` (인계 시 포함되지 않을 수 있음 — 필요하면 재클론).
- 현재 `git`은 `init`만 되어 있고 커밋이 없다.
