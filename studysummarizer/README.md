# StudySummarizer

AI-powered PDF study tool. Upload academic documents and get instant summaries, flashcards, study notes, exam prep, and chat.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14, TypeScript, Tailwind CSS |
| Backend | Node.js, Express, TypeScript |
| AI | Anthropic Claude API (claude-sonnet-4-6) |
| PDF Processing | pdf-parse, Tesseract.js (OCR) |
| RAG Pipeline | LangChain, Pinecone (vector search) |
| Database | PostgreSQL + Prisma ORM |
| Storage | AWS S3 (or Cloudinary) |
| Auth | Clerk |
| Export | pdfmake, docx, marked |

---

## Prerequisites

- Node.js 18+
- PostgreSQL 14+
- An [Anthropic API key](https://console.anthropic.com)
- A [Pinecone account](https://pinecone.io) (free tier works)
- A [Clerk account](https://clerk.dev) (free tier works)
- AWS S3 bucket (or Cloudinary account)

---

## Quick Start

### 1. Clone & install

```bash
git clone https://github.com/yourname/studysummarizer
cd studysummarizer

# Install frontend deps
cd frontend && npm install

# Install backend deps
cd ../backend && npm install
```

### 2. Environment variables

**Frontend** — create `frontend/.env.local`:

```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_API_URL=http://localhost:4000
```

**Backend** — create `backend/.env`:

```env
# Server
PORT=4000
NODE_ENV=development

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/studysummarizer

# Anthropic
ANTHROPIC_API_KEY=sk-ant-...

# Pinecone (RAG)
PINECONE_API_KEY=...
PINECONE_ENVIRONMENT=us-east-1
PINECONE_INDEX=studysummarizer

# AWS S3
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1
AWS_S3_BUCKET=studysummarizer-uploads

# Clerk (backend verification)
CLERK_SECRET_KEY=sk_test_...

# Security
JWT_SECRET=your-secret-here
```

### 3. Database setup

```bash
cd backend
npx prisma migrate dev --name init
npx prisma generate
```

### 4. Pinecone index setup

Create an index named `studysummarizer` with **1536 dimensions** (for text-embedding-3-small) and cosine metric.

### 5. Run in development

```bash
# Terminal 1 — backend
cd backend && npm run dev

# Terminal 2 — frontend
cd frontend && npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Project Structure

```
studysummarizer/
├── frontend/                  # Next.js 14 app
│   ├── app/
│   │   ├── page.tsx           # Landing page
│   │   ├── upload/page.tsx    # PDF upload
│   │   ├── summarize/page.tsx # Summary dashboard
│   │   ├── flashcards/page.tsx
│   │   ├── chat/page.tsx      # PDF chat
│   │   └── settings/page.tsx
│   ├── components/
│   │   ├── ui/                # Reusable UI primitives
│   │   ├── layout/            # Navbar, Sidebar, Footer
│   │   └── features/          # Feature-specific components
│   ├── lib/
│   │   ├── api.ts             # API client
│   │   └── utils.ts
│   └── hooks/                 # Custom React hooks
│
├── backend/                   # Express API
│   └── src/
│       ├── routes/            # API route handlers
│       ├── services/          # Business logic
│       │   ├── pdf.service.ts       # PDF extraction
│       │   ├── ai.service.ts        # Claude integration
│       │   ├── rag.service.ts       # RAG pipeline
│       │   ├── export.service.ts    # PDF/DOCX export
│       │   └── storage.service.ts   # S3 uploads
│       ├── middleware/        # Auth, rate limiting, error handling
│       ├── utils/             # Chunking, text processing
│       └── db/                # Prisma client + schema
│
└── docs/                      # Architecture docs
```

---

## API Reference

### Documents

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/documents/upload` | Upload PDF |
| GET | `/api/documents` | List user's documents |
| GET | `/api/documents/:id` | Get document details |
| DELETE | `/api/documents/:id` | Delete document |

### Summaries

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/summaries/generate` | Generate summary |
| GET | `/api/summaries/:documentId` | Get summaries for doc |
| GET | `/api/summaries/history` | All user summaries |

### Chat

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/chat/message` | Send chat message (RAG) |
| GET | `/api/chat/:documentId/history` | Get chat history |

### Export

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/export` | Export summary (pdf/docx/md/txt) |

### Flashcards

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/flashcards/generate` | Generate flashcards |
| GET | `/api/flashcards/:documentId` | Get flashcards |

---

## Deployment

### Frontend — Vercel

```bash
cd frontend
vercel --prod
```

Set all env vars in Vercel dashboard under Project → Settings → Environment Variables.

### Backend — Railway / Render

```bash
# railway.json already configured
railway up
```

Or deploy to Render using `backend/render.yaml`.

### Database — Supabase (free PostgreSQL)

1. Create project at supabase.com
2. Copy connection string to `DATABASE_URL`
3. Run `npx prisma migrate deploy`

---

## Architecture

```
User → Next.js Frontend
         ↓
      Clerk Auth
         ↓
   Express Backend
    ↙         ↘
S3 Storage   Claude API
    ↓              ↓
PDF Text    Chunk + Embed
    ↓              ↓
Pinecone ←── Vector Store
    ↓
RAG Retrieval → Claude → Response
```

The RAG pipeline:
1. PDF is extracted to text on upload
2. Text is split into overlapping 1000-token chunks
3. Each chunk is embedded with `text-embedding-3-small`
4. Embeddings stored in Pinecone with document metadata
5. On chat query, top-k relevant chunks retrieved
6. Chunks + query sent to Claude as context
7. Claude generates grounded, accurate response

---

## License

MIT
