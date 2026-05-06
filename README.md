# InterviewIQ — AI Recruitment Management System

## Prerequisites

- Python 3.10+
- Node.js 18+
- MongoDB (running locally on port 27017)
- Anthropic API key
- AWS account with Polly access

---

## 1. Backend Setup

```bash
cd backend

# Create and activate virtual environment
python -m venv venv
source venv/bin/activate        # macOS/Linux
# venv\Scripts\activate         # Windows

# Install dependencies
pip install -r requirements.txt

# Configure environment variables
cp .env.example .env
# Keep the env file in the backend root folder

# Edit .env and fill in your actual keys:
#   ANTHROPIC_API_KEY=sk-ant-...
#   AWS_ACCESS_KEY_ID=...
#   AWS_SECRET_ACCESS_KEY=...
#   AWS_REGION=us-east-1

# Seed the admin account (run once)
python seed_admin.py

# Start the API server
uvicorn main:app --reload --port 8000
```

Backend runs at: http://localhost:8000  
API docs at: http://localhost:8000/docs

---

## 2. Frontend Setup

```bash
cd frontend

npm install
npm start
```

Frontend runs at: http://localhost:3000

---

## 3. Default Admin Credentials

```
Email:    admin@interviewiq.com
Password: admin@123
```

---

## 4. User Flow

### Admin Flow
1. Log in at http://localhost:3000/login with admin credentials
2. Click **New Campaign** to create an interview campaign
3. Fill in job title, job description, stages (1–3), and candidate emails
4. View candidates per campaign from the dashboard
5. Click **Review** on any candidate with `pending_approval` status
6. See full transcript, scores per question, and AI feedback
7. **Approve** (moves to next stage or marks Hired) or **Reject**

### Candidate Flow
1. Register at http://localhost:3000/signup (complete onboarding form)
2. Admin must add your email to a campaign
3. Log in and see your invitations on the dashboard
4. Click **Start Interview** for the current stage
5. Answer AI-generated questions (text or voice via mic button)
6. Timer counts down from 15 minutes (auto-submits on expiry)
7. After submission, wait for admin review
8. Dashboard shows current status and AI feedback (no scores shown)

---

## 5. Project Structure

```
InterviewIQ/
├── backend/
│   ├── main.py                  # FastAPI app entry point
│   ├── database.py              # MongoDB connection
│   ├── seed_admin.py            # One-time admin seed script
│   ├── requirements.txt
│   ├── .env                     # Your environment variables
│   ├── auth/                    # Signup, login, JWT middleware
│   ├── campaigns/               # Campaign CRUD
│   ├── interviews/              # Session management, LLM, Polly
│   ├── admin/                   # Admin review APIs
│   └── candidate/               # Candidate dashboard APIs
└── frontend/
    ├── src/
    │   ├── App.js               # Routing
    │   ├── api.js               # API client
    │   ├── pages/               # Login, Signup, Dashboard, Interview, Admin, Review
    │   └── components/          # Timer, VoiceInput
    └── package.json
```

---

## 6. MongoDB Collections

| Collection | Purpose |
|---|---|
| admins | Admin accounts |
| candidates | Registered candidates with onboarding data |
| interview_campaigns | Campaigns with stages config |
| interview_invitations | Per-candidate campaign tracking + status |
| interview_sessions | Interview Q&A, scores, transcripts |

---

## 7. Interview Status States

| Status | Meaning |
|---|---|
| pending_stage_1 | Ready to take Stage 1 interview |
| pending_stage_2 | Ready to take Stage 2 interview |
| pending_stage_3 | Ready to take Stage 3 interview |
| pending_approval | Interview done, waiting for admin |
| rejected | Admin rejected (candidate sees no reason) |
| hired | Final stage approved |

---

## 8. Environment Variables Reference

| Variable | Description |
|---|---|
| MONGO_URI | MongoDB connection string (default: mongodb://localhost:27017) |
| JWT_SECRET | Secret key for JWT signing |
| JWT_EXPIRE_HOURS | Token expiry in hours (default: 24) |
| ANTHROPIC_API_KEY | Claude API key |
| AWS_ACCESS_KEY_ID | AWS credentials for Polly |
| AWS_SECRET_ACCESS_KEY | AWS credentials for Polly |
| AWS_REGION | AWS region (default: us-east-1) |
