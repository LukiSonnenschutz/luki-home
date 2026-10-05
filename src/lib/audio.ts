export const alarmTones = ["bell", "digital", "soft", "alert"] as const;
export type AlarmTone = (typeof alarmTones)[number];
/** Original synthesized signals: no downloaded/copyrighted audio assets. */
export function toneSamples(
  tone: AlarmTone,
  volume: number,
  sampleRate = 44100,
) {
  const samples = new Float32Array(Math.ceil(sampleRate * 1.3));
  for (let i = 0; i < samples.length; i++) {
    const t = i / sampleRate;
    let value = 0;
    if (tone === "bell")
      value =
        (Math.sin(2 * Math.PI * 880 * t) +
          0.3 * Math.sin(2 * Math.PI * 1320 * t)) *
        Math.exp(-4 * t);
    if (tone === "soft")
      value =
        Math.sin(2 * Math.PI * 440 * t) *
        Math.exp(-3 * t) *
        Math.min(1, t * 25);
    if (tone === "digital")
      value =
        (t % 0.35 < 0.17 ? Math.sin(2 * Math.PI * 1046 * t) : 0) * Math.exp(-t);
    if (tone === "alert")
      value =
        (t % 0.3 < 0.2
          ? Math.sin(2 * Math.PI * (Math.floor(t / 0.3) % 2 ? 990 : 660) * t)
          : 0) * Math.exp(-t);
    samples[i] = Math.tanh(value) * Math.max(0, Math.min(1, volume)) * 0.3;
  }
  return samples;
}
let context: AudioContext | null = null;
export async function unlockAudio() {
  if (!context) context = new AudioContext();
  if (context.state !== "running") await context.resume();
  return context.state === "running";
}
export function playTone(tone: AlarmTone, volume: number) {
  if (!context || context.state !== "running" || volume <= 0) return false;
  const samples = toneSamples(tone, volume, context.sampleRate),
    buffer = context.createBuffer(1, samples.length, context.sampleRate);
  buffer.getChannelData(0).set(samples);
  const source = context.createBufferSource();
  source.buffer = buffer;
  source.connect(context.destination);
  source.start();
  source.onended = () => source.disconnect();
  return true;
}
