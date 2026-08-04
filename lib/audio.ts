// Convert whatever the iPhone hands us (.m4a from Voice Memos, usually AAC)
// into the 48 kHz mono WAV that BirdNET wants — entirely in the browser.
//
// Why here and not on the server: Vercel functions have no ffmpeg, and Safari
// already ships a hardware AAC decoder. Doing it client-side costs us nothing,
// skips a whole dependency, and means we upload a file we know is valid rather
// than discovering it isn't after the round trip.

export const TARGET_SAMPLE_RATE = 48000;

export type DecodedAudio = {
  wav: Blob;
  durationSeconds: number;
};

/**
 * Decode an audio file and re-encode it as 48 kHz mono 16-bit WAV.
 * Throws with a human-readable message if the browser can't decode the format.
 */
export async function toBirdnetWav(file: File): Promise<DecodedAudio> {
  const bytes = await file.arrayBuffer();

  // A plain AudioContext decodes using the platform codecs — this is what lets
  // Safari handle AAC/.m4a without us shipping a decoder.
  const decodeCtx = new AudioContext();
  let decoded: AudioBuffer;
  try {
    decoded = await decodeCtx.decodeAudioData(bytes);
  } catch (cause) {
    throw new Error(
      `Could not read "${file.name}". Voice Memos files (.m4a) and .wav both work — ` +
        `if this came from somewhere else, try exporting it as one of those.`,
      { cause },
    );
  } finally {
    void decodeCtx.close();
  }

  // Resample + downmix to mono in one pass. BirdNET is mono-only, and averaging
  // the channels keeps a bird that only landed in one of them.
  const frameCount = Math.ceil(decoded.duration * TARGET_SAMPLE_RATE);
  const offline = new OfflineAudioContext(1, frameCount, TARGET_SAMPLE_RATE);
  const source = offline.createBufferSource();
  source.buffer = decoded;
  source.connect(offline.destination);
  source.start();
  const rendered = await offline.startRendering();

  return {
    wav: encodeWav(rendered.getChannelData(0), TARGET_SAMPLE_RATE),
    durationSeconds: decoded.duration,
  };
}

/** Float samples (-1..1) to a 16-bit PCM WAV blob. */
function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const bytesPerSample = 2;
  const buffer = new ArrayBuffer(44 + samples.length * bytesPerSample);
  const view = new DataView(buffer);

  const writeAscii = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
  };

  const dataBytes = samples.length * bytesPerSample;
  writeAscii(0, "RIFF");
  view.setUint32(4, 36 + dataBytes, true);
  writeAscii(8, "WAVE");
  writeAscii(12, "fmt ");
  view.setUint32(16, 16, true); // PCM header size
  view.setUint16(20, 1, true); // format: PCM
  view.setUint16(22, 1, true); // channels: mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * bytesPerSample, true); // byte rate
  view.setUint16(32, bytesPerSample, true); // block align
  view.setUint16(34, 8 * bytesPerSample, true); // bits per sample
  writeAscii(36, "data");
  view.setUint32(40, dataBytes, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    // Clamp before scaling, otherwise anything hot wraps around and clicks.
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
    offset += bytesPerSample;
  }

  return new Blob([buffer], { type: "audio/wav" });
}
