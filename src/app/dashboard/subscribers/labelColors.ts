export const LABEL_COLORS = ['gold','blue','green','purple','orange','red','pink','teal','cyan','slate'] as const
export type LabelColor = typeof LABEL_COLORS[number]

export const COLOR_CLASSES: Record<LabelColor | string, string> = {
  gold:   'bg-yellow-500/20 text-yellow-300 border-yellow-500/40',
  blue:   'bg-blue-400/20 text-blue-300 border-blue-400/40',
  green:  'bg-green-400/20 text-green-300 border-green-400/40',
  purple: 'bg-purple-400/20 text-purple-300 border-purple-400/40',
  orange: 'bg-orange-400/20 text-orange-300 border-orange-400/40',
  red:    'bg-red-400/20 text-red-300 border-red-400/40',
  pink:   'bg-pink-400/20 text-pink-300 border-pink-400/40',
  teal:   'bg-teal-400/20 text-teal-300 border-teal-400/40',
  cyan:   'bg-cyan-400/20 text-cyan-300 border-cyan-400/40',
  slate:  'bg-slate-400/20 text-slate-300 border-slate-400/40',
}

export const DOT_CLASSES: Record<LabelColor | string, string> = {
  gold: 'bg-yellow-400', blue: 'bg-blue-400', green: 'bg-green-400',
  purple: 'bg-purple-400', orange: 'bg-orange-400', red: 'bg-red-400',
  pink: 'bg-pink-400', teal: 'bg-teal-400', cyan: 'bg-cyan-400', slate: 'bg-slate-400',
}

export interface Label { id: string; name: string; color: string }

export function labelBadgeClass(color: string) {
  return `${COLOR_CLASSES[color] ?? COLOR_CLASSES.slate} border text-xs px-2 py-0.5 rounded-full font-medium`
}
