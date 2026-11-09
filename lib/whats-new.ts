// What's new: shown once on each phone or computer when the app opens after an update (components/WhatsNew.tsx).
// Every pull request that changes something people will notice adds an entry at the TOP of NEWS, with the next id,
// today's date and a few plain sentences. Entries never change id once released.
export type News = { id: number; date: string; title: string; items: string[] };

export const NEWS: News[] = [
  {
    id: 3, date: "2026-11-09", title: "Part payouts",
    items: ["When a payout has only been part paid, the rotation shows just how much is left to pay."],
  },
  {
    id: 2, date: "2026-11-06", title: "What's new",
    items: ["This card tells you about updates the first time you open the app after a change."],
  },
  {
    id: 1, date: "2026-11-05", title: "New cycles and WhatsApp numbers",
    items: [
      "Start a new cycle when the current one ends.",
      "Keep a WhatsApp number for each member.",
      "A payment larger than the week's contribution carries forward to the next weeks.",
    ],
  },
];
