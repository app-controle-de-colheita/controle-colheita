from typing import Annotated

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from auth import usuario_atual
from config import CORS_ORIGINS
from db import Base, engine
from models import Usuario
from routers import auth as auth_router
from schemas import UsuarioOut

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Morango Colheita API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router.router)


@app.get("/")
def raiz():
    return {"app": "morango-colheita", "status": "ok"}


@app.get("/me", response_model=UsuarioOut)
def me(usuario: Annotated[Usuario, Depends(usuario_atual)]):
    return usuario
