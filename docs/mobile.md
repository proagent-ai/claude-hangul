# 모바일에서 쓰기

외장 키보드 + 터미널 앱(SSH/mosh)이나 [Orca](https://github.com/stablyai/orca) 같은 원격 터미널로 호스트의 Claude Code에 접속하는 경우를 다룬다.
Claude 앱, Remote Control, claude.ai/code 클라우드 세션에서는 동작하지 않는다(이유는 [ROADMAP](ROADMAP.md#범위부터)).

## 체크리스트

- [ ] 기기 입력 언어: **영어** (한국어 키보드는 지우거나 쓰지 않는다)
- [ ] 언어 전환 끄기: iPad 설정 > 일반 > 키보드 > 하드웨어 키보드 > **Caps Lock으로 언어 전환** 끄기. Globe·⌃Space 전환도 쓰지 않는다
- [ ] 자동 수정·추천 단어 끄기
- [ ] mosh라면 `mosh --predict=never` (`-n`)
- [ ] 터미널 앱이 한글 폰트를 보여 준다
- [ ] 접속한 쪽 locale이 UTF-8 (`locale` 에 `UTF-8` 이 보인다)
- [ ] 호스트 셸 프로필에 `export HANGUL_LAYOUT=390` (또는 `final`, `2`). `/hangul` 만 치면 그 레이아웃으로 켜진다

## 증상 → 원인

| 증상 | 원인 | 할 일 |
|---|---|---|
| 자모가 흩어진다 (`ㅎㅏㄴ`), 글자가 사라진다 | 기기 입력 언어가 한국어다. OS 입력기의 조합 과정을 Claude Code가 제대로 받지 못한다(#15705, #23226) | 입력 언어를 영어로 |
| 세벌식인데 숫자·기호·겹받침이 나온다 | Caps Lock이 켜져 있다. 세벌식은 시프트 자리에 숫자·기호·겹받침이 있다 | Caps Lock 끄기, 언어 전환을 Caps Lock에서 떼기 |
| 친 영어가 잠깐 보였다가 한글로 바뀐다 | mosh 예측 에코가 서버 응답보다 먼저 친 키를 보여 준다 | `mosh -n` |
| 빠르게 치면 한글 대신 영어 원문이 들어간다 | 지연으로 키가 9글자 이상 한 번에 와서 붙여넣기로 판정됐다 | 로그를 남겨 이슈로 알려 주세요(아래). 판정 기준을 실측으로 바꾸는 중이다 |
| 한/영을 눌러야 할 것 같다 | 누를 필요 없다. 한글 단어는 한글로, 영어 단어는 친 그대로 남는다 | `/hangul` 상태줄이 `한 …` 인지 확인 |

## 앱별로 알려진 것

작성자가 직접 확인한 조합은 아래 표에 채운다. 그 밖은 공개 자료 기준이고 실기로 확인하지 않았다.

| 기기 | 앱 | 경로 | 결과 | 확인일 |
|---|---|---|---|---|
| Android 태블릿 + 외장 키보드 | Orca ADE 모바일 원격 | Orca → Mac 터미널의 Claude Code | 잘 된다 | 2026-10-08 |

- **iOS/iPadOS 공통**: OS 한글 입력기 상태로 Claude Code에 치면 자모가 깨진다([claude-code #15705](https://github.com/anthropics/claude-code/issues/15705), [#23226](https://github.com/anthropics/claude-code/issues/23226), [Blink #2134](https://github.com/blinksh/blink/issues/2134)). 영어 입력에 두고 claude-hangul을 쓰면 키가 ASCII로 가서 이 문제를 피한다.
- **Blink Shell**: Option을 Meta(ESC 접두)로 보내도록 설정할 수 있다.
- **Termius**: Alt 동작이 설정 토글이다. #15705에 따르면 Android Termius는 OS 한글 입력기로도 깨지지 않는다. 두벌식 Android 사용자에게는 claude-hangul이 꼭 필요하지 않을 수 있다.
- **Termux (Android)**: 외장 키보드 키는 키 이벤트로 들어온다. 한국어 입력기가 켜져 있으면 그 입력기가 먼저 조합할 수 있으니 입력 언어는 영어로 둔다.
- **mosh**: 끊겼다 이어지면 쌓인 키를 한 번에 보낸다. 묶음이 길어질 수 있다.
- **tmux**: 중간에 끼면 키 묶음 모양이 달라질 수 있다.

## 문제를 알릴 때

호스트에서 이렇게 띄우고 문제가 나는 문장을 친다.

```bash
HANGUL_TRACE=1 claude --debug
```

디버그 로그에 `prompt.edit {...}` 줄이 키마다 남는다. `keyField`(엔진이 키 정보를 어떻게 보내는지), `len`(한 번에 온 글자 수)이 판정 개선에 필요한 값이다.
이슈에 다음을 같이 적어 주세요: 기기, 터미널 앱과 버전, ssh/mosh, tmux 여부, 기기 입력 언어, 레이아웃, 기대한 글과 실제 글.
