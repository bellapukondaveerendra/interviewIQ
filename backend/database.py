import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
DB_NAME = "interviewiq"

client: AsyncIOMotorClient = None


async def connect_db():
    global client
    client = AsyncIOMotorClient(MONGO_URI)


async def close_db():
    global client
    if client:
        client.close()


def get_db():
    return client[DB_NAME]


def get_collection(name: str):
    return client[DB_NAME][name]
