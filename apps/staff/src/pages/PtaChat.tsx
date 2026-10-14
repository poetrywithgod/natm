import ForumPage from "../features/messaging/ForumPage";

// The Parent Model Forum, for the staff roles.
//  - mobile roles (class/shadow teacher): full-screen thread
//  - desktop roles (school admin / finance manager): thread in a card
// Only the school admin is in the forum by default; everyone else joins by invitation.
export default function PtaChat({ backTo, desktop }: { backTo: string; desktop?: boolean }) {
  return <ForumPage backTo={backTo} desktop={desktop} />;
}
