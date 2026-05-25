from datetime import date, datetime
from pydantic import BaseModel, ConfigDict, EmailStr, Field


# ---------- Usuario ----------

class UsuarioCriar(BaseModel):
    email: EmailStr
    nome: str = Field(min_length=2, max_length=120)
    senha: str = Field(min_length=6, max_length=128)


class UsuarioLogin(BaseModel):
    email: EmailStr
    senha: str


class UsuarioOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    email: EmailStr
    nome: str
    criado_em: datetime


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


# ---------- Lavoura ----------

class LavouraBase(BaseModel):
    nome: str = Field(min_length=1, max_length=120)
    tipo: str = Field(min_length=1, max_length=40)
    ano_safra: int = Field(ge=2000, le=2100)
    data_inicio: date | None = None
    data_fim: date | None = None
    observacao: str | None = Field(default=None, max_length=500)


class LavouraCriar(LavouraBase):
    pass


class LavouraAtualizar(BaseModel):
    nome: str | None = Field(default=None, min_length=1, max_length=120)
    tipo: str | None = Field(default=None, min_length=1, max_length=40)
    ano_safra: int | None = Field(default=None, ge=2000, le=2100)
    data_inicio: date | None = None
    data_fim: date | None = None
    ativa: bool | None = None
    observacao: str | None = Field(default=None, max_length=500)


class LavouraOut(LavouraBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    ativa: bool
    criada_em: datetime


# ---------- Colheita ----------

class ColheitaBase(BaseModel):
    data: date
    qtd_caixas: float = Field(default=0, ge=0)
    preco_caixa: float = Field(default=0, ge=0)
    qtd_premium: float = Field(default=0, ge=0)
    preco_premium: float = Field(default=0, ge=0)
    doce_kg: float = Field(default=0, ge=0)
    preco_doce_kg: float = Field(default=0, ge=0)
    custo_embalagem_caixa: float = Field(default=0, ge=0)
    custo_embalagem_premium: float = Field(default=0, ge=0)
    observacao: str | None = Field(default=None, max_length=500)


class ColheitaCriar(ColheitaBase):
    pass


class ColheitaAtualizar(BaseModel):
    qtd_caixas: float | None = Field(default=None, ge=0)
    preco_caixa: float | None = Field(default=None, ge=0)
    qtd_premium: float | None = Field(default=None, ge=0)
    preco_premium: float | None = Field(default=None, ge=0)
    doce_kg: float | None = Field(default=None, ge=0)
    preco_doce_kg: float | None = Field(default=None, ge=0)
    custo_embalagem_caixa: float | None = Field(default=None, ge=0)
    custo_embalagem_premium: float | None = Field(default=None, ge=0)
    observacao: str | None = Field(default=None, max_length=500)


class ColheitaOut(ColheitaBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    lavoura_id: int
    criada_em: datetime
