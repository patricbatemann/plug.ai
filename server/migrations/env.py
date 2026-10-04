from logging.config import fileConfig

from alembic import context
from sqlalchemy import create_engine

import app.models  # noqa: F401
from app.core.config import settings
from app.core.database import Base

if context.config.config_file_name is not None:
    fileConfig(context.config.config_file_name)

# Tests pass their own URL through the Alembic config.
url = context.config.get_main_option("sqlalchemy.url") or settings.database_url

with create_engine(url).connect() as connection:
    context.configure(connection=connection, target_metadata=Base.metadata)
    with context.begin_transaction():
        context.run_migrations()
