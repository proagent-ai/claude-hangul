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
화면의 명령 결과는 `hangul: on (두벌식)` 처럼 보인다. 훅이 돌려주는 문자열은 `on (두벌식)` / `off` 이고, `hangul:` 은 엔진이 붙인다.
명령 이름은 영문만 된다. `/한글` 은 Claude Code 가 거부한다(이름은 영문·숫자·`_`·`-`).
환경변수 `HANGUL_LAYOUT=2|390|final` 로 시작 레이아웃. `HANGUL_SEBEOL_ORDER=strict` 이면 세벌식 역순을 확정한다(기본은 순서 무관).
`HANGUL_TRACE=1` 이면 `prompt.edit` / `prompt.submit` 요약을 디버그 로그에만 남긴다.
상태줄 문자열은 `한 두벌식` / `한 세벌식 390` / `한 세벌식 최종` 이다. 2.1.289 화면에는 `⚠ hangul: 한 두벌식` 처럼 엔진 접두가 붙고, 그 세 줄은 한 줄에 들어갔다. 꺼지면 지운다.

## 테스트
```
bun run test      # core 만 (bun)
claude plugin test .   # core + hooks — 123 pass / 0 fail (CLI 2.1.289)
claude plugin validate .claude-plugin/plugin.json
npx -p typescript@5.9.3 tsc -p .   # 오류 0
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

## 2026-10-04 실세션 (Claude Code 2.1.289, 샌드박스, 무효 API 키)
확인됨: 플러그인 로드, `/hangul`·`/hangul 390`·`/hangul final`, 두벌식 `gksrmf`→`한글`, 세벌식 390/최종 `mfskgw`→`한글`, 백스페이스가 `한글`→`한그`, 붙여넣기 `hello` 는 그대로, 세벌식 최종 `j/f`→`와` 와 맨 앞 `/ab` 유지, Shift+G 는 `{key:"G",shift:true}`, Enter 는 `prompt.submit` 만(`return` 키 없음), vim insert 에서 조합되고 Esc·노멀 `x` 는 훅에 안 오며 다음 입력이 깨진 조합을 버린다.

실측 불가: 한영 키, Caps Lock 키, Globe. tmux 로 그 키를 넣지 못했다. 선택영역 치환, 조합 밑줄이 화면에 그려지는지, 플러그인 reload 후 상태줄 잔상, `$.store` 도 이 세션에서 안 봤다.

## 한계
- 한영·Caps Lock·Globe 에는 의존하지 않는다. 전환은 `/hangul`. 한영 키가 이벤트로 오는지는 **미검증** (`hooks/editor.ts` TODO).
- 붙여넣기와 한 번에 묶인 키(`key` 없음)는 변환하지 않는다.
- 슬래시 명령 이름(`/` 로 시작해 공백 전)은 세벌식에서도 ㅗ로 바꾸지 않는다. 문장 중간의 `/` 는 ㅗ.
- Enter 는 조합 상태만 정리하고, 입력창에 있는 글자를 전송한다.
- macOS/Windows IME 와는 대조하지 않았다. 도깨비불 근거는 libhangul 소스다.
- claude-vime 은 LICENSE 가 없어 코드를 복사하지 않았다. 구조만 참고했다. 공개 전에 유사 부분을 사람이 한 번 더 보는 것이 좋다. 라이선스 확인 요청은 보내지 않았다.
