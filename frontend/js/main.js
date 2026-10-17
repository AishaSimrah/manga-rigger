import * as api from "./api.js";
import { RigAnimator } from "./animator.js";
import { attachRigEditor } from "./rig-editor.js";
import { AudioAnalyzer } from "./audio.js";
import { recordScene } from "./recorder.js";

const $ = (sel) => document.querySelector(sel);
const canvas = $("#stage-canvas");
const audioEl = $("#audio");
const statusEl = $("#status");

const animator = new RigAnimator(canvas);
const analyzer = new AudioAnalyzer(audioEl);
animator.getLevel = () => analyzer.getLevel();

let current = null;       // { id, name, rig }
let selectedPart = null;
let saveTimer = null;

const setStatus = (msg) => { statusEl.textContent = msg; };
const showError = (err) => setStatus(`Error: ${err.message}`);

function scheduleSave() {
  if (!current) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try {
      await api.saveRig(current.id, current.rig);
      setStatus("Rig saved.");
    } catch (err) {
      showError(err);
    }
  }, 400);
}

function syncSettingsUI() {
  if (!current) return;
  document.querySelectorAll("[data-setting]").forEach((input) => {
    input.value = current.rig.settings[input.dataset.setting];
  });
}

async function loadCharacter(id) {
  const meta = await api.getCharacter(id);
  const img = new Image();
  img.src = `${api.imageUrl(id)}?v=${Date.now()}`;
  await img.decode();
  current = { id: meta.id, name: meta.name, rig: meta.rig };
  animator.setCharacter(img, current.rig);
  syncSettingsUI();
  setStatus(`Loaded "${meta.name}". Choose a part and drag a box over it.`);
}

async function refreshList() {
  const list = $("#char-list");
  list.innerHTML = "";
  for (const c of await api.listCharacters()) {
    const li = document.createElement("li");

    const open = document.createElement("button");
    open.textContent = c.name; // textContent: names can't inject HTML
    open.addEventListener("click", () => loadCharacter(c.id).catch(showError));

    const del = document.createElement("button");
    del.textContent = "×";
    del.title = "Delete";
    del.addEventListener("click", async () => {
      if (!confirm(`Delete "${c.name}"?`)) return;
      try {
        await api.deleteCharacter(c.id);
        if (current?.id === c.id) { current = null; animator.clear(); }
        await refreshList();
      } catch (err) {
        showError(err);
      }
    });

    li.append(open, del);
    list.append(li);
  }
}

// --- Upload
$("#upload-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const file = $("#char-file").files[0];
  if (!file) return;
  const name = $("#char-name").value.trim() || "Untitled";
  try {
    setStatus("Uploading... background removal can take a while the first time.");
    const meta = await api.createCharacter(file, name, $("#remove-bg").checked);
    await refreshList();
    await loadCharacter(meta.id);
    e.target.reset();
  } catch (err) {
    showError(err);
  }
});

// --- Rigging
document.querySelectorAll(".part-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    selectedPart = btn.dataset.part;
    animator.selected = selectedPart;
    document.querySelectorAll(".part-btn").forEach((b) => b.classList.toggle("active", b === btn));
    setStatus(`Drag a tight box around the ${btn.textContent.toLowerCase()}.`);
  });
});

attachRigEditor(canvas, animator, () => selectedPart, (part, box) => {
  if (!current) return;
  current.rig[part] = box;
  animator.setRig(current.rig);
  scheduleSave();
});

$("#clear-part").addEventListener("click", () => {
  if (!current || !selectedPart) return;
  current.rig[selectedPart] = null;
  animator.setRig(current.rig);
  scheduleSave();
});

// --- Settings sliders
document.querySelectorAll("[data-setting]").forEach((input) => {
  input.addEventListener("input", () => {
    if (!current) return;
    const s = current.rig.settings;
    s[input.dataset.setting] = Number(input.value);
    if (s.blink_max < s.blink_min) {
      if (input.dataset.setting === "blink_min") s.blink_max = s.blink_min;
      else s.blink_min = s.blink_max;
      syncSettingsUI();
    }
    scheduleSave();
  });
});

// --- Mode, background, audio
document.querySelectorAll('input[name="mode"]').forEach((radio) => {
  radio.addEventListener("change", () => { if (radio.checked) animator.setMode(radio.value); });
});

$("#bg-color").addEventListener("input", (e) => { animator.bg = e.target.value; });

$("#audio-file").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  if (audioEl.dataset.url) URL.revokeObjectURL(audioEl.dataset.url);
  const url = URL.createObjectURL(file);
  audioEl.dataset.url = url;
  audioEl.src = url;
  analyzer.init();
  setStatus("Audio loaded. Switch to Preview mode and press play.");
});

audioEl.addEventListener("play", () => analyzer.resume());

// --- Recording
$("#record-btn").addEventListener("click", async () => {
  if (!current) return setStatus("Load a character first.");
  if (!audioEl.src) return setStatus("Load an audio file first.");
  const btn = $("#record-btn");
  btn.disabled = true;
  try {
    document.querySelector('input[name="mode"][value="preview"]').checked = true;
    animator.setMode("preview");
    setStatus("Recording... it stops when the audio ends.");
    const blob = await recordScene({ canvas, audioEl, analyzer });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${current.name}-scene.webm`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    setStatus("Done. Your video was downloaded.");
  } catch (err) {
    showError(err);
  } finally {
    btn.disabled = false;
  }
});

refreshList().catch(showError);