/**
 * ISBN-Barcode (EAN-13) als Bild zum Vorzeigen im Buchladen.
 * Die Kassen lesen ihn wie den Strichcode auf der Buchrückseite.
 */
const L = ["0001101", "0011001", "0010011", "0111101", "0100011", "0110001", "0101111", "0111011", "0110111", "0001011"];
const G = ["0100111", "0110011", "0011011", "0100001", "0011101", "0111001", "0000101", "0010001", "0001001", "0010111"];
const R = ["1110010", "1100110", "1101100", "1000010", "1011100", "1001110", "1010000", "1000100", "1001000", "1110100"];
const PARITY = ["LLLLLL", "LLGLGG", "LLGGLG", "LLGGGL", "LGLLGG", "LGGLLG", "LGGGLL", "LGLGLG", "LGLGGL", "LGGLGL"];

/** Wandelt 13 Ziffern in die Abfolge aus Strichen (1) und Lücken (0) um. */
function ean13Bits(code: string): string | null {
  if (!/^\d{13}$/.test(code)) return null;
  const d = code.split("").map(Number);
  const par = PARITY[d[0]];
  let bits = "101";
  for (let i = 1; i <= 6; i++) bits += (par[i - 1] === "L" ? L : G)[d[i]];
  bits += "01010";
  for (let i = 7; i <= 12; i++) bits += R[d[i]];
  return bits + "101";
}

export function Barcode({ isbn, height = 90 }: { isbn: string; height?: number }) {
  const code = isbn.replace(/[^0-9]/g, "");
  const bits = ean13Bits(code);
  if (!bits) return <p className="muted">Für diese ISBN lässt sich kein Barcode erzeugen.</p>;
  const QUIET = 11, W = bits.length + QUIET * 2, H = height, TEXT = 16;
  // Rand- und Mittelzeichen sind etwas länger, wie auf echten Büchern
  const guard = (i: number) => i < 3 || (i >= 45 && i < 50) || i >= 92;
  const rects: React.ReactNode[] = [];
  for (let i = 0; i < bits.length; i++) {
    if (bits[i] !== "1") continue;
    let j = i;
    while (j + 1 < bits.length && bits[j + 1] === "1" && guard(j + 1) === guard(i)) j++;
    rects.push(<rect key={i} x={QUIET + i} y={0} width={j - i + 1} height={guard(i) ? H : H - TEXT + 4} />);
    i = j;
  }
  return (
    <svg className="barcode" viewBox={`0 0 ${W} ${H + 2}`} role="img" aria-label={`Barcode ISBN ${code}`}>
      <rect x="0" y="0" width={W} height={H + 2} fill="#fff" />
      <g fill="#000">{rects}</g>
      <g fill="#000" fontFamily="ui-monospace, Menlo, monospace" fontSize="11" textAnchor="middle">
        <text x={QUIET - 5} y={H}>{code[0]}</text>
        <text x={QUIET + 3 + 21} y={H}>{code.slice(1, 7)}</text>
        <text x={QUIET + 50 + 21} y={H}>{code.slice(7)}</text>
      </g>
    </svg>
  );
}
