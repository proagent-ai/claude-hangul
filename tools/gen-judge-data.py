# core/judge-data.ts 생성기. 공개 자료만 읽는다(누구의 대화 기록도 읽지 않는다).
#  - SCOWL 2020.12.07 (Kevin Atkinson, 허용적 고지: third_party/SCOWL-Copyright.txt)
#  - KS X 1001 한글 음절 집합 (파이썬 euc-kr 코덱)
# 사용: python3 tools/gen-judge-data.py <scowl final 폴더> 35 core/judge-data.ts
import sys, re, collections
F = sys.argv[1]  # path to scowl final/ dir
MAXT = int(sys.argv[2]) if len(sys.argv) > 2 else 35
tiers = {}
allw = set()
for t in [10, 20, 35, 40, 50]:
    for f in ['english-words', 'american-words']:
        try:
            for w in open(f'{F}/{f}.{t}', encoding='latin1'):
                w = w.strip()
                if not re.fullmatch('[a-z]+', w): continue
                allw.add(w)
                if t <= MAXT and len(w) >= 4: tiers.setdefault(w, t)
        except FileNotFoundError: pass
SUF = ['s', 'es', 'ed', 'd', 'ing', 'ly', 'er', 'ers']
def bases(w):
    for x in SUF:
        if w.endswith(x) and len(w) - len(x) >= 3:
            b = w[:-len(x)]; yield b
            if x in ('ing', 'ed', 'er', 'ers'): yield b + 'e'
            if x in ('ing', 'ed', 'er', 'ers') and len(b) > 3 and b[-1] == b[-2]: yield b[:-1]
    if w.endswith('ies'): yield w[:-3] + 'y'
    if w.endswith('ied'): yield w[:-3] + 'y'
# drop inflections whose base is already listed at the same or a more common tier; judge.ts strips them back
by = collections.defaultdict(list)
for w, t in tiers.items():
    if any(b in tiers and tiers[b] <= t for b in bases(w)): continue
    by[t].append(w)
ks = []
for a in range(0xb0, 0xc9):
    for b in range(0xa1, 0xff):
        try: c = bytes([a, b]).decode('euc-kr')
        except Exception: continue
        if '가' <= c <= '힣': ks.append(c)
out = ['// 생성 파일: tools/gen-judge-data.py (직접 고치지 말 것). 출처: SCOWL 2020.12.07 (c) Kevin Atkinson et al., permissive notice',
       '// (http://wordlist.aspell.net, third_party/SCOWL-Copyright.txt); KS X 1001 Hangul syllable set.']
out.append('export const WORDS: Record<number, string> = {')
for t in sorted(by): out.append(f'  {t}: "{" ".join(sorted(by[t]))}",')
out.append('}')
out.append(f'export const KS = "{"".join(ks)}"')
open(sys.argv[3], 'w').write('\n'.join(out) + '\n')
print({t: len(v) for t, v in by.items()}, len(allw))
