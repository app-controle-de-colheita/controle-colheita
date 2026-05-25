from statistics import mean, median
from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from auth import usuario_atual
from db import get_db
from models import Colheita, Usuario
from routers.lavouras import _buscar_lavoura

router = APIRouter(prefix="/lavouras/{lavoura_id}/resumo", tags=["resumo"])


class ResumoLavoura(BaseModel):
    lavoura_id: int
    total_colheitas: int

    total_caixas: float
    total_premium: float
    total_doce_kg: float

    receita_caixas: float
    receita_premium: float
    receita_doce: float
    receita_bruta: float

    custo_embalagem_caixa_total: float
    custo_embalagem_premium_total: float
    custo_embalagem_total: float

    receita_liquida: float

    media_preco_caixa: float | None
    mediana_preco_caixa: float | None
    media_preco_premium: float | None
    mediana_preco_premium: float | None
    media_preco_doce_kg: float | None


@router.get("", response_model=ResumoLavoura)
def resumo(
    lavoura_id: int,
    db: Annotated[Session, Depends(get_db)],
    usuario: Annotated[Usuario, Depends(usuario_atual)],
):
    _buscar_lavoura(lavoura_id, db, usuario)
    colheitas = db.scalars(
        select(Colheita).where(Colheita.lavoura_id == lavoura_id)
    ).all()

    total_caixas = sum(c.qtd_caixas for c in colheitas)
    total_premium = sum(c.qtd_premium for c in colheitas)
    total_doce = sum(c.doce_kg for c in colheitas)

    receita_caixas = sum(c.qtd_caixas * c.preco_caixa for c in colheitas)
    receita_premium = sum(c.qtd_premium * c.preco_premium for c in colheitas)
    receita_doce = sum(c.doce_kg * c.preco_doce_kg for c in colheitas)
    receita_bruta = receita_caixas + receita_premium + receita_doce

    custo_emb_caixa = sum(c.qtd_caixas * c.custo_embalagem_caixa for c in colheitas)
    custo_emb_premium = sum(c.qtd_premium * c.custo_embalagem_premium for c in colheitas)
    custo_emb_total = custo_emb_caixa + custo_emb_premium

    # médias só considera dias onde houve venda do tipo (preço > 0)
    precos_caixa = [c.preco_caixa for c in colheitas if c.qtd_caixas > 0 and c.preco_caixa > 0]
    precos_premium = [c.preco_premium for c in colheitas if c.qtd_premium > 0 and c.preco_premium > 0]
    precos_doce = [c.preco_doce_kg for c in colheitas if c.doce_kg > 0 and c.preco_doce_kg > 0]

    return ResumoLavoura(
        lavoura_id=lavoura_id,
        total_colheitas=len(colheitas),
        total_caixas=total_caixas,
        total_premium=total_premium,
        total_doce_kg=total_doce,
        receita_caixas=round(receita_caixas, 2),
        receita_premium=round(receita_premium, 2),
        receita_doce=round(receita_doce, 2),
        receita_bruta=round(receita_bruta, 2),
        custo_embalagem_caixa_total=round(custo_emb_caixa, 2),
        custo_embalagem_premium_total=round(custo_emb_premium, 2),
        custo_embalagem_total=round(custo_emb_total, 2),
        receita_liquida=round(receita_bruta - custo_emb_total, 2),
        media_preco_caixa=round(mean(precos_caixa), 2) if precos_caixa else None,
        mediana_preco_caixa=round(median(precos_caixa), 2) if precos_caixa else None,
        media_preco_premium=round(mean(precos_premium), 2) if precos_premium else None,
        mediana_preco_premium=round(median(precos_premium), 2) if precos_premium else None,
        media_preco_doce_kg=round(mean(precos_doce), 2) if precos_doce else None,
    )
