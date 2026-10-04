// 레이아웃 레지스트리. 표 본문은 tools/gen-layout.mjs 가 만든 layout-data.ts (출처·미확인 표시는 그 파일 머리말).
import type { KeyDef } from './keydef'
import { DUBEOLSIK, SEBEOLSIK_390, SEBEOLSIK_FINAL } from './layout-data'

export type LayoutId = 'dubeolsik' | 'sebeolsik-390' | 'sebeolsik-final'

export interface Layout {
  readonly id: LayoutId
  readonly name: string
  /** dubeol: 자음이 초/종성 겸용, sebeol: 키가 역할 고정 */
  readonly kind: 'dubeol' | 'sebeol'
  readonly map: Readonly<Record<string, KeyDef>>
}

export const LAYOUTS: Readonly<Record<LayoutId, Layout>> = {
  dubeolsik: { id: 'dubeolsik', name: '두벌식', kind: 'dubeol', map: DUBEOLSIK },
  'sebeolsik-390': { id: 'sebeolsik-390', name: '세벌식 390', kind: 'sebeol', map: SEBEOLSIK_390 },
  'sebeolsik-final': { id: 'sebeolsik-final', name: '세벌식 최종', kind: 'sebeol', map: SEBEOLSIK_FINAL },
}

const ALIASES: Readonly<Record<string, LayoutId>> = {
  '2': 'dubeolsik', dubeol: 'dubeolsik', dubeolsik: 'dubeolsik', 두벌식: 'dubeolsik',
  '390': 'sebeolsik-390', '3-90': 'sebeolsik-390', '39': 'sebeolsik-390', 'sebeolsik-390': 'sebeolsik-390', 세벌식390: 'sebeolsik-390', '세벌식390': 'sebeolsik-390',
  final: 'sebeolsik-final', '3f': 'sebeolsik-final', '3final': 'sebeolsik-final', 'sebeolsik-final': 'sebeolsik-final', 세벌식최종: 'sebeolsik-final',
}

/** 사용자가 입력한 이름(공백·대소문자 무시)을 레이아웃으로. 모르면 undefined. */
export function parseLayout(name: string | undefined): Layout | undefined {
  if (name === undefined) return undefined
  const key = name.trim().toLowerCase().replace(/\s+/g, '')
  const id = ALIASES[key]
  return id === undefined ? undefined : LAYOUTS[id]
}
