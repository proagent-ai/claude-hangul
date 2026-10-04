# claude-hangul (프로토타입)

Claude Code 프롬프트 입력창에서 OS IME 없이 한글을 직접 조합하는 mod 프로토타입.
[claude-vime](https://github.com/skanehira/claude-vime) 의 구조(`prompt.edit` 가로채기 + `/명령` 토글 + 상태줄)를 참고했다.

> 상태: 조합 코어와 어댑터 테스트가 있고, Claude Code 2.1.289 샌드박스 세션에서 로드는 확인했다. 입력창 재현·한영 키 등 실측 범위는 SPEC.md §5 를 본다. 사용자 `~/.claude` 에는 설치하지 않았다.

## 구성
- `core/` — UI/API 무관 순수 TypeScript. `HangulComposer.feed(ch) / backspace() / flush()`.
  - `layout-data.ts` 키 매핑(생성 파일; 출처 libhangul, 미확인 표시는 파일 머리말·행 주석), `jamo.ts` 자모표·결합표, `composer.ts` 상태머신
  - 레이아웃: `dubeolsik`, `sebeolsik-390`, `sebeolsik-final`
- `hooks/` — mod 껍데기: `register.tsx`(훅 등록), `editor.ts`(prompt.edit ↔ 코어 어댑터)
- `tools/gen-layout.mjs` — libhangul XML → `core/layout-data.ts` 생성기

## 사용
`/hangul` 토글, `/hangul on|off`, `/hangul 2|390|final`(선택하면 켜짐).
명령 이름은 영문만 된다. `/한글` 은 Claude Code 가 거부한다(이름은 영문·숫자·`_`·`-`).
환경변수 `HANGUL_LAYOUT=2|390|final` 로 시작 레이아웃. `HANGUL_SEBEOL_ORDER=strict` 이면 세벌식 역순을 확정한다(기본은 순서 무관).
`HANGUL_TRACE=1` 이면 `prompt.edit` / `prompt.submit` 요약을 디버그 로그에만 남긴다.
상태줄은 켜짐 `한 두벌식` / `한 세벌식 390` / `한 세벌식 최종`, 꺼짐이면 지운다. 한글 폭이 상태줄에 맞는지 실측은 SPEC 을 본다.

## 테스트
```
bun run test      # core 만 (bun)         — 91 통과
claude plugin test .   # core + hooks 전체 — 111 통과 (CLI 2.1.278 에서)
claude plugin validate .claude-plugin/plugin.json
```

## 규칙 요약 / 설계 선택
- 두벌식: 도깨비불(받침→다음 모음 초성), 겹받침 11종 + 쌍받침(ㄲ ㅆ), 겹모음 7종, 시프트 쌍자음.
- 세벌식: 키가 초/중/종 고정. 기본은 한 음절 안에서 초·중·종 **순서 무관**(빈 칸에 채움). 이것은 libhangul 의 `option_auto_reorder=true` 와 같고, libhangul 기본값(false, 역순이면 확정)과는 다르다. `autoReorder: false` 또는 `HANGUL_SEBEOL_ORDER=strict` 로 기본 libhangul 쪽에 맞출 수 있다. 겹모음은 종성이 없고 앞 모음이 먼저일 때만(ㅗ→ㅏ).
- 두벌식 도깨비불: 겹받침은 뒤 자모만 넘긴다(낚+ㅣ→낙기). 시프트로 한 번에 넣은 ㅆ/ㄲ 는 한 덩어리로 넘긴다(았+ㅏ→아싸, 갂+ㅏ→가까). 근거는 libhangul `hangul_ic_process_jamo` / `hangul_jongseong_get_diff`. macOS·Windows IME 와는 대조하지 못했다.
- 백스페이스: 조합 중인 음절만 자모 단위로 되돌린다. 이미 확정된 글자는 복원하지 않는다(libhangul 도 commit 후 버퍼를 비운다).
- 세벌식 390/최종의 숫자·기호는 표대로 적용한다(`passthroughLiterals: true` 로 끌 수 있으나 명령에는 없다). 자모·기호는 libhangul·Emacs·uim 과 맞았고, KS X 5002·한글문화원 원문 도표는 미확인. 예외: 세벌식 최종 `|` 는 백슬래시(libhangul·Emacs). uim 만 `₩`.

## 설치
이 디렉터리를 `--plugin-dir` 로 지정한다. 예: `claude --plugin-dir .`
`claude plugin install` 이나 사용자 `~/.claude` 수정은 하지 않는다. `package.json` 은 `"private": true` 다.

Claude Code 2.1.287 이상에서 mods 가 기본으로 켜진다. 이 작업의 실세션은 2.1.289.

## 한계 (실측 전후는 SPEC.md)
- 한영·Caps Lock·Globe 키에는 의존하지 않는다. 전환은 `/hangul`.
- 붙여넣기는 변환하지 않는다.
- 슬래시 명령 이름(`/` 로 시작해 공백 전)은 세벌식에서도 ㅗ로 바꾸지 않는다. 문장 중간의 `/` 는 ㅗ.
- Enter 는 조합을 확정하고 전송한다. 입력창에 이미 있는 글자를 다시 쓰지 않는다.
- 상태줄 한글 폭, vim 모드, 한영 키가 `prompt.edit` 로 오는지는 세션에서 확인한 만큼만 SPEC 에 적는다. 확인 못 한 것은 미검증이다.
