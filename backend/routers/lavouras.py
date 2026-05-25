from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from auth import usuario_atual
from db import get_db
from models import Lavoura, Usuario
from schemas import LavouraAtualizar, LavouraCriar, LavouraOut

router = APIRouter(prefix="/lavouras", tags=["lavouras"])


def _buscar_lavoura(lavoura_id: int, db: Session, usuario: Usuario) -> Lavoura:
    lavoura = db.get(Lavoura, lavoura_id)
    if lavoura is None or lavoura.usuario_id != usuario.id:
        raise HTTPException(status_code=404, detail="Lavoura não encontrada")
    return lavoura


@router.post("", response_model=LavouraOut, status_code=status.HTTP_201_CREATED)
def criar(
    dados: LavouraCriar,
    db: Annotated[Session, Depends(get_db)],
    usuario: Annotated[Usuario, Depends(usuario_atual)],
):
    lavoura = Lavoura(usuario_id=usuario.id, **dados.model_dump())
    db.add(lavoura)
    db.commit()
    db.refresh(lavoura)
    return lavoura


@router.get("", response_model=list[LavouraOut])
def listar(
    db: Annotated[Session, Depends(get_db)],
    usuario: Annotated[Usuario, Depends(usuario_atual)],
    ativa: bool | None = None,
    ano_safra: int | None = None,
):
    stmt = select(Lavoura).where(Lavoura.usuario_id == usuario.id).order_by(Lavoura.criada_em.desc())
    if ativa is not None:
        stmt = stmt.where(Lavoura.ativa == ativa)
    if ano_safra is not None:
        stmt = stmt.where(Lavoura.ano_safra == ano_safra)
    return db.scalars(stmt).all()


@router.get("/{lavoura_id}", response_model=LavouraOut)
def obter(
    lavoura_id: int,
    db: Annotated[Session, Depends(get_db)],
    usuario: Annotated[Usuario, Depends(usuario_atual)],
):
    return _buscar_lavoura(lavoura_id, db, usuario)


@router.patch("/{lavoura_id}", response_model=LavouraOut)
def atualizar(
    lavoura_id: int,
    dados: LavouraAtualizar,
    db: Annotated[Session, Depends(get_db)],
    usuario: Annotated[Usuario, Depends(usuario_atual)],
):
    lavoura = _buscar_lavoura(lavoura_id, db, usuario)
    for campo, valor in dados.model_dump(exclude_unset=True).items():
        setattr(lavoura, campo, valor)
    db.commit()
    db.refresh(lavoura)
    return lavoura


@router.delete("/{lavoura_id}", status_code=status.HTTP_204_NO_CONTENT)
def remover(
    lavoura_id: int,
    db: Annotated[Session, Depends(get_db)],
    usuario: Annotated[Usuario, Depends(usuario_atual)],
):
    lavoura = _buscar_lavoura(lavoura_id, db, usuario)
    db.delete(lavoura)
    db.commit()
