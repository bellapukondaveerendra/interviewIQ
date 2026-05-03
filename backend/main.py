from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from database import connect_db, close_db
from auth.router import router as auth_router
from campaigns.router import router as campaigns_router
from interviews.router import router as interviews_router
from admin.router import router as admin_router
from candidate.router import router as candidate_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_db()
    yield
    await close_db()


app = FastAPI(title="InterviewIQ API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(campaigns_router)
app.include_router(interviews_router)
app.include_router(admin_router)
app.include_router(candidate_router)


@app.get("/health")
async def health():
    return {"status": "ok"}
