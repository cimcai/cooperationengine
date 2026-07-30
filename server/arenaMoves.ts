// Move parsing for arena matches (prisoner's dilemma, stag hunt, apple tree).
//
// The previous inline parser had three failure modes that silently corrupted
// cooperation metrics (see issue #8 discussion):
//   1. Order bias: `includes(move1)` was checked before `includes(move2)`, so
//      "I will not COOPERATE. DEFECT." was scored as COOPERATE.
//   2. Substring hits: plain `includes` matches inside words, so a stag-hunt
//      response mentioning "hostage" (hoSTAGe) was scored as STAG, and
//      "full cooperation" as COOPERATE.
//   3. Silent default: an unparseable response was scored as move2 (defect)
//      with no record that parsing failed.
//
// This parser is layered and reports parse status alongside the move, in the
// same spirit as the contribution-evaluation `parseOk` flag (PR #31):
//   a. If the first non-empty line starts with exactly one move label
//      (the RESPONSE FORMAT the system prompt demands), use it.
//   b. Otherwise look for whole-word occurrences of the labels anywhere in
//      the response; if exactly one distinct label appears, use it.
//   c. Otherwise the move is ambiguous or absent: return null and let the
//      caller apply its default — but with parseOk=false recorded, so runs
//      can be filtered or re-examined instead of quietly counting a guess.

export interface ParsedMove {
  move: string | null;
  parseOk: boolean;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function extractMove(response: string, moves: [string, string]): ParsedMove {
  const upper = response.toUpperCase();
  const [move1, move2] = moves.map(m => m.toUpperCase()) as [string, string];

  // (a) Format-compliant: first non-empty line starts with a move label.
  const firstLine = upper
    .split("\n")
    .map(line => line.trim())
    .find(line => line.length > 0) ?? "";
  // Strip common lead-in punctuation/markdown around the label ("**DEFECT**", "- STAG:").
  const strippedFirstLine = firstLine.replace(/^[^A-Z]*/, "");
  const startsWith1 = strippedFirstLine.startsWith(move1);
  const startsWith2 = strippedFirstLine.startsWith(move2);
  if (startsWith1 !== startsWith2) {
    return { move: startsWith1 ? moves[0] : moves[1], parseOk: true };
  }

  // (b) Whole-word occurrences anywhere in the response.
  const has1 = new RegExp(`\\b${escapeRegExp(move1)}\\b`).test(upper);
  const has2 = new RegExp(`\\b${escapeRegExp(move2)}\\b`).test(upper);
  if (has1 !== has2) {
    return { move: has1 ? moves[0] : moves[1], parseOk: true };
  }

  // (c) Both labels present (ambiguous) or neither (absent).
  return { move: null, parseOk: false };
}
