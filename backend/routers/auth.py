from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select
from sqlalchemy.orm import Session

from auth import criar_access_token, hash_senha, verificar_senha
from db import get_db
from models import Usuario
from schemas import Token, UsuarioCriar, UsuarioOut

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/registrar", response_model=UsuarioOut, status_code=status.HTTP_201_CREATED)
def registrar(dados: UsuarioCriar, db: Annotated[Session, Depends(get_db)]):
    existente = db.scalar(select(Usuario).where(Usuario.email == dados.email))
    if existente:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email já cadastrado")

    usuario = Usuario(
        email=dados.email,
        nome=dados.nome,
        senha_hash=hash_senha(dados.senha),
    )
    db.add(usuario)
    db.commit()
    db.refresh(usuario)
    return usuario


@router.post("/login", response_model=Token)
def login(
    form: Annotated[OAuth2PasswordRequestForm, Depends()],
    db: Annotated[Session, Depends(get_db)],
):
    usuario = db.scalar(select(Usuario).where(Usuario.email == form.username))
    if not usuario or not verificar_senha(form.password, usuario.senha_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email ou senha inválidos",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return Token(access_token=criar_access_token(usuario.id))
