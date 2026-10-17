async function request(url, options) {
  const res = await fetch(url, options);
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail ?? detail;
    } catch { /* body was not JSON */ }
    throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
  }
  return res.json();
}

export const listCharacters = () => request("/api/characters");
export const getCharacter = (id) => request(`/api/characters/${id}`);
export const deleteCharacter = (id) => request(`/api/characters/${id}`, { method: "DELETE" });
export const imageUrl = (id) => `/api/characters/${id}/image`;

export function createCharacter(file, name, removeBg) {
  const form = new FormData();
  form.append("file", file);
  form.append("name", name);
  form.append("remove_bg", removeBg ? "true" : "false");
  return request("/api/characters", { method: "POST", body: form });
}

export function saveRig(id, rig) {
  return request(`/api/characters/${id}/rig`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(rig),
  });
}