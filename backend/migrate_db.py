"""
Database migration helper script.
Adds new columns to existing tables without losing data.
Run with: python migrate_db.py
"""
import asyncio
import sqlite3
from pathlib import Path

# Database file path
DB_PATH = Path(__file__).parent / "architectai.db"


def migrate():
    """Add new columns if they don't exist."""
    if not DB_PATH.exists():
        print(f"Database not found at {DB_PATH}. Run the app first to create it.")
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Check existing columns in users table
    cursor.execute("PRAGMA table_info(users)")
    columns = {row[1] for row in cursor.fetchall()}
    print(f"Existing columns in users table: {columns}")

    # Add tokens_used_this_month if not exists
    if "tokens_used_this_month" not in columns:
        print("Adding tokens_used_this_month column...")
        cursor.execute(
            "ALTER TABLE users ADD COLUMN tokens_used_this_month INTEGER DEFAULT 0"
        )
        print("✓ Added tokens_used_this_month")
    else:
        print("✓ tokens_used_this_month already exists")

    # Add tokens_used_total if not exists
    if "tokens_used_total" not in columns:
        print("Adding tokens_used_total column...")
        cursor.execute(
            "ALTER TABLE users ADD COLUMN tokens_used_total INTEGER DEFAULT 0"
        )
        print("✓ Added tokens_used_total")
    else:
        print("✓ tokens_used_total already exists")

    conn.commit()
    conn.close()
    print("\nMigration complete!")


if __name__ == "__main__":
    migrate()
