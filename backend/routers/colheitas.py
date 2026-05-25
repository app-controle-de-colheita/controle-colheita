from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from auth import usuario_atual
from db import get_db
from models import Colheita, Lavoura, Usuario
from routers.lavouras import _buscar_lavoura
from schemas import ColheitaAtualizar, ColheitaCriar, ColheitaOut

router = APIRouter(tags=["colheitas"])


def _buscar_colheita(colheita_id: int, db: Session, usuario: Usuario) -> Colheita:
    colheita = db.get(Colheita, colheita_id)
    if colheita is None:
        raise HTTPException(status_code=404, detail="Colheita não encontrada")
    # garante que a colheita pertence a uma lavoura do usuário
    lavoura = db.get(Lavoura, colheita.lavoura_id)
    if lavoura is None or lavoura.usuario_id != usuario.id:
        raise HTTPException(status_code=404, detail="Colheita não encontrada")
    return colheita


@router.post(
    "/lavouras/{lavoura_id}/colheitas",
    response_model=ColheitaOut,
    status_code=status.HTTP_201_CREATED,
)
def criar(
    lavoura_id: int,
    dados: ColheitaCriar,
    db: Annotated[Session, Depends(get_db)],
    usuario: Annotated[Usuario, Depends(usuario_atual)],
):
    _buscar_lavoura(lavoura_id, db, usuario)
    colheita = Colheita(lavoura_id=lavoura_id, **dados.model_dump())
    db.add(colheita)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Já existe uma colheita nessa data para esta lavoura",
        )
    db.refresh(colheita)
    return colheita


@router.get("/lavouras/{lavoura_id}/colheitas", response_model=list[ColheitaOut])
def listar(
    lavoura_id: int,
    db: Annotated[Session, Depends(get_db)],
    usuario: Annotated[Usuario, Depends(usuario_atual)],
):
    _buscar_lavoura(lavoura_id, db, usuario)
    stmt = select(Colheita).where(Colheita.lavoura_id == lavoura_id).order_by(Colheita.data)
    return db.scalars(stmt).all()


@router.get("/colheitas/{colheita_id}", response_model=ColheitaOut)
def obter(
    colheita_id: int,
    db: Annotated[Session, Depends(get_db)],
    usuario: Annotated[Usuario, Depends(usuario_atual)],
):
    return _buscar_colheita(colheita_id, db, usuario)


@router.patch("/colheitas/{colheita_id}", response_model=ColheitaOut)
def atualizar(
    colheita_id: int,
    dados: ColheitaAtualizar,
    db: Annotated[Session, Depends(get_db)],
    usuario: Annotated[Usuario, Depends(usuario_atual)],
):
    colheita = _buscar_colheita(colheita_id, db, usuario)
    for campo, valor in dados.model_dump(exclude_unset=True).items():
        setattr(colheita, campo, valor)
    db.commit()
    db.refresh(colheita)
    return colheita


@router.delete("/colheitas/{colheita_id}", status_code=status.HTTP_204_NO_CONTENT)
def remover(
    colheita_id: int,
    db: Annotated[Session, Depends(get_db)],
    usuario: Annotated[Usuario, Depends(usuario_atual)],
):
    colheita = _buscar_colheita(colheita_id, db, usuario)
    db.delete(colheita)
    db.commit()
