// scripts/gen-sfx.mjs — 효과음 wav를 코드로 만든다.
//
// 디자이너가 「구출 사운드 보드」에서 고른 후보를 그대로 파일로 뜬다. 보드는
// 브라우저 Web Audio로 소리를 냈고, 여기서는 같은 식을 node에서 손으로 적분해
// PCM을 만든다 — 들은 것과 같은 소리가 나와야 하므로 포락선·주파수 활강 규칙을
// Web Audio와 똑같이 맞췄다:
//
//   · exponentialRampToValueAtTime = v0 * (v1/v0)^((t-t0)/(t1-t0))
//   · 주파수가 미끄러지므로 위상은 매 표본 적분한다(phase += 2π·f(t)·dt)
//   · square·triangle은 배음을 나이키스트까지만 더해 밴드리밋한다.
//     순진하게 sign()으로 만들면 에일리어싱이 끼어 보드에서 들은 것보다 거칠다
//
// 볼륨은 파일에 굽지 않는다 — 게임 코드가 효과음에 ×0.8을 곱하고(ui/audio.ts),
// README가 「원본은 피크에 맞춰 정규화」로 정해 두었다.
//
// 사용: node scripts/gen-sfx.mjs
import fs from "node:fs";
import path from "node:path";

const SR = 44100;
const OUT = "public/assets/audio";
const TAIL = 0.02; // 끝이 뚝 끊기지 않게 남기는 여유

// ── 신호 만들기 ──────────────────────────────────────────
/** Web Audio의 지수 램프. v0·v1은 0이면 안 된다(그래서 보드도 0.0001을 쓴다). */
const expRamp = (v0, v1, u) => v0 * Math.pow(v1 / v0, u);

/** 한 음을 buf에 더한다. t0초부터 dur초 동안, f0→f1으로 미끄러진다. */
function tone(buf, t0, { type = "sine", f0, f1 = f0, dur = 0.2, a = 0.004, peak = 1 }) {
  const i0 = Math.round(t0 * SR);
  const n = Math.round(dur * SR);
  const FLOOR = 0.0001;
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const u = t / dur;
    const f = f1 === f0 ? f0 : expRamp(f0, Math.max(1, f1), u);
    phase += (2 * Math.PI * f) / SR;

    // 포락선 — 0.004초에 올라 dur에 사그라든다
    const g = t < a
      ? expRamp(FLOOR, peak, t / a)
      : expRamp(peak, FLOOR, (t - a) / Math.max(1e-9, dur - a));

    const j = i0 + i;
    if (j >= 0 && j < buf.length) buf[j] += g * wave(type, phase, f);
  }
}

/** 밴드리밋 파형. 나이키스트를 넘는 배음은 빼서 에일리어싱을 막는다. */
function wave(type, phase, f) {
  if (type === "sine") return Math.sin(phase);
  const kMax = Math.max(1, Math.floor(SR / 2 / Math.max(1, f)));
  let v = 0;
  if (type === "square") {
    for (let k = 1; k <= kMax; k += 2) v += Math.sin(k * phase) / k;
    return (4 / Math.PI) * v;
  }
  if (type === "triangle") {
    for (let k = 1; k <= kMax; k += 2) {
      v += (((k - 1) / 2) % 2 === 0 ? 1 : -1) * Math.sin(k * phase) / (k * k);
    }
    return (8 / (Math.PI * Math.PI)) * v;
  }
  throw new Error(`모르는 파형: ${type}`);
}

// ── wav로 쓰기 ───────────────────────────────────────────
/** 피크 정규화 후 16비트 모노 wav. 정규화는 README가 정한 원본 규격이다. */
function writeWav(file, buf) {
  let peak = 0;
  for (const v of buf) peak = Math.max(peak, Math.abs(v));
  if (peak === 0) throw new Error(`${file}: 무음이 만들어졌다`);
  const scale = 0.95 / peak; // 0.95 — 정수 변환에서 클리핑되지 않게 살짝 남긴다

  const data = Buffer.alloc(buf.length * 2);
  for (let i = 0; i < buf.length; i++) {
    data.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(buf[i] * scale * 32767))), i * 2);
  }
  const head = Buffer.alloc(44);
  head.write("RIFF", 0);
  head.writeUInt32LE(36 + data.length, 4);
  head.write("WAVE", 8);
  head.write("fmt ", 12);
  head.writeUInt32LE(16, 16);       // fmt 청크 크기
  head.writeUInt16LE(1, 20);        // PCM
  head.writeUInt16LE(1, 22);        // 모노
  head.writeUInt32LE(SR, 24);
  head.writeUInt32LE(SR * 2, 28);   // 초당 바이트
  head.writeUInt16LE(2, 32);        // 블록 정렬
  head.writeUInt16LE(16, 34);       // 비트 깊이
  head.write("data", 36);
  head.writeUInt32LE(data.length, 40);
  fs.writeFileSync(file, Buffer.concat([head, data]));
  return { peak, seconds: buf.length / SR, bytes: 44 + data.length };
}

const N = { e5: 659.3 };

// ── 디자이너가 고른 것 ────────────────────────────────────
// 이름은 보드의 후보 이름 그대로다. 바꾸지 말 것 — 무엇을 듣고 골랐는지가 끊긴다.
//
// **클리어(sfx-clear.wav)는 여기 없다.** 디자이너가 직접 올리기로 했다 —
// /ui.html 오디오 탭에서 넣는다. 여기에 다시 만들어 넣으면 올린 것을 덮는다.
const PICKS = [
  {
    file: "sfx-pop.wav", slot: "터짐", candidate: "연쇄 3연발", dur: 0.18,
    // 머지가 이어질 때 실제로 들리는 모양. 뒤로 갈수록 음이 올라가 연쇄가 읽힌다
    render: (b) => [0, 0.055, 0.11].forEach((d, i) =>
      tone(b, d, { type: "sine", f0: 520 * (1 + i * 0.16), f1: 1250 * (1 + i * 0.16), dur: 0.07, peak: 0.5 })),
  },
  {
    file: "sfx-shot.wav", slot: "발사", candidate: "짧은 튕김", dur: 0.09,
    render: (b) => tone(b, 0, { type: "sine", f0: 900, f1: 230, dur: 0.09, peak: 0.5 }),
  },
  {
    file: "sfx-rescue.wav", slot: "구출", candidate: "종 울림", dur: 0.65,
    // 배음 세 개를 겹쳐 종을 만든다 — 2.76·5.4는 실제 종의 비조화 배음비다
    render: (b) => [1, 2.76, 5.4].forEach((m, i) =>
      tone(b, 0, { type: "sine", f0: N.e5 * m, dur: 0.65 - i * 0.12, peak: 0.34 / (i + 1) })),
  },
  {
    file: "sfx-fail.wav", slot: "실패", candidate: "김빠짐", dur: 0.42,
    // 동물을 구하는 게임이라 벌주는 소리로 만들지 않는다 — 가볍고 만화적인 미끄러짐
    render: (b) => tone(b, 0, { type: "sine", f0: 520, f1: 130, dur: 0.42, peak: 0.34 }),
  },
  {
    file: "sfx-tap.wav", slot: "버튼", candidate: "부드러운 틱", dur: 0.04,
    // 로비·설정·도감·확인창이 전부 이 하나를 쓴다. 가장 눈에 안 띄어야 하는 소리다
    render: (b) => tone(b, 0, { type: "sine", f0: 780, f1: 600, dur: 0.04, peak: 0.22 }),
  },
];

fs.mkdirSync(OUT, { recursive: true });
for (const p of PICKS) {
  const buf = new Float64Array(Math.round((p.dur + TAIL) * SR));
  p.render(buf);
  const r = writeWav(path.join(OUT, p.file), buf);
  console.log(
    `${p.file.padEnd(16)} ${p.slot.padEnd(4)} ${p.candidate.padEnd(10)} `
    + `${r.seconds.toFixed(2)}s ${String(r.bytes).padStart(6)}B`);
}
console.log(`\n${PICKS.length}개를 ${OUT}/에 썼다.`);
