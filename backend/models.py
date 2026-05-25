from datetime import date, datetime
from sqlalchemy import Date, DateTime, Float, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db import Base


class Usuario(Base):
    __tablename__ = "usuario"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    senha_hash: Mapped[str] = mapped_column(String(255))
    nome: Mapped[str] = mapped_column(String(120))
    criado_em: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    lavouras: Mapped[list["Lavoura"]] = relationship(back_populates="usuario", cascade="all, delete-orphan")


class Lavoura(Base):
    __tablename__ = "lavoura"

    id: Mapped[int] = mapped_column(primary_key=True)
    usuario_id: Mapped[int] = mapped_column(ForeignKey("usuario.id", ondelete="CASCADE"), index=True)
    nome: Mapped[str] = mapped_column(String(120))
    tipo: Mapped[str] = mapped_column(String(40))
    ano_safra: Mapped[int] = mapped_column(Integer, index=True)
    data_inicio: Mapped[date | None] = mapped_column(Date, nullable=True)
    data_fim: Mapped[date | None] = mapped_column(Date, nullable=True)
    ativa: Mapped[bool] = mapped_column(default=True)
    observacao: Mapped[str | None] = mapped_column(String(500), nullable=True)
    criada_em: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    usuario: Mapped["Usuario"] = relationship(back_populates="lavouras")
    colheitas: Mapped[list["Colheita"]] = relationship(back_populates="lavoura", cascade="all, delete-orphan")


class Colheita(Base):
    __tablename__ = "colheita"
    __table_args__ = (UniqueConstraint("lavoura_id", "data", name="uq_colheita_lavoura_data"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    lavoura_id: Mapped[int] = mapped_column(ForeignKey("lavoura.id", ondelete="CASCADE"), index=True)
    data: Mapped[date] = mapped_column(Date, index=True)

    qtd_caixas: Mapped[float] = mapped_column(Float, default=0)
    preco_caixa: Mapped[float] = mapped_column(Float, default=0)

    qtd_premium: Mapped[float] = mapped_column(Float, default=0)
    preco_premium: Mapped[float] = mapped_column(Float, default=0)

    doce_kg: Mapped[float] = mapped_column(Float, default=0)
    preco_doce_kg: Mapped[float] = mapped_column(Float, default=0)

    custo_embalagem_caixa: Mapped[float] = mapped_column(Float, default=0)
    custo_embalagem_premium: Mapped[float] = mapped_column(Float, default=0)

    observacao: Mapped[str | None] = mapped_column(String(500), nullable=True)
    criada_em: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    lavoura: Mapped["Lavoura"] = relationship(back_populates="colheitas")
