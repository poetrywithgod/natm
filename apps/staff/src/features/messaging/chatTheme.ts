// Every colour the chat screens use lives here. The staff app (forest) and
// the student-parent app (abyssal + lime) each carry their own copy of this
// one file; everything else in features/messaging is identical in both.
export const T = {
  // header + page chrome
  headerBg: "bg-forest-900",
  headerText: "text-forest-100",
  headerSub: "text-forest-300",
  muted: "text-forest-300",
  accent: "text-forest-400",
  link: "text-forest-300",
  // bubbles
  mine: "bg-forest-500 text-forest-950",
  mineTime: "text-forest-950/60",
  mineTrack: "bg-forest-950/20",
  mineFill: "bg-forest-950",
  mineBtn: "bg-forest-950 text-forest-400",
  mineQuote: "bg-forest-950/15 border-forest-950/60",
  theirs: "bg-forest-800 text-forest-100",
  theirTime: "text-forest-300",
  theirTrack: "bg-forest-100/20",
  theirFill: "bg-forest-400",
  theirBtn: "bg-forest-400 text-forest-950",
  theirQuote: "bg-forest-950/40 border-forest-400",
  senderName: "text-forest-400",
  divider: "bg-forest-900 text-forest-300",
  systemNote: "bg-forest-900 text-forest-300",
  // composer
  composerBg: "bg-forest-900",
  input: "border-forest-700 bg-forest-950 text-forest-100",
  action: "bg-forest-500 text-forest-950",
  recordDot: "bg-red-500",
  replyBar: "bg-forest-950 border-forest-500",
  // avatars, sheets, menus, chips
  avatar: "bg-forest-700 text-forest-100",
  sheet: "bg-forest-900 text-forest-100",
  sheetBorder: "border-forest-800",
  sheetHover: "hover:bg-forest-800",
  heading: "text-forest-400",
  chip: "bg-forest-900 border-forest-700 text-forest-100",
  chipMine: "bg-forest-700 border-forest-400 text-forest-100",
  outlineBtn: "border border-forest-700 text-forest-100",
  primaryBtn: "bg-forest-500 text-forest-950",
  card: "bg-forest-900",
  cardIcon: "bg-forest-800",
} as const;

export type ChatTheme = typeof T;
