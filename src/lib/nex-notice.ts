let context: AudioContext | null = null;
let armed = false;
let busyUntil = 0;
let voiceBuffer: AudioBuffer | null = null;
let voiceLoading: Promise<AudioBuffer | null> | null = null;
let keeper: OscillatorNode | null = null;

function audioContext() {
  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  if (!context) context = new Ctx();
  return context;
}

function loadVoice(ctx: AudioContext) {
  if (voiceBuffer) return Promise.resolve(voiceBuffer);
  voiceLoading ??= fetch("/nex-voice.wav")
    .then((response) => response.arrayBuffer())
    .then((data) => ctx.decodeAudioData(data))
    .then((buffer) => {
      voiceBuffer = buffer;
      return buffer;
    })
    .catch(() => null);
  return voiceLoading;
}

function keepAudible(ctx: AudioContext) {
  if (keeper) return;
  const gain = ctx.createGain();
  gain.gain.value = 0.0001;
  const tone = ctx.createOscillator();
  tone.frequency.value = 40;
  tone.connect(gain).connect(ctx.destination);
  tone.start();
  keeper = tone;
}

export function armNexNotice() {
  const ctx = audioContext();
  if (ctx?.state === "suspended") void ctx.resume();
  armed = true;
  if (ctx) {
    keepAudible(ctx);
    void loadVoice(ctx);
  }
}

function doorbell(ctx: AudioContext, frequency: number, delay: number, duration: number) {
  const start = ctx.currentTime + delay;
  const master = ctx.createGain();
  master.gain.setValueAtTime(0.0001, start);
  master.gain.exponentialRampToValueAtTime(0.58, start + 0.012);
  master.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  master.connect(ctx.destination);
  for (const [ratio, level] of [
    [1, 1],
    [2, 0.12],
    [3, 0.03],
  ] as const) {
    const tone = ctx.createOscillator();
    const gain = ctx.createGain();
    tone.type = "sine";
    tone.frequency.setValueAtTime(frequency * ratio, start);
    tone.frequency.exponentialRampToValueAtTime(frequency * ratio * 0.96, start + duration);
    gain.gain.value = level;
    tone.connect(gain).connect(master);
    tone.start(start);
    tone.stop(start + duration + 0.02);
  }
}

function playVoice(ctx: AudioContext) {
  void loadVoice(ctx).then((buffer) => {
    if (!buffer) return;
    const source = ctx.createBufferSource();
    const gain = ctx.createGain();
    source.buffer = buffer;
    gain.gain.value = 1;
    source.connect(gain).connect(ctx.destination);
    source.start();
  });
}

export function playNexNotice() {
  const ctx = audioContext();
  if (!armed || !ctx || Date.now() < busyUntil) return;
  busyUntil = Date.now() + 2600;
  const start = () => {
    doorbell(ctx, 2093, 0, 0.32);
    doorbell(ctx, 1568, 0.24, 0.62);
    window.setTimeout(() => playVoice(ctx), 880);
  };
  if (ctx.state === "suspended") {
    void ctx.resume().then(() => {
      if (ctx.state === "running") start();
    });
    return;
  }
  start();
}
