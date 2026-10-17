# Manga Rigger
Upload a cut-out character, mark the eyes and mouth, and animate blinking, breathing and audio-synced mouth movement.

## Run
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r backend/requirements-dev.txt
cd backend
python -m uvicorn app.main:app --reload

Open http://127.0.0.1:8000
