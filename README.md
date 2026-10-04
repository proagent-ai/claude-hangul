# claude-hangul (프로토타입)

Claude Code 프롬프트 입력창에서 OS IME 없이 한글을 직접 조합하는 mod 프로토타입.
[claude-vime](https://github.com/skanehira/claude-vime) 의 구조(`prompt.edit` 가로채기 + `/명령` 토글 + 상태줄)를 참고했다.

> 상태: **코어는 테스트됨, Claude Code 쪽 껍데기는 미검증.** 실제 세션에서 로드해 본 적 없음. 맥 등 사용자 환경에는 설치하지 않았다.

## 구성
- `core/` — UI/API 무관 순수 TypeScript. `HangulComposer.feed(ch) / backspace() / flush()`.
  - `layout-data.ts` 키 매핑(생성 파일; 출처 libhangul, 미확인 표시는 파일 머리말·행 주석), `jamo.ts` 자모표·결합표, `composer.ts` 상태머신
  - 레이아웃: `dubeolsik`, `sebeolsik-390`, `sebeolsik-final`
- `hooks/` — mod 껍데기: `register.tsx`(훅 등록), `editor.ts`(prompt.edit ↔ 코어 어댑터)
- `tools/gen-layout.mjs` — libhangul XML → `core/layout-data.ts` 생성기

## 사용(설계 의도, 미검증)
`/hangul` 토글, `/hangul 2|390|final` 레이아웃 선택(켜짐), `/한글` 별칭(허용 여부 미검증),
환경변수 `HANGUL_LAYOUT=2|390|final` 로 시작 레이아웃. 상태줄 `한 두벌식` 등.

## 테스트
```
bun run test      # core 만 (bun)         — 91 통과
claude plugin test .   # core + hooks 전체 — 111 통과 (CLI 2.1.278 에서)
claude plugin validate .claude-plugin/plugin.json
```

## 규칙 요약 / 설계 선택
- 두벌식: 도깨비불(받침→다음 모음 초성), 겹받침 11종 + 쌍받침(ㄲ ㅆ), 겹모음 7종, 시프트 쌍자음.
- 세벌식: 키가 초/중/종 고정. 한 음절 안에서 초·중·종 입력 **순서 무관**(빈 칸에 채움). 겹모음은 앞 모음 먼저(ㅗ→ㅏ)만 — 설계 선택, 실제 IME와의 대조는 미확인.
- 백스페이스: 조합 중인 음절 안에서 입력 이전 상태로(자모 단위). 확정된 글자는 편집기가 지움.
- 세벌식 390/최종의 숫자·기호 치환(`<`→`2` 등)은 표 그대로 적용(옵션 `passthroughLiterals` 로 끌 수 있음). 해당 행은 모두 '미확인'.

## 미검증 / 미확인 (요약)
`hooks/*` 의 모든 Claude Code API 사용, 한글 슬래시 명령 이름, `command.run` 의 `args`, 한영 전환 키 도달 여부,
vim 모드 상호작용, 붙여넣기 동작, 키 매핑표의 독립 문헌 대조(libhangul 단일 출처), 시프트 ㅆ 받침 도깨비불의 실제 IME 동작.
