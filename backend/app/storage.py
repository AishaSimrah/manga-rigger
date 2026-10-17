import json
import shutil
import uuid
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = PROJECT_ROOT / "data"
CHAR_DIR = DATA_DIR / "characters"


def ensure_dirs() -> None:
    CHAR_DIR.mkdir(parents=True, exist_ok=True)


def new_id() -> str:
    return uuid.uuid4().hex


def char_folder(char_id: str) -> Path:
    # Only letters/digits allowed: blocks path traversal like "../../x"
    if not char_id.isalnum():
        raise ValueError("invalid character id")
    return CHAR_DIR / char_id


def save_meta(char_id: str, meta: dict) -> None:
    folder = char_folder(char_id)
    tmp = folder / "meta.json.tmp"
    tmp.write_text(json.dumps(meta, indent=2), encoding="utf-8")
    tmp.replace(folder / "meta.json")


def load_meta(char_id: str) -> dict | None:
    path = char_folder(char_id) / "meta.json"
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def list_metas() -> list[dict]:
    ensure_dirs()
    metas = []
    for folder in sorted(CHAR_DIR.iterdir()):
        if folder.is_dir():
            meta = load_meta(folder.name)
            if meta:
                metas.append(meta)
    return metas


def delete_character(char_id: str) -> bool:
    folder = char_folder(char_id)
    if not folder.exists():
        return False
    shutil.rmtree(folder)
    return True
    