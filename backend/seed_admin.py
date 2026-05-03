"""Run once to create the super admin account: python seed_admin.py"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext
from datetime import datetime
import os
from dotenv import load_dotenv

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

ADMIN_EMAIL = "admin@interviewiq.com"
ADMIN_PASSWORD = "admin@123"


async def seed():
    client = AsyncIOMotorClient(MONGO_URI)
    db = client["interviewiq"]
    admins = db["admins"]

    existing = await admins.find_one({"email": ADMIN_EMAIL})
    if existing:
        print(f"Admin already exists: {ADMIN_EMAIL}")
        client.close()
        return

    await admins.insert_one({
        "email": ADMIN_EMAIL,
        "password_hash": pwd_context.hash(ADMIN_PASSWORD),
        "name": "Super Admin",
        "created_at": datetime.utcnow(),
    })
    print(f"Admin created successfully!")
    print(f"  Email:    {ADMIN_EMAIL}")
    print(f"  Password: {ADMIN_PASSWORD}")
    client.close()


if __name__ == "__main__":
    asyncio.run(seed())
