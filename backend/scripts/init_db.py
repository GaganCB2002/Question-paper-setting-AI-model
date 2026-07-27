"""
Initialize database and seed test data.
Usage: python -m scripts.init_db
"""

import asyncio
import os
import sys


async def main():
    sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(__file__))))
    from app.database import init_db as db_init
    await db_init()


if __name__ == "__main__":
    asyncio.run(main())
