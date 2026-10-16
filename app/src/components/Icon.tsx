/**
 * Schlichte Linien-Symbole in einem einheitlichen Stil (24er Raster, Strich 1,8, Farbe = Schriftfarbe).
 * Statt Emojis überall in der App verwenden.
 */
const PATHS = {
  book: "M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5v-15ZM5 19.5A1.5 1.5 0 0 0 6.5 21H19",
  books: "M5 4h3.5v16H5zM10.5 4H14v16h-3.5zM16 5.2l3.3-.9 3.2 15-3.3.9z",
  stack: "M4 6h16M4 12h16M4 18h16M6 6v12M18 6v12",
  layers: "M12 3 3 8l9 5 9-5-9-5ZM3 12.5l9 5 9-5M3 17l9 5 9-5",
  target: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM12 12.01V12",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 7v5l3 2",
  calendar: "M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1ZM4 10h16M8 3v4M16 3v4",
  trend: "M3 17l6-6 4 4 8-8M15 7h6v6",
  gift: "M4 10h16v10H4zM3 7h18v3H3zM12 7v13M12 7c-1.5-3-5-3.5-5-1.2C7 7 9 7 12 7Zm0 0c1.5-3 5-3.5 5-1.2C17 7 15 7 12 7Z",
  check: "M5 12.5l4.5 4.5L19 7.5",
  sparkle: "M12 3c.6 4.2 2.8 6.4 7 7-4.2.6-6.4 2.8-7 7-.6-4.2-2.8-6.4-7-7 4.2-.6 6.4-2.8 7-7Z",
  dice: "M6 3.5h12A2.5 2.5 0 0 1 20.5 6v12a2.5 2.5 0 0 1-2.5 2.5H6A2.5 2.5 0 0 1 3.5 18V6A2.5 2.5 0 0 1 6 3.5ZM8.5 8.5h.01M15.5 8.5h.01M12 12h.01M8.5 15.5h.01M15.5 15.5h.01",
  arrow: "M5 12h14M13 6l6 6-6 6",
  pencil: "M4 20h4L19 9l-4-4L4 16v4ZM13.5 6.5l4 4",
  flag: "M5 21V4M5 4h11l-2 4 2 4H5",
  cover: "M4 4.5h7v15H4zM13 4.5h7v15h-7zM6.5 8h2M15.5 8h2",
  list: "M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01",
  grid: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
  coffee: "M4 9h12v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V9ZM16 10h1.5a2.5 2.5 0 0 1 0 5H16M8 3c0 1.5 1 1.5 1 3M12 3c0 1.5 1 1.5 1 3",
  tower: "M12 2l2 5v3l2 2v10H8V12l2-2V7l2-5ZM8 22h8M10 16h4",
  weight: "M7 8h10l3 13H4L7 8ZM9.5 8a2.5 2.5 0 1 1 5 0",
  search: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14ZM20 20l-3.5-3.5",
  chevron: "m6 9 6 6 6-6",
  filter: "M4 6h16M7 12h10M10 18h4",
  road: "M8 3 4 21M16 3l4 18M12 4v3M12 11v3M12 18v3",
  film: "M4 4h16v16H4zM8 4v16M16 4v16M4 8h4M4 12h4M4 16h4M16 8h4M16 12h4M16 16h4",
  pizza: "M12 21 3 6c5.5-3 12.5-3 18 0l-9 15ZM5 9c4-2 10-2 14 0M10 11h.01M14 13h.01M12 16h.01",
  ticket: "M3 8a2 2 0 0 0 0 4v0a2 2 0 0 1 0 4v2h18v-2a2 2 0 0 1 0-4 2 2 0 0 0 0-4V6H3v2ZM14 6v12",
  globe: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM3 12h18M12 3c2.5 2.5 3.5 5.5 3.5 9s-1 6.5-3.5 9c-2.5-2.5-3.5-5.5-3.5-9s1-6.5 3.5-9Z",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21c1-4 4.5-6 8-6s7 2 8 6",
  star: "M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z",
  hourglass: "M6 3h12M6 21h12M7 3c0 5 5 6 5 9s-5 4-5 9M17 3c0 5-5 6-5 9s5 4 5 9",
  bolt: "M13 2 4 14h7l-1 8 9-12h-7l1-8Z",
  heart: "M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z",
  repeat: "M4 12V9a3 3 0 0 1 3-3h12M16 3l3 3-3 3M20 12v3a3 3 0 0 1-3 3H5M8 21l-3-3 3-3",
  pause: "M8 5v14M16 5v14",
  camera: "M4 8h3l2-3h6l2 3h3v11H4V8ZM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z",
  barcode: "M4 5v14M7 5v14M10 5v14M14 5v14M16 5v14M20 5v14M12 5v10M18 5v10",
  moon: "M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5Z",
  quote: "M6 11h4v6H5v-3.5C5 9 7 6.5 10 6M14 11h4v6h-5v-3.5c0-4.5 2-7 5-7.5",
  smile: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM8.5 14c.8 1.3 2 2 3.5 2s2.7-.7 3.5-2M9 9.5h.01M15 9.5h.01",
  flame: "M12 22c4 0 7-2.8 7-7 0-3-2-5.5-3.5-7-.5 2-1.5 3-2.5 3.5C13 8 12 5 9 3c.5 3-1 5-2.5 7C5.5 11.5 5 13 5 15c0 4.2 3 7 7 7Zm0 0c-2 0-3-1.5-3-3.2 0-1.8 1.5-2.8 3-4.8 1.5 2 3 3 3 4.8 0 1.7-1 3.2-3 3.2Z",
  headphones: "M4 14v-2a8 8 0 0 1 16 0v2M4 14h3v6H5a1 1 0 0 1-1-1v-5ZM20 14h-3v6h2a1 1 0 0 0 1-1v-5Z",
  pin: "M12 21s-6-5.5-6-11a6 6 0 0 1 12 0c0 5.5-6 11-6 11ZM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z",
  eye: "M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12ZM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
  users: "M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM2.5 20c.8-3.5 3.5-5.5 6.5-5.5s5.7 2 6.5 5.5M16 4.5a3.5 3.5 0 0 1 0 6.5M18 14.5c2 .6 3.3 2.3 3.8 5.5",
  building: "M4 21V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v16M15 9h4a1 1 0 0 1 1 1v11M3 21h18M8 8h3M8 12h3M8 16h3",
  coin: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM15 9.5c-.6-1-1.7-1.5-3-1.5-2 0-3.5 1.8-3.5 4s1.5 4 3.5 4c1.3 0 2.4-.5 3-1.5M7 11h5M7 13h5",
  note: "M6 3h9l4 4v14H6V3ZM15 3v4h4M9 12h6M9 16h6",
  tag: "M3 12V4h8l9 9-8 8-9-9ZM7.5 7.5h.01",
  pages: "M7 3h8l4 4v14H7V3ZM15 3v4h4M4 7v14h11",
  bookmark: "M6 3h12v18l-6-4.5L6 21V3Z",
  hash: "M9 4 7 20M17 4l-2 16M4 9h17M3 15h17",
  warning: "M12 3 2.5 20h19L12 3ZM12 10v4M12 17.5v.01",
  speech: "M4 5h16v11H9l-5 4V5Z",
  people: "M12 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM5 21c.8-3.8 3.7-6 7-6s6.2 2.2 7 6",
  history: "M4 12a8 8 0 1 1 2.3 5.7M4 12V8M4 12h4M12 8v4l3 2"
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 18, className }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg className={"icon" + (className ? " " + className : "")} width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATHS[name]} />
    </svg>
  );
}
