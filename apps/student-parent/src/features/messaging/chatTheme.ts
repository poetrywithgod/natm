// Every colour the chat screens use lives here. The staff app (forest) and
// the student-parent app (abyssal + lime) each carry their own copy of this
// one file; everything else in features/messaging is identical in both.
export const T = {
  // header + page chrome
  headerBg: "bg-abyssal-900",
  headerText: "text-abyssal-100",
  headerSub: "text-abyssal-300",
  muted: "text-abyssal-300",
  accent: "text-lime",
  link: "text-abyssal-300",
  // bubbles
  mine: "bg-lime text-abyssal-950",
  mineTime: "text-abyssal-950/60",
  mineTrack: "bg-abyssal-950/20",
  mineFill: "bg-abyssal-950",
  mineBtn: "bg-abyssal-950 text-lime",
  mineQuote: "bg-abyssal-950/15 border-abyssal-950/60",
  theirs: "bg-abyssal-700 text-abyssal-100",
  theirTime: "text-abyssal-300",
  theirTrack: "bg-abyssal-100/20",
  theirFill: "bg-lime",
  theirBtn: "bg-lime text-abyssal-950",
  theirQuote: "bg-abyssal-950/40 border-lime",
  senderName: "text-lime",
  divider: "bg-abyssal-900 text-abyssal-300",
  systemNote: "bg-abyssal-900 text-abyssal-300",
  // composer
  composerBg: "bg-abyssal-900",
  input: "border-abyssal-700 bg-abyssal-950 text-abyssal-100",
  action: "bg-lime text-abyssal-950",
  recordDot: "bg-red-500",
  replyBar: "bg-abyssal-950 border-lime",
  // avatars, sheets, menus, chips
  avatar: "bg-abyssal-700 text-abyssal-100",
  sheet: "bg-abyssal-900 text-abyssal-100",
  sheetBorder: "border-abyssal-700",
  sheetHover: "hover:bg-abyssal-700",
  heading: "text-lime",
  chip: "bg-abyssal-900 border-abyssal-700 text-abyssal-100",
  chipMine: "bg-abyssal-700 border-lime text-abyssal-100",
  outlineBtn: "border border-abyssal-700 text-abyssal-100",
  primaryBtn: "bg-lime text-abyssal-950",
  card: "bg-abyssal-900",
  cardIcon: "bg-abyssal-700",
} as const;

export type ChatTheme = typeof T;
