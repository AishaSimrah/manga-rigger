export async function recordScene({ canvas, audioEl, analyzer, fps = 30 }) {
  await analyzer.resume();

  const mime = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ].find((m) => MediaRecorder.isTypeSupported(m));
  if (!mime) throw new Error("This browser cannot record WebM video. Try Chrome or Edge.");

  const stream = canvas.captureStream(fps);
  analyzer.streamDest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));

  const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 5_000_000 });
  const chunks = [];
  recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  const finished = new Promise((resolve) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: "video/webm" }));
  });

  audioEl.currentTime = 0;
  audioEl.addEventListener("ended", () => setTimeout(() => recorder.stop(), 300), { once: true });
  recorder.start();
  await audioEl.play();
  return finished;
}
