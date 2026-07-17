/* ============================================================
   WHRL DIAGNOSTICS — AUDIO INPUT
   ============================================================
   Responsible for exactly one thing: getting raw PCM samples
   into memory, regardless of whether they came from an
   uploaded file or a live microphone recording.

   Everything downstream (recovery-engine.js, spectrogram-render.js)
   works with the same plain shape:

     { samples: Float32Array, sampleRate: number, duration: number }

   Neither of those modules needs to know or care which input
   method was used. That separation is deliberate — it's what
   lets future waves add new input methods (e.g. a "hold phone
   up to the cassette deck" flow) without touching any analysis
   code at all.
   ============================================================ */

const WHRLAudioInput = (() => {

  let audioContext = null;

  function getContext() {
    if (!audioContext) {
      // Safari requires the webkit-prefixed constructor on some
      // older versions; this fallback costs nothing and avoids
      // a silent failure on first load.
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioContext;
  }

  /**
   * Decodes an uploaded audio file into raw samples.
   * @param {File} file
   * @returns {Promise<{samples: Float32Array, sampleRate: number, duration: number}>}
   */
  async function loadFromFile(file) {
    const ctx = getContext();
    const arrayBuffer = await file.arrayBuffer();
    // decodeAudioData is callback-based in older Safari; the
    // promise form works in all currently-supported browsers,
    // but if this ever needs wider legacy support, wrap it in
    // the classic (buffer, resolve, reject) three-arg form here.
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    return extractMonoSamples(audioBuffer);
  }

  /**
   * Records a fixed duration from the microphone.
   * @param {number} durationSeconds
   * @param {function(number):void} [onProgress] optional 0-1 progress callback
   * @returns {Promise<{samples: Float32Array, sampleRate: number, duration: number}>}
   */
  async function recordFromMicrophone(durationSeconds, onProgress) {
    const ctx = getContext();
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const source = ctx.createMediaStreamSource(stream);

    // MediaRecorder is the simplest reliable path for a fixed-length
    // capture across current browsers, including iOS Safari 14.5+.
    // We record to a Blob, then reuse loadFromFile's decode path
    // rather than duplicating decode logic.
    const recorder = new MediaRecorder(stream);
    const chunks = [];
    recorder.ondataavailable = (e) => chunks.push(e.data);

    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      let progressTimer = null;

      if (onProgress) {
        progressTimer = setInterval(() => {
          const elapsed = (Date.now() - startTime) / 1000;
          onProgress(Math.min(elapsed / durationSeconds, 1));
        }, 100);
      }

      recorder.onstop = async () => {
        if (progressTimer) clearInterval(progressTimer);
        stream.getTracks().forEach(track => track.stop());
        try {
          const blob = new Blob(chunks, { type: recorder.mimeType });
          const file = new File([blob], "microphone-capture", { type: recorder.mimeType });
          const result = await loadFromFile(file);
          resolve(result);
        } catch (err) {
          reject(err);
        }
      };

      recorder.start();
      setTimeout(() => recorder.stop(), durationSeconds * 1000);
    });
  }

  /**
   * Converts a decoded AudioBuffer into mono Float32 samples.
   * Multi-channel sources are averaged down to mono — the
   * analysis pipeline only ever needs one channel.
   */
  function extractMonoSamples(audioBuffer) {
    const channels = audioBuffer.numberOfChannels;
    const length = audioBuffer.length;
    const mono = new Float32Array(length);

    for (let ch = 0; ch < channels; ch++) {
      const data = audioBuffer.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        mono[i] += data[i] / channels;
      }
    }

    return {
      samples: mono,
      sampleRate: audioBuffer.sampleRate,
      duration: audioBuffer.duration
    };
  }

  return { loadFromFile, recordFromMicrophone, getContext };
})();
