// 키 정의 타입과 생성자. 자모는 모두 호환 자모(U+3131~U+3163) 문자열로 다룬다.

/**
 * cons: 두벌식 자음 (초성/종성 문맥으로 결정)
 * cho/jung/jong: 세벌식처럼 키가 역할을 고정한 자모
 * lit: 레이아웃이 정의한 일반 문자 출력 (예: 세벌식 390의 '<' → '2')
 */
export type KeyDef =
  | { readonly role: 'cons'; readonly jamo: string }
  | { readonly role: 'cho'; readonly jamo: string }
  | { readonly role: 'jung'; readonly jamo: string }
  | { readonly role: 'jong'; readonly jamo: string }
  | { readonly role: 'lit'; readonly text: string }

export const cons = (jamo: string): KeyDef => ({ role: 'cons', jamo })
export const cho = (jamo: string): KeyDef => ({ role: 'cho', jamo })
export const jung = (jamo: string): KeyDef => ({ role: 'jung', jamo })
export const jong = (jamo: string): KeyDef => ({ role: 'jong', jamo })
export const lit = (text: string): KeyDef => ({ role: 'lit', text })
