"""Tabelas iniciais: veículos, eventos, clientes, comodatos e modelos Word.

Igual ao que o `create_all` criava antes do Alembic; bancos antigos recebem só o carimbo.

Revision ID: 0001
Revises: 
"""

from alembic import op
import sqlalchemy as sa


revision = '0001'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table('clientes',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('nome', sa.String(length=160), nullable=False),
    sa.Column('documento', sa.String(length=20), nullable=True),
    sa.Column('email', sa.String(length=160), nullable=True),
    sa.Column('telefone', sa.String(length=30), nullable=True),
    sa.Column('endereco', sa.Text(), nullable=True),
    sa.Column('dados', sa.JSON(), nullable=False),
    sa.Column('criado_em', sa.DateTime(timezone=True), nullable=False),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('documento')
    )
    with op.batch_alter_table('clientes', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_clientes_nome'), ['nome'], unique=False)

    op.create_table('modelos_documento',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('nome', sa.String(length=120), nullable=False),
    sa.Column('arquivo', sa.String(length=255), nullable=False),
    sa.Column('campos', sa.JSON(), nullable=False),
    sa.Column('criado_em', sa.DateTime(timezone=True), nullable=False),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('nome')
    )
    op.create_table('veiculos',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('placa', sa.String(length=10), nullable=False),
    sa.Column('chassi', sa.String(length=30), nullable=True),
    sa.Column('renavam', sa.String(length=20), nullable=True),
    sa.Column('marca', sa.String(length=60), nullable=True),
    sa.Column('modelo', sa.String(length=80), nullable=True),
    sa.Column('ano_fabricacao', sa.Integer(), nullable=True),
    sa.Column('ano_modelo', sa.Integer(), nullable=True),
    sa.Column('cor', sa.String(length=30), nullable=True),
    sa.Column('status', sa.String(length=20), nullable=False),
    sa.Column('dados', sa.JSON(), nullable=False),
    sa.Column('criado_em', sa.DateTime(timezone=True), nullable=False),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('chassi')
    )
    with op.batch_alter_table('veiculos', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_veiculos_placa'), ['placa'], unique=True)
        batch_op.create_index(batch_op.f('ix_veiculos_status'), ['status'], unique=False)

    op.create_table('comodatos',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('numero', sa.Integer(), nullable=False),
    sa.Column('cliente_id', sa.String(length=36), nullable=False),
    sa.Column('veiculo_id', sa.String(length=36), nullable=False),
    sa.Column('data_saida', sa.Date(), nullable=False),
    sa.Column('data_prevista_devolucao', sa.Date(), nullable=True),
    sa.Column('data_devolucao', sa.Date(), nullable=True),
    sa.Column('status', sa.String(length=20), nullable=False),
    sa.Column('responsavel_nome', sa.String(length=160), nullable=True),
    sa.Column('responsavel_contato', sa.String(length=160), nullable=True),
    sa.Column('condutor_nome', sa.String(length=160), nullable=True),
    sa.Column('condutor_documento', sa.String(length=20), nullable=True),
    sa.Column('condutor_cnh', sa.String(length=20), nullable=True),
    sa.Column('finalidade', sa.Text(), nullable=True),
    sa.Column('dados', sa.JSON(), nullable=False),
    sa.Column('assinatura', sa.JSON(), nullable=False),
    sa.Column('criado_em', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['cliente_id'], ['clientes.id'], ),
    sa.ForeignKeyConstraint(['veiculo_id'], ['veiculos.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('comodatos', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_comodatos_cliente_id'), ['cliente_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_comodatos_numero'), ['numero'], unique=True)
        batch_op.create_index(batch_op.f('ix_comodatos_status'), ['status'], unique=False)
        batch_op.create_index(batch_op.f('ix_comodatos_veiculo_id'), ['veiculo_id'], unique=False)

    op.create_table('eventos_veiculo',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('veiculo_id', sa.String(length=36), nullable=False),
    sa.Column('tipo', sa.String(length=30), nullable=False),
    sa.Column('de_status', sa.String(length=20), nullable=True),
    sa.Column('para_status', sa.String(length=20), nullable=True),
    sa.Column('comodato_id', sa.String(length=36), nullable=True),
    sa.Column('observacao', sa.Text(), nullable=True),
    sa.Column('em', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['comodato_id'], ['comodatos.id'], ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['veiculo_id'], ['veiculos.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('eventos_veiculo', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_eventos_veiculo_em'), ['em'], unique=False)
        batch_op.create_index(batch_op.f('ix_eventos_veiculo_veiculo_id'), ['veiculo_id'], unique=False)



def downgrade() -> None:
    with op.batch_alter_table('eventos_veiculo', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_eventos_veiculo_veiculo_id'))
        batch_op.drop_index(batch_op.f('ix_eventos_veiculo_em'))

    op.drop_table('eventos_veiculo')
    with op.batch_alter_table('comodatos', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_comodatos_veiculo_id'))
        batch_op.drop_index(batch_op.f('ix_comodatos_status'))
        batch_op.drop_index(batch_op.f('ix_comodatos_numero'))
        batch_op.drop_index(batch_op.f('ix_comodatos_cliente_id'))

    op.drop_table('comodatos')
    with op.batch_alter_table('veiculos', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_veiculos_status'))
        batch_op.drop_index(batch_op.f('ix_veiculos_placa'))

    op.drop_table('veiculos')
    op.drop_table('modelos_documento')
    with op.batch_alter_table('clientes', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_clientes_nome'))

    op.drop_table('clientes')
