# Supabase Connection Instructions

## The Issue
All tested connection configurations are failing. We need the EXACT connection string from your Supabase dashboard.

## How to Get the Correct Connection String

### Step 1: Go to Supabase Dashboard
1. Open [https](https://supabase.com/dashboard)
2. Select your project: `nkcjuwoltqcvaiutpdkj`

### Step 2: Get Connection String
1. Click **Project Settings** (gear icon in sidebar)
2. Click **Database** tab
3. Scroll to **"Connection string"** section
4. Select the **"URI"** tab (not "Transaction" or "Session")
5. You should see something like:
   ```
   postgresql://postgres.[PROJECT-REF]:[YOUR-PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres
   ```

### Step 3: What to Share
Copy the COMPLETE connection string that looks like ONE of these formats:

**Format 1 (Pooler - Recommended):**
```
postgresql://postgres.nkcjuwoltqcvaiutpdkj:MySecurePassword123!@aws-0-ap-south-1.pooler.supabase.com:5432/postgres
```

**Format 2 (Direct):**
```
postgresql://postgres:MySecurePassword123!@db.nkcjuwoltqcvaiutpdkj.supabase.co:5432/postgres
```

##Important Notes
- The connection string might use `aws-0-[region]` not just `db.`
- There might be a different port (6543 for transaction mode, 5432 for session mode)
- The username might be `postgres.nkcjuwoltqcvaiutpdkj` not just `postgres`

## Screenshot Locations in Supabase
If you're having trouble finding it, here are the exact menu clicks:
1. **Dashboard** → **Your Project**
2. **⚙️ Settings** (bottom left)
3. **Database** (in settings menu)
4. Scroll down to **Connection string**
5. Click **URI** tab (this is important!)
6. Copy the complete string shown there

## Alternative: Session Mode
If the above doesn't work, try:
1. In the same location, click **"Session"** tab instead of "URI"
2. Copy that connection string
3. Share it with me
