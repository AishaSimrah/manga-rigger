import io
import mimetypes

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from PIL import Image, UnidentifiedImageError

from . import storage
from .models import Rig

# Windows sometimes serves .js as text/plain, which breaks ES modules.
mimetypes.add_type("text/javascript", ".js")

MAX_UPLOAD_BYTES = 10 * 1024 * 1024
MAX_IMAGE_SIDE = 2048
FRONTEND_DIR = storage.PROJECT_ROOT / "frontend"

app = FastAPI(title="Manga Rigger")
storage.ensure_dirs()


def _get_or_404(char_id: str) -> dict:
    try:
        meta = storage.load_meta(char_id)
    except ValueError:
        meta = None
    if meta is None:
        raise HTTPException(status_code=404, detail="Character not found")
    return meta


@app.post("/api/characters")
def create_character(
    file: UploadFile = File(...),
    name: str = Form("Untitled"),
    remove_bg: bool = Form(False),
):
    raw = file.file.read()
    if len(raw) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Image larger than 10 MB")
    try:
        img = Image.open(io.BytesIO(raw))
        img.load()
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError):
        raise HTTPException(status_code=400, detail="That file is not a valid image")

    img = img.convert("RGBA")
    img.thumbnail((MAX_IMAGE_SIDE, MAX_IMAGE_SIDE))

    if remove_bg:
        try:
            from rembg import remove
        except ImportError:
            raise HTTPException(
                status_code=501,
                detail='rembg is not installed. Run: pip install "rembg[cpu]"',
            )
        img = remove(img)

    char_id = storage.new_id()
    folder = storage.char_folder(char_id)
    folder.mkdir(parents=True)
    img.save(folder / "character.png")

    meta = {
        "id": char_id,
        "name": name.strip()[:80] or "Untitled",
        "width": img.width,
        "height": img.height,
        "rig": Rig().model_dump(),
    }
    storage.save_meta(char_id, meta)
    return meta


@app.get("/api/characters")
def list_characters():
    return storage.list_metas()


@app.get("/api/characters/{char_id}")
def get_character(char_id: str):
    return _get_or_404(char_id)


@app.get("/api/characters/{char_id}/image")
def get_character_image(char_id: str):
    _get_or_404(char_id)
    return FileResponse(
        storage.char_folder(char_id) / "character.png", media_type="image/png"
    )


@app.put("/api/characters/{char_id}/rig")
def update_rig(char_id: str, rig: Rig):
    meta = _get_or_404(char_id)
    meta["rig"] = rig.model_dump()
    storage.save_meta(char_id, meta)
    return meta


@app.delete("/api/characters/{char_id}")
def delete_character(char_id: str):
    _get_or_404(char_id)
    storage.delete_character(char_id)
    return {"ok": True}


# Must be last: serves the frontend at http://127.0.0.1:8000/
app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")