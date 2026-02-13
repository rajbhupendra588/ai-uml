"""
Add razorpay_customer_id column to users table.
"""
import asyncio
import sqlite3
import os

async def migrate():
    """Add razorpay_customer_id column to users table."""
    db_path = os.path.join(os.path.dirname(__file__), "architectai.db")
    print(f"Migrating database: {db_path}")
    
    if not os.path.exists(db_path):
        print(f"❌ Database not found at {db_path}")
        return
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Check if column already exists
        cursor.execute("PRAGMA table_info(users)")
        columns = [col[1] for col in cursor.fetchall()]
        
        print(f"Current columns: {', '.join(columns)}")
        
        if "razorpay_customer_id" in columns:
            print("✅ Column razorpay_customer_id already exists")
            return
        
        # Add the column
        print("Adding razorpay_customer_id column...")
        cursor.execute("""
            ALTER TABLE users 
            ADD COLUMN razorpay_customer_id VARCHAR(100) NULL
        """)
        conn.commit()
        print("✅ Successfully added razorpay_customer_id column")
        
        # Verify
        cursor.execute("PRAGMA table_info(users)")
        columns = [col[1] for col in cursor.fetchall()]
        if "razorpay_customer_id" in columns:
            print("✅ Verified: Column added successfully")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        conn.rollback()
        raise
    finally:
        conn.close()

if __name__ == "__main__":
    asyncio.run(migrate())
