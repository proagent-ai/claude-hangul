# claude-hangul

Claude Code 프롬프트에서 OS 한글 IME 없이 두벌식, 세벌식 390, 세벌식 최종을 친다.

제품 요구는 [docs/PRD.md](docs/PRD.md), 구현 근거는 [SPEC.md](SPEC.md).

## 설치

```bash
git clone https://github.com/proagent-ai/claude-hangul.git
cd claude-hangul
git checkout develop
claude --plugin-dir .
```

Claude Code 2.1.287 이상. 이 저장소는 `~/.claude` 에 설치하지 않는다.

## 사용

| 명령 | 동작 |
|---|---|
| `/hangul` | 켜기 / 끄기 |
| `/hangul on` `off` | 명시적으로 켜거나 끈다 |
| `/hangul 2` `390` `final` | 레이아웃을 바꾸고 켠다 |

`/hangul` 줄의 인자는 영어 그대로다. `off` 가 한글로 바뀌지 않는다.
상태줄은 `한 두벌식`, `한 세벌식 390`, `한 세벌식 최종` 이다.

시작 레이아웃은 `HANGUL_LAYOUT=2|390|final`. 세벌식 역순 확정은 `HANGUL_SEBEOL_ORDER=strict`.

## 한글과 그 밖의 글자

공백이나 기호 전까지를 한 단어로 본다.

- 그 단어가 완성 음절뿐이면 한글이다. 두벌식 `gksrmf`, 세벌식 `mfskgw` 는 `한글`.
- 음절이 아닌 조각이 확정되면 그 단어는 친 키 그대로다. 세벌식 `hello` 는 `hello` 다.
- 숫자만인 단어(`390`, `123`)는 숫자다. `?` `,` `!` 처럼 표에 없는 기호는 친 문자다.
- 두벌식 숫자·기호는 친 문자 그대로다.
- 한 음절로 끝나는 짧은 영어는 한글으로 남는다. 두벌식 `to` 는 `새`.

세벌식 시프트 숫자·기호는 레이아웃 표대로 바뀐다. 390 `J K L` 은 `4 5 6`, `B` 는 `!`. 최종 `J` 는 `1`, `B` 는 `?`.
세벌식은 숫자가 시프트 자리에만 있어 치환하지 않으면 칠 방법이 없다.
기호 키는 단어의 일부라서, 그 단어가 영어로 판정되면 친 키로 돌아간다. 390 `Hello` 는 `Hello`.
치환을 끄려면 코드에서 `passthroughLiterals: true`. 명령에는 없다.

## 테스트

```bash
bun run test
claude plugin test .
claude plugin validate .claude-plugin/plugin.json
npx -p typescript@5.9.3 tsc -p .
```

`claude plugin test .` 는 139개 통과 (CLI 2.1.289).

## 구성

- `core/` — 조합 상태머신. Claude Code API에 의존하지 않는다.
- `hooks/` — `prompt.edit` 어댑터와 `/hangul` 등록.
- `tools/gen-layout.mjs` — libhangul 키보드 XML로 `core/layout-data.ts` 를 만든다.
