import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{BASE_DIR}/colheita.db")

SECRET_KEY = os.getenv("SECRET_KEY", "troque-isto-em-producao-use-openssl-rand-hex-32")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7

CORS_ORIGINS = os.getenv(
    "CORS_ORIGINS",
    ",".join([
        "http://localhost:5500",
        "http://127.0.0.1:5500",
        "http://localhost:8000",
        "http://10.0.1.14:8000",
        "https://app-controle-de-colheita.github.io",
        "https://renanc534-beep.github.io",
        "https://raspberrypi.taileb9ced.ts.net",
        "https://raspberrypi.taileb9ced.ts.net:8443",
    ]),
).split(",")
