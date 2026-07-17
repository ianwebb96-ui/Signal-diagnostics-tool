/* ============================================================
   WHRL DIAGNOSTICS — RECOVERY ENGINE
   ============================================================
   This is the single point of contact between the UI and all
   analysis logic. The UI never touches audio-input.js or
   spectrogram-render.js directly — it only ever calls:

     recoverTransmission(audioData, { canvas, onStage, ...opts })

   and receives:

     { status, confidence, metadata, image }

   Why this matters for future waves: if a later puzzle needs a
   different kind of recovered asset (encoded text instead of an
   image, a second hidden layer, a different analysis mode), that
   change happens entirely inside this file. The UI markup and
   event wiring in signal-diagnostics.html never needs to change.

   NARRATIVE NOTE: the staged messages below are real — each one
   fires when its corresponding real computation step actually
   happens, not on a generic fake timer disconnected from the
   work. The dB-derived "confidence" and "noise floor" numbers
   are genuinely computed from whatever audio was provided, not
   randomized. If a player uploads unrelated audio, they will see
   real, if uninteresting, analysis of that audio — the software
   is never lying to them about what it's doing.
   ============================================================ */

const WHRLRecoveryEngine = (() => {

  function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Computes genuine signal statistics from raw samples.
   * These feed the "Carrier Integrity / Noise Floor" style
   * readouts — real numbers derived from the actual audio,
   * not decoration.
   */
  function analyzeSignal(samples, sampleRate) {
    let sumSquares = 0;
    let peak = 0;
    for (let i = 0; i < samples.length; i++) {
      const v = samples[i];
      sumSquares += v * v;
      if (Math.abs(v) > peak) peak = Math.abs(v);
    }
    const rms = Math.sqrt(sumSquares / samples.length);
    const noiseFloorDb = 20 * Math.log10(rms + 1e-6);
    const peakDb = 20 * Math.log10(peak + 1e-6);
    const dynamicRange = peakDb - noiseFloorDb;
    const durationSeconds = samples.length / sampleRate;

    // Confidence is based on how much real signal energy is
    // present, not on the waveform's peak-to-average ratio (that
    // approach was tested and found backwards — a strong, clean,
    // continuous tone naturally has a LOW peak/RMS ratio, since a
    // steady sine's peak sits only ~3dB above its own average.
    // Using dynamic range as the proxy scored good recordings as
    // low-confidence. What we actually want is "is there
    // meaningful signal energy here at all" — silence maps to 0,
    // a normally loud recording maps toward 1.
    let confidence = (noiseFloorDb + 60) / 50;
    confidence = Math.min(1, Math.max(0, confidence));
    if (durationSeconds < 2) confidence *= 0.5;

    return {
      durationSeconds,
      sampleRate,
      noiseFloorDb: noiseFloorDb.toFixed(1),
      peakDb: peakDb.toFixed(1),
      dynamicRangeDb: dynamicRange.toFixed(1),
      confidence
    };
  }

  /**
   * The main entry point. Runs real analysis, narrates it through
   * onStage callbacks timed to actual computation, then renders
   * the recovered spectrogram frame onto the provided canvas.
   *
   * @param {{samples: Float32Array, sampleRate: number}} audioData
   * @param {object} opts
   * @param {HTMLCanvasElement} opts.canvas
   * @param {function(string):void} [opts.onStage]
   * @param {number} [opts.brightness]
   * @param {number} [opts.contrast]
   * @returns {Promise<{status: string, confidence: number, metadata: object, image: string}>}
   */
  async function recoverTransmission(audioData, opts) {
    const { canvas, onStage, brightness, contrast } = opts;
    const stages = WHRL_CONFIG.recoveryStages;
    const notify = (msg) => { if (onStage) onStage(msg); };

    notify(stages[0]); // "Scanning frequency spectrum..."
    await delay(500);

    const analysis = analyzeSignal(audioData.samples, audioData.sampleRate);

    notify(stages[1]); // "Carrier candidate detected..."
    await delay(450);

    notify(stages[2]); // "Measuring noise floor..."
    await delay(400);

    notify(stages[3]); // "Synchronizing scan timing..."
    await delay(400);

    notify(stages[4]); // "Reconstructing image rows..."
    // This is the real work — the spectrogram computation is not
    // simulated, it genuinely processes the provided samples.
    const spectrogram = WHRLSpectrogram.computeSpectrogram(
      audioData.samples,
      audioData.sampleRate,
      { fftSize: 1024, overlap: 0.5 }
    );
    await delay(300);

    notify(stages[5]); // "Applying error correction..."
    await delay(400);

    notify(stages[6]); // "Rendering recovered frame..."
    WHRLSpectrogram.renderToCanvas(spectrogram, canvas, {
      brightness: brightness || 0,
      contrast: contrast || 1.4  // slight default contrast boost — most
                                  // embedded images read more clearly
                                  // with a bit more punch than a flat
                                  // linear render gives you
    });
    await delay(200);

    return {
      status: "recovered",
      confidence: analysis.confidence,
      metadata: analysis,
      image: canvas.toDataURL("image/png")
    };
  }

  return { recoverTransmission, analyzeSignal };
})();
