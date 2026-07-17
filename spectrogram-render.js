/* ============================================================
   WHRL DIAGNOSTICS — SPECTROGRAM ENGINE
   ============================================================
   Self-contained FFT and spectrogram rendering. No external
   libraries — this is a from-scratch radix-2 Cooley-Tukey FFT,
   which is the standard, well-understood algorithm for this
   exact job and easy for a future maintainer to verify against
   any textbook description of it.

   This module knows nothing about "recovery," "carriers," or
   any of the fictional framing — it only knows how to turn
   PCM samples into a 2D time/frequency magnitude image. That
   framing is applied one layer up, in recovery-engine.js.
   ============================================================ */

const WHRLSpectrogram = (() => {

  /**
   * In-place radix-2 FFT. Input length must be a power of 2.
   * Standard Cooley-Tukey decimation-in-time implementation.
   * @param {Float32Array} real
   * @param {Float32Array} imag
   */
  function fft(real, imag) {
    const n = real.length;
    if (n <= 1) return;

    // Bit-reversal permutation
    for (let i = 1, j = 0; i < n; i++) {
      let bit = n >> 1;
      for (; j & bit; bit >>= 1) j ^= bit;
      j ^= bit;
      if (i < j) {
        [real[i], real[j]] = [real[j], real[i]];
        [imag[i], imag[j]] = [imag[j], imag[i]];
      }
    }

    // Butterfly computation
    for (let len = 2; len <= n; len <<= 1) {
      const halfLen = len >> 1;
      const angleStep = (-2 * Math.PI) / len;
      for (let i = 0; i < n; i += len) {
        for (let k = 0; k < halfLen; k++) {
          const angle = angleStep * k;
          const wr = Math.cos(angle);
          const wi = Math.sin(angle);
          const evenIdx = i + k;
          const oddIdx = i + k + halfLen;
          const tr = real[oddIdx] * wr - imag[oddIdx] * wi;
          const ti = real[oddIdx] * wi + imag[oddIdx] * wr;
          real[oddIdx] = real[evenIdx] - tr;
          imag[oddIdx] = imag[evenIdx] - ti;
          real[evenIdx] += tr;
          imag[evenIdx] += ti;
        }
      }
    }
  }

  /**
   * Hann window — standard choice for spectrogram analysis,
   * reduces spectral leakage at the edges of each segment.
   */
  function hannWindow(size) {
    const w = new Float32Array(size);
    for (let i = 0; i < size; i++) {
      w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (size - 1));
    }
    return w;
  }

  /**
   * Computes a spectrogram from raw samples.
   *
   * @param {Float32Array} samples
   * @param {object} [opts]
   * @param {number} [opts.fftSize=1024] must be a power of 2
   * @param {number} [opts.overlap=0.5] fraction of window overlap, 0-0.9
   * @returns {{columns: Float32Array[], fftSize: number, sampleRate: number}}
   *   Each column is a magnitude-in-dB array of length fftSize/2
   *   (only the lower half of the spectrum is meaningful for
   *   real-valued input).
   */
  function computeSpectrogram(samples, sampleRate, opts = {}) {
    const fftSize = opts.fftSize || 1024;
    const overlap = opts.overlap !== undefined ? opts.overlap : 0.5;
    const hopSize = Math.floor(fftSize * (1 - overlap));
    const window = hannWindow(fftSize);
    const columns = [];

    for (let start = 0; start + fftSize <= samples.length; start += hopSize) {
      const real = new Float32Array(fftSize);
      const imag = new Float32Array(fftSize);
      for (let i = 0; i < fftSize; i++) {
        real[i] = samples[start + i] * window[i];
      }
      fft(real, imag);

      // Magnitude spectrum, converted to dB, lower half only
      // (real-valued input produces a mirrored upper half).
      const half = fftSize / 2;
      const col = new Float32Array(half);
      for (let i = 0; i < half; i++) {
        const mag = Math.sqrt(real[i] * real[i] + imag[i] * imag[i]);
        // Small epsilon avoids -Infinity on pure silence.
        col[i] = 20 * Math.log10(mag + 1e-6);
      }
      columns.push(col);
    }

    return { columns, fftSize, sampleRate };
  }

  /**
   * Renders a computed spectrogram onto a canvas.
   *
   * @param {{columns: Float32Array[], fftSize: number, sampleRate: number}} spectrogram
   * @param {HTMLCanvasElement} canvas
   * @param {object} [opts]
   * @param {number} [opts.brightness=0]  additive, roughly -40..40
   * @param {number} [opts.contrast=1]    multiplicative, roughly 0.3..3
   * @param {number} [opts.minFreqHz=0]
   * @param {number} [opts.maxFreqHz]     defaults to Nyquist
   */
  function renderToCanvas(spectrogram, canvas, opts = {}) {
    const { columns, fftSize, sampleRate } = spectrogram;
    const brightness = opts.brightness || 0;
    const contrast = opts.contrast !== undefined ? opts.contrast : 1;
    const nyquist = sampleRate / 2;
    const minFreq = opts.minFreqHz || 0;
    const maxFreq = opts.maxFreqHz || nyquist;

    const width = columns.length;
    const binCount = fftSize / 2;
    const minBin = Math.floor((minFreq / nyquist) * binCount);
    const maxBin = Math.ceil((maxFreq / nyquist) * binCount);
    const height = maxBin - minBin;

    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    const imageData = ctx.createImageData(width, height);

    // Typical magnitude range after dB conversion — used to
    // normalize into 0-255 grayscale before brightness/contrast.
    const dbFloor = -90;
    const dbCeil = 10;

    for (let x = 0; x < width; x++) {
      const col = columns[x];
      for (let binOffset = 0; binOffset < height; binOffset++) {
        const bin = minBin + binOffset;
        const db = col[bin] !== undefined ? col[bin] : dbFloor;
        let norm = (db - dbFloor) / (dbCeil - dbFloor);
        norm = norm * contrast + brightness / 255;
        norm = Math.max(0, Math.min(1, norm));
        const value = Math.round(norm * 255);

        // Flip vertically: low frequency at the bottom, matching
        // how a real spectrogram / real engineering scope reads.
        const y = height - 1 - binOffset;
        const pixelIndex = (y * width + x) * 4;
        imageData.data[pixelIndex] = value;
        imageData.data[pixelIndex + 1] = value;
        imageData.data[pixelIndex + 2] = value;
        imageData.data[pixelIndex + 3] = 255;
      }
    }

    ctx.putImageData(imageData, 0, 0);
  }

  return { fft, computeSpectrogram, renderToCanvas };
})();
