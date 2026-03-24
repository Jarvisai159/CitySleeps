// ─── Voice Narration (Web Speech API) ────────────────────

export type VoiceType = "male" | "female";

let voicesLoaded = false;
let selectedVoiceType: VoiceType = "male";

export function setVoiceType(type: VoiceType) {
  selectedVoiceType = type;
}

export function getVoiceType(): VoiceType {
  return selectedVoiceType;
}

function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    const voices = speechSynthesis.getVoices();
    if (voices.length > 0) {
      voicesLoaded = true;
      resolve(voices);
      return;
    }
    speechSynthesis.onvoiceschanged = () => {
      voicesLoaded = true;
      resolve(speechSynthesis.getVoices());
    };
    // Fallback timeout
    setTimeout(() => resolve(speechSynthesis.getVoices()), 1000);
  });
}

function getMaleVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  // Deep, authoritative "god" voice
  const preferred = [
    "Google UK English Male",
    "Microsoft David",
    "Microsoft Mark",
    "Daniel",
    "Alex",
    "Google US English",
  ];
  for (const name of preferred) {
    const v = voices.find((voice) => voice.name.includes(name));
    if (v) return v;
  }
  // Fall back to any English male-sounding voice
  const male = voices.find(
    (v) => v.lang.startsWith("en") && /male|david|mark|daniel|james|guy/i.test(v.name)
  );
  return male ?? voices.find((v) => v.lang.startsWith("en")) ?? voices[0] ?? null;
}

function getFemaleVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  // Sensual, relaxed feminine voice
  const preferred = [
    "Google UK English Female",
    "Microsoft Zira",
    "Samantha",
    "Karen",
    "Victoria",
    "Moira",
    "Tessa",
    "Google US English",
  ];
  for (const name of preferred) {
    const v = voices.find((voice) => voice.name.includes(name));
    if (v) return v;
  }
  // Fall back to any English female-sounding voice
  const female = voices.find(
    (v) =>
      v.lang.startsWith("en") &&
      /female|zira|samantha|karen|victoria|moira|tessa|fiona|susan/i.test(v.name)
  );
  return female ?? voices.find((v) => v.lang.startsWith("en")) ?? voices[0] ?? null;
}

export async function speak(text: string): Promise<void> {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

  // Cancel any ongoing speech
  speechSynthesis.cancel();

  const voices = await loadVoices();
  const voice =
    selectedVoiceType === "female" ? getFemaleVoice(voices) : getMaleVoice(voices);

  // Male: deep, slow, commanding. Female: smooth, relaxed, slightly breathy.
  const rate = selectedVoiceType === "female" ? 0.85 : 0.9;
  const pitch = selectedVoiceType === "female" ? 1.1 : 0.75;

  // Small delay after cancel() — some browsers (Chrome) drop the next
  // utterance if it's queued immediately after cancel().
  await new Promise((r) => setTimeout(r, 50));

  return new Promise((resolve) => {
    const utterance = new SpeechSynthesisUtterance(text);
    if (voice) utterance.voice = voice;
    utterance.rate = rate;
    utterance.pitch = pitch;
    utterance.volume = 1;
    utterance.onend = () => resolve();
    utterance.onerror = () => resolve();
    speechSynthesis.speak(utterance);

    // Chrome bug: long utterances pause after ~15s. Keep-alive workaround.
    const keepAlive = setInterval(() => {
      if (!speechSynthesis.speaking) {
        clearInterval(keepAlive);
      } else {
        speechSynthesis.pause();
        speechSynthesis.resume();
      }
    }, 10000);
    utterance.onend = () => { clearInterval(keepAlive); resolve(); };
    utterance.onerror = () => { clearInterval(keepAlive); resolve(); };
  });
}

export function stopSpeech() {
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    speechSynthesis.cancel();
  }
}

// ─── Tone Effects (Web Audio API) ────────────────────────

let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!audioCtx) audioCtx = new AudioContext();
  // Resume if suspended (browser autoplay policy)
  if (audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}

/**
 * Call this on a user gesture (e.g. "Start Game" click) to unlock
 * both AudioContext and SpeechSynthesis for the session.
 */
export function unlockAudio() {
  // Unlock AudioContext
  const ctx = getCtx();
  if (ctx.state === "suspended") ctx.resume();

  // Unlock SpeechSynthesis by speaking an empty utterance
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    const utterance = new SpeechSynthesisUtterance("");
    utterance.volume = 0;
    speechSynthesis.speak(utterance);
  }
}

function playTone(
  freq: number,
  duration: number,
  type: OscillatorType = "sine",
  volume = 0.3
) {
  try {
    const ctx = getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch {
    // Audio not available
  }
}

export function playNightChime() {
  playTone(220, 1.5, "sine", 0.15);
  setTimeout(() => playTone(165, 1.5, "sine", 0.12), 400);
  setTimeout(() => playTone(131, 2, "sine", 0.1), 800);
}

export function playDawnChime() {
  playTone(262, 0.6, "sine", 0.15);
  setTimeout(() => playTone(330, 0.6, "sine", 0.15), 250);
  setTimeout(() => playTone(392, 0.6, "sine", 0.15), 500);
  setTimeout(() => playTone(523, 1, "sine", 0.2), 750);
}

export function playVoteSound() {
  playTone(200, 0.12, "square", 0.08);
}

export function playEliminationSound() {
  playTone(220, 0.5, "sawtooth", 0.12);
  setTimeout(() => playTone(185, 0.5, "sawtooth", 0.1), 300);
  setTimeout(() => playTone(147, 1, "sawtooth", 0.08), 600);
}

export function playVictorySound() {
  [523, 659, 784, 1047].forEach((f, i) => {
    setTimeout(() => playTone(f, 0.4, "sine", 0.15), i * 200);
  });
}
