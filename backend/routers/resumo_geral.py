from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from auth import usuario_atual
from db import get_db
from models import Colheita, Lavoura, Usuario

router = APIRouter(prefix="/resumo-geral", tags=["resumo"])


class ResumoPorLavoura(BaseModel):
    id: int
    nome: str
    tipo: str
    ano_safra: int
    ativa: bool
    total_colheitas: int
    total_caixas: float
    total_premium: float
    total_doce_kg: float
    receita_bruta: float
    custo_embalagem_total: float
    receita_liquida: float


class ResumoGeral(BaseModel):
    total_lavouras: int
    lavouras_ativas: int
    total_colheitas: int
    total_caixas: float
    total_premium: float
    total_doce_kg: float
    receita_bruta: float
    custo_embalagem_total: float
    receita_liquida: float
    por_lavoura: list[ResumoPorLavoura]


@router.get("", response_model=ResumoGeral)
def resumo_geral(
    db: Annotated[Session, Depends(get_db)],
    usuario: Annotated[Usuario, Depends(usuario_atual)],
):
    lavouras = db.scalars(
        select(Lavoura).where(Lavoura.usuario_id == usuario.id)
    ).all()

    por_lavoura: list[ResumoPorLavoura] = []
    total_caixas = total_premium = total_doce = 0.0
    rec_bruta = custo_total = 0.0
    total_colheitas = 0

    for lav in lavouras:
        colheitas = db.scalars(
            select(Colheita).where(Colheita.lavoura_id == lav.id)
        ).all()

        cx = sum(c.qtd_caixas for c in colheitas)
        pr = sum(c.qtd_premium for c in colheitas)
        dc = sum(c.doce_kg for c in colheitas)
        bruta = sum(
            c.qtd_caixas * c.preco_caixa
            + c.qtd_premium * c.preco_premium
            + c.doce_kg * c.preco_doce_kg
            for c in colheitas
        )
        emb = sum(
            c.qtd_caixas * c.custo_embalagem_caixa
            + c.qtd_premium * c.custo_embalagem_premium
            for c in colheitas
        )

        por_lavoura.append(ResumoPorLavoura(
            id=lav.id, nome=lav.nome, tipo=lav.tipo,
            ano_safra=lav.ano_safra, ativa=lav.ativa,
            total_colheitas=len(colheitas),
            total_caixas=cx, total_premium=pr, total_doce_kg=dc,
            receita_bruta=round(bruta, 2),
            custo_embalagem_total=round(emb, 2),
            receita_liquida=round(bruta - emb, 2),
        ))

        total_caixas += cx
        total_premium += pr
        total_doce += dc
        rec_bruta += bruta
        custo_total += emb
        total_colheitas += len(colheitas)

    return ResumoGeral(
        total_lavouras=len(lavouras),
        lavouras_ativas=sum(1 for l in lavouras if l.ativa),
        total_colheitas=total_colheitas,
        total_caixas=total_caixas,
        total_premium=total_premium,
        total_doce_kg=total_doce,
        receita_bruta=round(rec_bruta, 2),
        custo_embalagem_total=round(custo_total, 2),
        receita_liquida=round(rec_bruta - custo_total, 2),
        por_lavoura=por_lavoura,
    )
