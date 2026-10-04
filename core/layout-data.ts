// 자동 생성 파일: tools/gen-layout.mjs (직접 고치지 말고 생성기를 고칠 것)
// 출처: libhangul (https://github.com/libhangul/libhangul) data/keyboards/hangul-keyboard-{2,39,3f}.xml.template
//   commit 5094421d9586294b2aad09924b9a54e2e6060f06 (2026-09-14)
// 검증 상태:
//   - 자모 키(소문자·숫자·; ' /)는 libhangul과 작성자 기억이 일치했으나, 독립 문헌/공식 표준(KS X 5002, 공병우 도표)과의
//     대조는 수행하지 못함 → 전체적으로 "단일 출처, 독립 대조 미확인".
//   - 항등 매핑(키가 자기 문자로 나오는 것)은 생략했다. 표에 없는 키 = 그대로 통과.
//   - 세벌식의 시프트/기호 위치는 개별 행에 '미확인'을 달았다.
import { cho, cons, jong, jung, lit } from './keydef'
import type { KeyDef } from './keydef'

/** 두벌식 (KS X 5002). cons = 초성·종성 겸용 자음. */
export const DUBEOLSIK: Readonly<Record<string, KeyDef>> = {
  "A": cons('ㅁ'), // 대문자=소문자와 동일(libhangul 기준)
  "B": jung('ㅠ'), // 대문자=소문자와 동일(libhangul 기준)
  "C": cons('ㅊ'), // 대문자=소문자와 동일(libhangul 기준)
  "D": cons('ㅇ'), // 대문자=소문자와 동일(libhangul 기준)
  "E": cons('ㄸ'),
  "F": cons('ㄹ'), // 대문자=소문자와 동일(libhangul 기준)
  "G": cons('ㅎ'), // 대문자=소문자와 동일(libhangul 기준)
  "H": jung('ㅗ'), // 대문자=소문자와 동일(libhangul 기준)
  "I": jung('ㅑ'), // 대문자=소문자와 동일(libhangul 기준)
  "J": jung('ㅓ'), // 대문자=소문자와 동일(libhangul 기준)
  "K": jung('ㅏ'), // 대문자=소문자와 동일(libhangul 기준)
  "L": jung('ㅣ'), // 대문자=소문자와 동일(libhangul 기준)
  "M": jung('ㅡ'), // 대문자=소문자와 동일(libhangul 기준)
  "N": jung('ㅜ'), // 대문자=소문자와 동일(libhangul 기준)
  "O": jung('ㅒ'),
  "P": jung('ㅖ'),
  "Q": cons('ㅃ'),
  "R": cons('ㄲ'),
  "S": cons('ㄴ'), // 대문자=소문자와 동일(libhangul 기준)
  "T": cons('ㅆ'),
  "U": jung('ㅕ'), // 대문자=소문자와 동일(libhangul 기준)
  "V": cons('ㅍ'), // 대문자=소문자와 동일(libhangul 기준)
  "W": cons('ㅉ'),
  "X": cons('ㅌ'), // 대문자=소문자와 동일(libhangul 기준)
  "Y": jung('ㅛ'), // 대문자=소문자와 동일(libhangul 기준)
  "Z": cons('ㅋ'), // 대문자=소문자와 동일(libhangul 기준)
  "a": cons('ㅁ'),
  "b": jung('ㅠ'),
  "c": cons('ㅊ'),
  "d": cons('ㅇ'),
  "e": cons('ㄷ'),
  "f": cons('ㄹ'),
  "g": cons('ㅎ'),
  "h": jung('ㅗ'),
  "i": jung('ㅑ'),
  "j": jung('ㅓ'),
  "k": jung('ㅏ'),
  "l": jung('ㅣ'),
  "m": jung('ㅡ'),
  "n": jung('ㅜ'),
  "o": jung('ㅐ'),
  "p": jung('ㅔ'),
  "q": cons('ㅂ'),
  "r": cons('ㄱ'),
  "s": cons('ㄴ'),
  "t": cons('ㅅ'),
  "u": jung('ㅕ'),
  "v": cons('ㅍ'),
  "w": cons('ㅈ'),
  "x": cons('ㅌ'),
  "y": jung('ㅛ'),
  "z": cons('ㅋ'),
}

/** 세벌식 390 (libhangul id "39"). cho/jung/jong 은 키마다 고정된 역할. */
export const SEBEOLSIK_390: Readonly<Record<string, KeyDef>> = {
  "!": jong('ㅈ'), // 미확인(libhangul 단일 출처, 공식 도표 대조 안 함)
  "'": cho('ㅌ'),
  "/": jung('ㅗ'),
  "0": cho('ㅋ'),
  "1": jong('ㅎ'),
  "2": jong('ㅆ'),
  "3": jong('ㅂ'),
  "4": jung('ㅛ'),
  "5": jung('ㅠ'),
  "6": jung('ㅑ'),
  "7": jung('ㅖ'),
  "8": jung('ㅢ'),
  "9": jung('ㅜ'),
  ";": cho('ㅂ'),
  "<": lit("2"), // 미확인(libhangul 단일 출처, 공식 도표 대조 안 함)
  ">": lit("3"), // 미확인(libhangul 단일 출처, 공식 도표 대조 안 함)
  "A": jong('ㄷ'), // 미확인(libhangul 단일 출처, 공식 도표 대조 안 함)
  "B": lit("!"), // 미확인(libhangul 단일 출처, 공식 도표 대조 안 함)
  "C": jong('ㄻ'), // 미확인(libhangul 단일 출처, 공식 도표 대조 안 함)
  "D": jong('ㄺ'), // 미확인(libhangul 단일 출처, 공식 도표 대조 안 함)
  "E": jong('ㅋ'), // 미확인(libhangul 단일 출처, 공식 도표 대조 안 함)
  "F": jong('ㄲ'), // 미확인(libhangul 단일 출처, 공식 도표 대조 안 함)
  "G": lit("/"), // 미확인(libhangul 단일 출처, 공식 도표 대조 안 함)
  "H": lit("'"), // 미확인(libhangul 단일 출처, 공식 도표 대조 안 함)
  "I": lit("8"), // 미확인(libhangul 단일 출처, 공식 도표 대조 안 함)
  "J": lit("4"), // 미확인(libhangul 단일 출처, 공식 도표 대조 안 함)
  "K": lit("5"), // 미확인(libhangul 단일 출처, 공식 도표 대조 안 함)
  "L": lit("6"), // 미확인(libhangul 단일 출처, 공식 도표 대조 안 함)
  "M": lit("1"), // 미확인(libhangul 단일 출처, 공식 도표 대조 안 함)
  "N": lit("0"), // 미확인(libhangul 단일 출처, 공식 도표 대조 안 함)
  "O": lit("9"), // 미확인(libhangul 단일 출처, 공식 도표 대조 안 함)
  "P": lit(">"), // 미확인(libhangul 단일 출처, 공식 도표 대조 안 함)
  "Q": jong('ㅍ'), // 미확인(libhangul 단일 출처, 공식 도표 대조 안 함)
  "R": jung('ㅒ'), // 미확인(libhangul 단일 출처, 공식 도표 대조 안 함)
  "S": jong('ㄶ'), // 미확인(libhangul 단일 출처, 공식 도표 대조 안 함)
  "T": lit(";"), // 미확인(libhangul 단일 출처, 공식 도표 대조 안 함)
  "U": lit("7"), // 미확인(libhangul 단일 출처, 공식 도표 대조 안 함)
  "V": jong('ㅀ'), // 미확인(libhangul 단일 출처, 공식 도표 대조 안 함)
  "W": jong('ㅌ'), // 미확인(libhangul 단일 출처, 공식 도표 대조 안 함)
  "X": jong('ㅄ'), // 미확인(libhangul 단일 출처, 공식 도표 대조 안 함)
  "Y": lit("<"), // 미확인(libhangul 단일 출처, 공식 도표 대조 안 함)
  "Z": jong('ㅊ'), // 미확인(libhangul 단일 출처, 공식 도표 대조 안 함)
  "a": jong('ㅇ'),
  "b": jung('ㅜ'),
  "c": jung('ㅔ'),
  "d": jung('ㅣ'),
  "e": jung('ㅕ'),
  "f": jung('ㅏ'),
  "g": jung('ㅡ'),
  "h": cho('ㄴ'),
  "i": cho('ㅁ'),
  "j": cho('ㅇ'),
  "k": cho('ㄱ'),
  "l": cho('ㅈ'),
  "m": cho('ㅎ'),
  "n": cho('ㅅ'),
  "o": cho('ㅊ'),
  "p": cho('ㅍ'),
  "q": jong('ㅅ'),
  "r": jung('ㅐ'),
  "s": jong('ㄴ'),
  "t": jung('ㅓ'),
  "u": cho('ㄷ'),
  "v": jung('ㅗ'),
  "w": jong('ㄹ'),
  "x": jong('ㄱ'),
  "y": cho('ㄹ'),
  "z": jong('ㅁ'),
}

/** 세벌식 최종 (libhangul id "3f"). */
export const SEBEOLSIK_FINAL: Readonly<Record<string, KeyDef>> = {
  "!": jong('ㄲ'), // 미확인(libhangul 단일 출처, 공식 도표 대조 안 함)
  "\"": lit("·"), // 미확인(libhangul 단일 출처, 공식 도표 대조 안 함)
  "#": jong('ㅈ'), // 미확인(libhangul 단일 출처, 공식 도표 대조 안 함)
  "$": jong('ㄿ'), // 미확인(libhangul 단일 출처, 공식 도표 대조 안 함)
  "%": jong('ㄾ'), // 미확인(libhangul 단일 출처, 공식 도표 대조 안 함)
  "&": lit("“"), // 미확인(libhangul 단일 출처, 공식 도표 대조 안 함)
  "'": cho('ㅌ'),
  "(": lit("'"), // 미확인(libhangul 단일 출처, 공식 도표 대조 안 함)
  ")": lit("~"), // 미확인(libhangul 단일 출처, 공식 도표 대조 안 함)
  "*": lit("”"), // 미확인(libhangul 단일 출처, 공식 도표 대조 안 함)
  "-": lit(")"), // 미확인(libhangul 단일 출처, 공식 도표 대조 안 함)
  "/": jung('ㅗ'),
  "0": cho('ㅋ'),
  "1": jong('ㅎ'),
  "2": jong('ㅆ'),
  "3": jong('ㅂ'),
  "4": jung('ㅛ'),
  "5": jung('ㅠ'),
  "6": jung('ㅑ'),
  "7": jung('ㅖ'),
  "8": jung('ㅢ'),
  "9": jung('ㅜ'),
  ":": lit("4"), // 미확인(libhangul 단일 출처, 공식 도표 대조 안 함)
  ";": cho('ㅂ'),
  "<": lit(","), // 미확인(libhangul 단일 출처, 공식 도표 대조 안 함)
  "=": lit(">"), // 미확인(libhangul 단일 출처, 공식 도표 대조 안 함)
  ">": lit("."), // 미확인(libhangul 단일 출처, 공식 도표 대조 안 함)
  "?": lit("!"), // 미확인(libhangul 단일 출처, 공식 도표 대조 안 함)
  "@": jong('ㄺ'), // 미확인(libhangul 단일 출처, 공식 도표 대조 안 함)
  "A": jong('ㄷ'), // 미확인(libhangul 단일 출처, 공식 도표 대조 안 함)
  "B": lit("?"), // 미확인(libhangul 단일 출처, 공식 도표 대조 안 함)
  "C": jong('ㅋ'), // 미확인(libhangul 단일 출처, 공식 도표 대조 안 함)
  "D": jong('ㄼ'), // 미확인(libhangul 단일 출처, 공식 도표 대조 안 함)
  "E": jong('ㄵ'), // 미확인(libhangul 단일 출처, 공식 도표 대조 안 함)
  "F": jong('ㄻ'), // 미확인(libhangul 단일 출처, 공식 도표 대조 안 함)
  "G": jung('ㅒ'), // 미확인(libhangul 단일 출처, 공식 도표 대조 안 함)
  "H": lit("0"), // 미확인(libhangul 단일 출처, 공식 도표 대조 안 함)
  "I": lit("7"), // 미확인(libhangul 단일 출처, 공식 도표 대조 안 함)
  "J": lit("1"), // 미확인(libhangul 단일 출처, 공식 도표 대조 안 함)
  "K": lit("2"), // 미확인(libhangul 단일 출처, 공식 도표 대조 안 함)
  "L": lit("3"), // 미확인(libhangul 단일 출처, 공식 도표 대조 안 함)
  "M": lit("\""), // 미확인(libhangul 단일 출처, 공식 도표 대조 안 함)
  "N": lit("-"), // 미확인(libhangul 단일 출처, 공식 도표 대조 안 함)
  "O": lit("8"), // 미확인(libhangul 단일 출처, 공식 도표 대조 안 함)
  "P": lit("9"), // 미확인(libhangul 단일 출처, 공식 도표 대조 안 함)
  "Q": jong('ㅍ'), // 미확인(libhangul 단일 출처, 공식 도표 대조 안 함)
  "R": jong('ㅀ'), // 미확인(libhangul 단일 출처, 공식 도표 대조 안 함)
  "S": jong('ㄶ'), // 미확인(libhangul 단일 출처, 공식 도표 대조 안 함)
  "T": jong('ㄽ'), // 미확인(libhangul 단일 출처, 공식 도표 대조 안 함)
  "U": lit("6"), // 미확인(libhangul 단일 출처, 공식 도표 대조 안 함)
  "V": jong('ㄳ'), // 미확인(libhangul 단일 출처, 공식 도표 대조 안 함)
  "W": jong('ㅌ'), // 미확인(libhangul 단일 출처, 공식 도표 대조 안 함)
  "X": jong('ㅄ'), // 미확인(libhangul 단일 출처, 공식 도표 대조 안 함)
  "Y": lit("5"), // 미확인(libhangul 단일 출처, 공식 도표 대조 안 함)
  "Z": jong('ㅊ'), // 미확인(libhangul 단일 출처, 공식 도표 대조 안 함)
  "[": lit("("), // 미확인(libhangul 단일 출처, 공식 도표 대조 안 함)
  "\\": lit(":"), // 미확인(libhangul 단일 출처, 공식 도표 대조 안 함)
  "]": lit("<"), // 미확인(libhangul 단일 출처, 공식 도표 대조 안 함)
  "^": lit("="), // 미확인(libhangul 단일 출처, 공식 도표 대조 안 함)
  "_": lit(";"), // 미확인(libhangul 단일 출처, 공식 도표 대조 안 함)
  "`": lit("*"), // 미확인(libhangul 단일 출처, 공식 도표 대조 안 함)
  "a": jong('ㅇ'),
  "b": jung('ㅜ'),
  "c": jung('ㅔ'),
  "d": jung('ㅣ'),
  "e": jung('ㅕ'),
  "f": jung('ㅏ'),
  "g": jung('ㅡ'),
  "h": cho('ㄴ'),
  "i": cho('ㅁ'),
  "j": cho('ㅇ'),
  "k": cho('ㄱ'),
  "l": cho('ㅈ'),
  "m": cho('ㅎ'),
  "n": cho('ㅅ'),
  "o": cho('ㅊ'),
  "p": cho('ㅍ'),
  "q": jong('ㅅ'),
  "r": jung('ㅐ'),
  "s": jong('ㄴ'),
  "t": jung('ㅓ'),
  "u": cho('ㄷ'),
  "v": jung('ㅗ'),
  "w": jong('ㄹ'),
  "x": jong('ㄱ'),
  "y": cho('ㄹ'),
  "z": jong('ㅁ'),
  "{": lit("%"), // 미확인(libhangul 단일 출처, 공식 도표 대조 안 함)
  "|": lit("\\"), // 미확인(libhangul 단일 출처, 공식 도표 대조 안 함)
  "}": lit("/"), // 미확인(libhangul 단일 출처, 공식 도표 대조 안 함)
  "~": lit("※"), // 미확인(libhangul 단일 출처, 공식 도표 대조 안 함)
}

