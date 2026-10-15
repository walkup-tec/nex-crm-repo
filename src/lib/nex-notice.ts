let context: AudioContext | null = null;
let armed = false;
let busyUntil = 0;

function audioContext() {
  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  if (!context) context = new Ctx();
  return context;
}

function voiceForNex() {
  const voices = window.speechSynthesis?.getVoices() ?? [];
  return voices.find((item) => /pt-BR/i.test(item.lang)) || voices.find((item) => /^pt/i.test(item.lang)) || null;
}

export function armNexNotice() {
  const ctx = audioContext();
  if (ctx?.state === "suspended") void ctx.resume();
  armed = true;
  window.speechSynthesis?.getVoices();
}

function doorbell(ctx: AudioContext, frequency: number, delay: number, duration: number) {
  const start = ctx.currentTime + delay;
  const master = ctx.createGain();
  master.gain.setValueAtTime(0.0001, start);
  master.gain.exponentialRampToValueAtTime(0.72, start + 0.012);
  master.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  master.connect(ctx.destination);
  for (const [ratio, level] of [
    [1, 1],
    [2, 0.22],
    [3, 0.08],
  ] as const) {
    const tone = ctx.createOscillator();
    const gain = ctx.createGain();
    tone.type = "sine";
    tone.frequency.setValueAtTime(frequency * ratio, start);
    gain.gain.value = level;
    tone.connect(gain).connect(master);
    tone.start(start);
    tone.stop(start + duration + 0.02);
  }
}

function speakNex() {
  const synth = window.speechSynthesis;
  if (!synth) return;
  const utter = new SpeechSynthesisUtterance("Nex");
  utter.lang = "pt-BR";
  utter.rate = 0.86;
  utter.pitch = 1;
  utter.volume = 1;
  const voice = voiceForNex();
  if (voice) utter.voice = voice;
  synth.cancel();
  synth.speak(utter);
}

export function playNexNotice() {
  const ctx = audioContext();
  if (!armed || !ctx || Date.now() < busyUntil) return;
  if (ctx.state === "suspended") void ctx.resume();
  busyUntil = Date.now() + 3200;
  doorbell(ctx, 880, 0, 0.46);
  doorbell(ctx, 659, 0.42, 0.82);
  window.setTimeout(speakNex, 1250);
}
