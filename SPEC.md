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
- `bun run test` → core 106 통과 / 0 실패.
- `claude plugin test .` → **135 통과 / 0 실패**.
- `claude plugin validate .claude-plugin/plugin.json` → 통과.
- `tsc` 타입체크: **미수행**(§6 참고).

### 코어 규칙 요약 (구현 완료·테스트됨)
- 두벌식: 자음은 문맥으로 초/종성 결정, 도깨비불(받침→다음 모음 초성; 겹받침은 뒤 자모만; 직접 친 시프트 ㄲ/ㅆ 받침은 통째로 이동), 겹받침 11종 + ㄱㄱ→ㄲ, ㅅㅅ→ㅆ, 겹모음 7종, 시프트 쌍자음, ㄸㅃㅉ는 받침 불가.
- 세벌식: 키가 초/중/종 고정, 도깨비불 없음. 한 음절 안에서 초·중·종 **입력 순서 무관**(빈 칸에 채움, 찬 칸에 같은 역할이 오면 결합 규칙 없을 때 확정 후 새 음절). 초성 겹치기는 중·종성이 비었을 때만, 겹모음은 종성이 비었고 앞 모음이 먼저일 때만, 겹받침은 받침 키 두 개로도 직접 키로도 가능.
- 단어(공백·기호 전)가 완성 음절만이면 한글. 음절이 아닌 조각이 확정되거나, 단어가 끝날 때 한글과 낱자가 섞이면 그 단어 전체를 친 키로 되돌린다. 세벌식 `hello` 는 `hello`, `390` 같은 숫자 단어는 숫자, 표에 없는 기호는 친 문자. 한 음절로 끝나는 영어(`to`→`새`)는 한글으로 남는다.
- 백스페이스: 아직 끝나지 않은 단어에서 마지막 키를 지우고 다시 조합한다. 단어가 없으면 `consumed:false`.
- 레이아웃에 없는 키(공백 등)는 `consumed:false` + 단어 확정. 기호 치환(`lit`)은 기본으로 세벌식 표대로 하고 단어의 일부로 다룬다(단어가 음절이 아니면 기호 키도 친 키로 되돌림). `passthroughLiterals: true` 면 친 문자를 통과시킨다.

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
4. **열린 단어 백스페이스**: 공백·기호 전의 단어에서 마지막 키를 지우고 다시 조합한다. `글→그→r→(빈)`, `닭→달→다→e`. 단어가 없으면 편집기에 넘김(`consumed:false`).
5. **세벌식 순서 무관 조합**: 기본(`autoReorder` true, `HANGUL_SEBEOL_ORDER` 미설정)은 한 음절 안에서 초·중·종 6가지 순서가 모두 같은 글자. libhangul `option_auto_reorder=true` 와 같고, libhangul 기본값(false, `hangul_ic_new`)과는 다르다. `autoReorder: false` / `HANGUL_SEBEOL_ORDER=strict` 이면 역순은 확정한다. 겹모음은 종성이 없고 앞 모음이 먼저일 때만(libhangul 도 peek 가 중성일 때만 결합). macOS/Windows IME 실기 대조는 안 했다.
6. 확정 규칙: 공백·레이아웃에 없는 키·ctrl/meta 키·붙여넣기·커서 이동은 조합 확정 후 통과.

### 4.3 mod 껍데기
- `/hangul` 토글, `/hangul on|off`, `/hangul 2|390|final`(선택 즉시 켬). `/한글` 은 쓰지 않는다. 2.1.289 명령 이름은 `^[a-zA-Z0-9_-]{1,64}$` 라 한글 이름은 등록되지 않았다(세션 로그에 `/hangul listed` 만 있고 `/한글` 은 없음).
- 시작 레이아웃: 환경변수 `HANGUL_LAYOUT=2|390|final` (기본 두벌식). `HANGUL_SEBEOL_ORDER=strict` 이면 세벌식 `autoReorder` 를 끈다(기본은 순서 무관). `$.store` 는 타입에 있으나 레이아웃 기억에는 쓰지 않는다. 세션 간 저장 실측은 안 했다.
- `command.run` 의 인자 필드명은 생성 타입 `CommandRunInput.args: string` 이다. 캐스트는 제거했다.
- 상태줄에 넣는 문자열: 켜짐 `한 두벌식` / `한 세벌식 390` / `한 세벌식 최종`, 꺼짐 `undefined`. 2.1.289 화면에는 엔진이 `⚠ hangul: ` 을 앞에 붙여 `⚠ hangul: 한 두벌식` 처럼 보인다. 이 세 문자열은 그 세션 폭에서 한 줄에 들어갔다. 더 좁은 폭은 안 재었다. 영문 이중 표기는 넣지 않는다.
- 명령 반환 텍스트는 `on (두벌식)` / `off` 만 둔다. 엔진이 `hangul: ` 을 붙인다. `hangul:` 을 또 넣으면 화면이 `hangul: hangul: on` 이 됐다.
- 끄면 조합 중인 글자는 입력창에 확정된 채 남음.

---

## 5. 엣지 케이스

| 항목 | 현재 처리 | 상태 |
|---|---|---|
| **붙여넣기**(여러 글자, `key` 없음) | 변환 없이 조합 확정 후 원문 그대로 | **확인됨.** bracketed paste `hello` → `key: null`, `inputText: "hello"`. 화면 `한그hello` |
| **vim 모드** | Esc·노멀 모드 키는 `prompt.edit` 에 안 온다. 다음 입력 키의 `text` 가 조합 중인 글자와 다르면 조합을 버린다 | **확인됨** (아래 §11). `x` 가 음절을 지운 뒤 `k` → `ㅏ` |
| **Enter 확정** | `prompt.edit` 에 `return` 이 없고 `prompt.submit` 의 `text` 로 전송. 훅은 텍스트를 유지하고 조합 상태만 정리 | **확인됨.** `한` 전송 시 `prompt.submit {"text":"한"}`. `return` 키 이벤트는 로그에 없음. 모델 호출은 무효 키로 401 |
| **한영 키 도달** | 설계상 의존하지 않음(`/hangul` 토글) | **실측 불가.** tmux `Hangul` / `Hangul_Hanja` 는 그 문자열이 붙여넣기처럼 들어갔고(`key: null`), 한영 키 이벤트는 만들지 못했다. Caps Lock 키도 넣지 못했다 |
| **세벌식 `/`** | 맨 앞 `/\S*` 는 통과, 문장 중간 `/` 는 ㅗ. `/hangul` 인자는 공백 뒤에도 영어 | 명령 이름은 확인됨. `/hangul off` 가 한글로 먹히던 것은 인자까지 통과하도록 고침 |
| 커서가 조합 구간 밖 | 기존 조합 확정, 해당 키는 새 조합 시작 | 모의 테스트만. 세션에서 커서 이동은 안 함 |
| 선택영역 치환 | 확정 후 원문 통과 | 어댑터 테스트만. 세션에서 선택영역 이벤트는 안 잡음 |
| 외부 변경 | 조합 구간 텍스트가 달라지면 조합 폐기 | vim `x` 로 확인 (위) |
| ctrl/meta 조합 | 확정 후 통과 | **ctrl 확인됨.** `ctrl+u` 가 `{key:"u",ctrl:true}`, `inputText:""`, `start:0`, `end` 는 줄 전체. meta 는 세션에서 안 보냄 |
| 세벌식 숫자·기호 | 기호(`lit`)는 기본으로 표 치환(390 `<`→`2`, 최종 `J`→`1`). 세벌식은 숫자가 시프트 자리에만 있어서다. `passthroughLiterals: true` 면 친 문자. 숫자만인 단어는 숫자. KS/문화원 원문은 미확인 | 명령 노출 안 함 |
| Caps Lock | 대문자로 들어오면 두벌식은 소문자와 같고 세벌식은 시프트 키로 해석 | Shift+G 는 **확인됨**: `{key:"G",shift:true}`, `inputText:"G"`, 세벌식 최종에서 `ㅒ`. Caps Lock 키 자체는 **실측 불가** (주입 못 함) |
| 비동기 대기 중 키 | 코어가 동기라 vime식 `raw` 복구 불필요하다고 가정 | **미검증** |

---

## 6. 남은 작업 처리 (2026-10-04)

1. 실세션 로드와 `prompt.edit` 페이로드: §11. 한영 키만 실측 불가.
2. `tsc -p .` (typescript 5.9.3) 오류 0. `e.args` 캐스트 제거. `layouts.ts` 의 중복 `세벌식390` 제거.
3. 키 대조: libhangul + Emacs `hangul.el` + uim `byeoru.scm`. 자모 불일치 0. KS X 5002·한글문화원 원문 도표는 **미확인**. 최종 `|` 만 uim `₩`.
4. 도깨비불은 libhangul `hangul_ic_process_jamo` / `hangul_jongseong_get_diff` 와 같게 유지. macOS·Windows IME 실기는 안 했다. 세벌식 순서 무관은 기본값(`autoReorder` true). libhangul 기본은 false. `HANGUL_SEBEOL_ORDER=strict` 로 끈다.
5. 상태줄: §4.3. 영문 이중 표기 없음. reload 직후 잔상은 이 세션에서 플러그인 리로드를 하지 않아 **미검증**.
6. `/한글` 제거. `args` 는 `CommandRunInput.args`.
7. 레이아웃 기억은 환경변수만. `$.store` 는 타입에 있으나 세션 간 저장은 실측하지 않아 쓰지 않는다.
8. README 를 이 실측으로 고쳤다.

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
- [x] `claude plugin test .` 123 pass / 0 fail (2.1.289). 111개 미만으로 줄지 않음.
- [x] `claude plugin validate` 통과, `tsc -p .` (typescript 5.9.3) 오류 0.
- [x] 자모 키는 libhangul·Emacs·uim 세 출처 일치. 불일치 1키(세벌식 최종 `|`, uim 만 `₩`)를 `layout-data.ts` 에 적음. KS/문화원 원문은 미확인.
- [x] 도깨비불·백스페이스 근거를 libhangul 소스와 테스트 이름에 적음. OS IME 실기는 안 했다.
- [x] §5 의 한영 키(실측 불가), 붙여넣기(확인됨), vim(확인됨), Enter(확인됨).
- [x] 입력창 재현: 두벌식 `gksrmf`→`한글`, 세벌식 390 `mfskgw`→`한글`, 세벌식 최종 `mfskgw`→`한글`.
- [x] 남은 미검증(한영 키, Caps Lock 키, 선택영역, 밑줄의 화면 표시, 상태줄 reload 잔상, `$.store`)은 코드 TODO·README·이 문서에 적었다.
- [x] 추가 테스트의 기대값은 키 표·libhangul 분기·어댑터 규칙에서 나왔다.

## 11. 실측 기록 (2026-10-04, CLI 2.1.289)

격리된 `HOME`(`/tmp/claude-tty4`)에서 `HANGUL_TRACE=1 claude --plugin-dir .`. 사용자 `~/.claude` 는 건드리지 않았다. API 키는 무효 값이라 전송은 401 이었다.

`prompt.edit` 한 글자 (두벌식, 직전 초안이 빈 칸):

```json
{"key":{"key":"g"},"inputText":"g","start":0,"end":0,"cursor":0,"text":""}
```

이어서 `k` 의 `text` 는 `ㅎ`, `s` 는 `하`, `r` 은 `한`. 화면은 `한글`. 세벌식 390·최종의 `mfskgw` 도 화면이 `한글` 이었다.

백스페이스: `{"key":{"key":"backspace"},"inputText":"","start":1,"end":2,"cursor":2,"text":"한글"}` → 화면 `한그`.

붙여넣기: `{"key":null,"inputText":"hello","start":2,"end":2,"cursor":2,"text":"한그"}` → `한그hello`.

`ctrl+u`: `{"key":{"key":"u","ctrl":true},"inputText":"","start":0,"end":7,"cursor":7,"text":"한그hello"}`.

Enter: `prompt.edit` 에 `return` 없음. `prompt.submit {"text":"한"}`. 이어서 `API key is invalid` 401.

vim (`settings.json` `editorMode` 를 격리 홈에만 `"vim"`): insert 에서 `gks`→`한`. Esc 와 노멀 `x` 는 `[hangul]` 로그가 없다. `x` 로 칸이 빈 뒤 insert `k` 는 `text:""` 로 들어와 `ㅏ`.

한영 키: tmux 키 이름 `Hangul` 은 `inputText:"Hangul"`, `key:null` 이었다. 한영 전환 이벤트는 **못 만들었다.**

밑줄 decoration 이 터미널 속성에 보이는지는 이 캡처에서 확인하지 못했다. **미검증.**

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

- 이 샌드박스의 claude CLI 는 `2.1.289`. 예전 박스의 `2.1.278` 은 mods 가 없어 로드가 실패했다.
- `claude plugin test`는 `core/*.test.ts`도 수집하므로 테스트 파일은 `claude-code/testing`에서만 import할 것(`bun:test` import 금지).
- `core/layout-data.ts`는 생성 파일. 직접 수정하지 말고 `tools/gen-layout.mjs`를 고쳐 재생성(libhangul 클론 경로는 인자). 현재 박스의 클론은 `/workspace/ref/libhangul` (인계 시 포함되지 않을 수 있음 — 필요하면 재클론).
- 작업 브랜치는 `cursor/hangul-session-verify-4c99`. main 에 직접 푸시하지 않는다.
