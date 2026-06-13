// Central color tokens — the single source of truth for both apps' palette.
// Mobile imports { C } directly; web mirrors these as CSS variables in the
// :root block of web/src/App.css. Re-skinning the whole app = editing this
// file (and keeping that :root block in sync).
//
// Scheme: "Bauhaus on white" — white paper, near-black ink and borders, with
// red / blue / yellow primary accents. High contrast, no beige, no orange.
export const C = {
  bg: '#FFFFFF',       // page background (was warm beige)
  surface: '#F2F2F2',  // secondary surfaces / fills
  line: '#E0E0E0',     // subtle dividers / hairline borders
  ink: '#111111',      // primary text, dark accents, strong borders
  muted: '#999999',    // muted / secondary text
  white: '#FFFFFF',

  red: '#E53935',      // destructive + primary-red accent
  redDark: '#C62828',  // pressed / hover destructive
  redSoft: '#FDECEA',  // soft red background tint
  blue: '#1E88E5',     // primary-blue accent
  yellow: '#FDD835',   // primary-yellow accent
};
