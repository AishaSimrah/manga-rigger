import io

from fastapi.testclient import TestClient
from PIL import Image

from app import storage
from app.main import app


def make_png() -> io.BytesIO:
    buf = io.BytesIO()
    Image.new("RGBA", (100, 200), (255, 0, 0, 255)).save(buf, format="PNG")
    buf.seek(0)
    return buf


def test_create_save_rig_and_load(tmp_path, monkeypatch):
    monkeypatch.setattr(storage, "CHAR_DIR", tmp_path)
    client = TestClient(app)

    r = client.post(
        "/api/characters",
        files={"file": ("a.png", make_png(), "image/png")},
        data={"name": "Test"},
    )
    assert r.status_code == 200
    char_id = r.json()["id"]

    rig = {
        "left_eye": {"cx": 0.4, "cy": 0.3, "w": 0.1, "h": 0.05},
        "right_eye": None,
        "mouth": None,
        "settings": {
            "breath_amount": 0.02, "breath_speed": 0.3,
            "blink_min": 2, "blink_max": 5, "mouth_sensitivity": 4,
        },
    }
    assert client.put(f"/api/characters/{char_id}/rig", json=rig).status_code == 200
    saved = client.get(f"/api/characters/{char_id}").json()
    assert saved["rig"]["left_eye"]["cx"] == 0.4


def test_rejects_non_image(tmp_path, monkeypatch):
    monkeypatch.setattr(storage, "CHAR_DIR", tmp_path)
    client = TestClient(app)
    r = client.post(
        "/api/characters",
        files={"file": ("a.txt", io.BytesIO(b"hello"), "text/plain")},
    )
    assert r.status_code == 400


def test_rejects_bad_blink_range(tmp_path, monkeypatch):
    monkeypatch.setattr(storage, "CHAR_DIR", tmp_path)
    client = TestClient(app)
    char_id = client.post(
        "/api/characters", files={"file": ("a.png", make_png(), "image/png")}
    ).json()["id"]
    bad = {"settings": {"blink_min": 8, "blink_max": 3}}
    assert client.put(f"/api/characters/{char_id}/rig", json=bad).status_code == 422