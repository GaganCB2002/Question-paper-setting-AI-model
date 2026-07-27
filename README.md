# KKE Question Paper Generator

AI-powered exam paper generator for Karnataka Government exams. Built with **FastAPI (Python)** as the primary backend, **React + Vite + TypeScript** as the frontend, and **Express.js (Node.js)** as a secondary/legacy backend.

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Technology Stack](#technology-stack)
- [Project Structure](#project-structure)
- [Feature Flows](#feature-flows)
  - [Authentication Flow](#authentication-flow)
  - [Syllabus Upload & Question Generation Flow](#syllabus-upload--question-generation-flow)
  - [Phased Task Planning & Auto-Resume Flow](#phased-task-planning--auto-resume-flow)
  - [Token Quota Tracking & Notification Flow](#token-quota-tracking--notification-flow)
  - [File Management Flow](#file-management-flow)
  - [Admin Dashboard Flow](#admin-dashboard-flow)
- [Data Model Diagrams](#data-model-diagrams)
- [Setup & Installation](#setup--installation)
- [Running the Project](#running-the-project)
- [API Endpoints](#api-endpoints)
- [Environment Variables](#environment-variables)
- [Contributing](#contributing)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        KKE Question Paper Generator                         │
│                                                                             │
│  ┌──────────────────────────┐           ┌────────────────────────────────┐  │
│  │                          │           │                                │  │
│  │   React SPA (Vite 8)    │◄─────────►│    FastAPI Backend (:8000)     │  │
│  │   localhost:5173         │  REST +   │    /api/v1/* (primary)         │  │
│  │                          │   SSE     │                                │  │
│  │   ┌─────────────────┐    │           │  ┌──────────────────────────┐  │  │
│  │   │ Pages (9)       │    │           │  │ Routers (11 modules)     │  │  │
│  │   │ Components (8)  │    │  JWT      │  │ Services (7 modules)     │  │  │
│  │   │ Stores (3)      │    │  Bearer   │  │ Models (17 SQLAlchemy)   │  │  │
│  │   │ Hooks (3)       │    │  Auth     │  │ Schemas (5 Pydantic)     │  │  │
│  │   │ API Client      │    │           │  │ Core (JWT + RBAC)        │  │  │
│  │   └─────────────────┘    │           │  └──────────────────────────┘  │  │
│  └──────────────────────────┘           │                                │  │
│                                         │  DB: SQLite / Supabase PG      │  │
│      ┌──────────────────────┐          │  AI: Gemini 2.0 Flash          │  │
│      │  Express.js (:3001)  │          │  OCR: Tesseract                │  │
│      │  /api/* (legacy)     │          └────────────────────────────────┘  │
│      │  Routes: exams,      │                                             │
│      │  upload, analyze,    │          ┌────────────────────────────────┐  │
│      │  generate, papers,   │          │  Shared Infrastructure        │  │
│      │  questions           │          │  ─────────────────────        │  │
│      │                      │          │  Gemini AI (both backends)    │  │
│      │  AI: Gemini 2.5 Flash│          │  File System (uploads/)       │  │
│      │  DB: better-sqlite3  │          │  SQLite / Supabase            │  │
│      └──────────────────────┘          └────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Client-Server Interaction Diagram

```mermaid
sequenceDiagram
    participant User as User (Browser)
    participant React as React SPA (Vite)
    participant FastAPI as FastAPI Backend (:8000)
    participant Express as Express.js (:3001)
    participant DB as PostgreSQL / SQLite
    participant AI as Gemini AI
    participant FS as File System

    Note over User,FS: Authentication Flow
    User->>React: Enter credentials
    React->>FastAPI: POST /api/v1/auth/login
    FastAPI->>DB: Verify user + password hash
    DB-->>FastAPI: User found
    FastAPI-->>React: { access_token, refresh_token }
    React->>React: Store tokens in Zustand (localStorage)

    Note over User,FS: Question Generation Flow (Primary)
    User->>React: Upload syllabus text / file
    React->>FastAPI: POST /api/v1/files/upload
    FastAPI->>FS: Store file
    FastAPI-->>React: { file_id }
    React->>FastAPI: POST /api/v1/questions/generate (SSE)
    FastAPI->>FastAPI: Extract text from file
    FastAPI->>AI: Generate MCQs via Gemini
    AI-->>FastAPI: Stream questions
    FastAPI->>DB: Store generated questions + paper
    FastAPI-->>React: SSE events (progress, chunk, complete)
    React->>React: Display questions in real-time

    Note over User,FS: Phased Task Planning Flow
    User->>React: Create task plan
    React->>FastAPI: POST /api/v1/tasks/create-plan
    FastAPI->>AI: Breakdown syllabus into phases
    AI-->>FastAPI: Phase structure
    FastAPI->>DB: Save GenerationTask + TaskPhases
    FastAPI-->>React: { task_id, phases, pending_approval }
    User->>React: Approve phase
    React->>FastAPI: POST /api/v1/tasks/{id}/approve
    FastAPI->>DB: Mark phase approved
    FastAPI-->>React: { status: approved }
    User->>React: Start task
    React->>FastAPI: POST /api/v1/tasks/{id}/start (SSE)
    FastAPI->>AI: Generate batch of questions
    FastAPI->>DB: Track token usage per phase
    FastAPI-->>React: Stream progress

    Note over User,FS: Legacy Flow (Express.js)
    User->>React: Upload documents
    React->>Express: POST /api/upload (Multer)
    Express->>FS: Store files
    Express->>Express: Parse files (PDF/DOCX/Image)
    Express->>AI: Analyze documents (Gemini)
    AI-->>Express: Extract exam structure
    Express->>AI: Generate blueprint
    Express->>AI: Generate paper + answer key
    Express-->>React: SSE streaming (generate)
```

---

## Technology Stack

### Frontend
| Category | Technology |
|----------|-----------|
| Framework | React 19, TypeScript 6 |
| Build | Vite 8 |
| Styling | Tailwind CSS 4, Radix UI primitives, lucide-react icons |
| State | Zustand 5 (authStore, appStore, folderStore) |
| Data Fetching | TanStack Query 5, Fetch API |
| Routing | React Router 7 |
| Forms | react-hook-form + zod 4 |
| Animations | framer-motion |
| Utilities | date-fns, tailwind-merge, clsx, class-variance-authority |
| Toast | Custom shadcn-style reducer pattern |

### Primary Backend (Python FastAPI)
| Category | Technology |
|----------|-----------|
| Framework | FastAPI, Uvicorn |
| ORM | SQLAlchemy 2.0 (async) |
| Migrations | Alembic |
| Validation | Pydantic v2 |
| Auth | JWT (HS256) + bcrypt password hashing |
| RBAC | 3 roles (admin, editor, student), 32 granular permissions |
| AI | google-generativeai (Gemini 2.0 Flash) |
| OCR | Tesseract (pytesseract + pdf2image + OpenCV) |
| Task Queue | Celery + Redis |
| Logging | Loguru |
| Rate Limiting | slowapi |
| File Parsing | PyMuPDF, pdfplumber, python-docx, python-pptx, openpyxl |
| PDF Generation | reportlab, pdfminer.six |

### Secondary Backend (Express.js)
| Category | Technology |
|----------|-----------|
| Runtime | Node.js, TypeScript |
| Framework | Express 4 |
| AI | Google AI SDK (Gemini 2.5 Flash) |
| Database | better-sqlite3 or Supabase JS SDK |
| File Upload | Multer (50MB, 5 files) |
| File Parsing | pdf-parse, mammoth |
| PDF Export | pdfmake |
| DOCX Export | docx |
| Security | helmet, cors |

### Database
| Mode | Technology |
|------|-----------|
| Production | PostgreSQL (Supabase) |
| Development | SQLite (auto-fallback, `data/kke.db`) |

---

## Project Structure

```
KKE_QUESTION_PAPER_GENERATOR/
│
├── .gitignore
├── package.json                    # Root orchestrator (concurrently)
├── README.md                       # Project documentation
├── run_project.bat                 # One-click Windows runner
├── run_project.ps1                 # One-click PowerShell runner
├── run_project.py                  # One-click Python runner
├── run_project.sh                  # One-click Linux/Mac runner
│
├── database/                       # === DATABASE MIGRATIONS & SCHEMA ===
│   ├── alembic.ini                 # Alembic configuration
│   ├── alembic/                    # Migration scripts
│   ├── migrate_db.py               # SQLite migration utility
│   └── schema.sql                  # Supabase/PostgreSQL schema
│
├── backend/
│   ├── .env / .env.example
│   ├── requirements.txt
│   ├── docker-compose.yml
│   ├── Dockerfile
│   ├── data/                        # SQLite runtime DB
│   ├── logs/                        # Log files
│   ├── uploads/                     # User file uploads
│   │
│   ├── app/                         # === PYTHON FASTAPI BACKEND ===
│   │   ├── main.py                  # App entrypoint (middleware, routers, CORS)
│   │   ├── config.py                # Pydantic Settings (env vars)
│   │   ├── database.py              # Async SQLAlchemy engine + session
│   │   │
│   │   ├── api/
│   │   │   ├── deps.py              # DI: get_db, get_current_user, pagination
│   │   │   └── v1/
│   │   │       ├── auth.py          # POST /login, /register, /refresh
│   │   │       ├── profile.py       # GET /tokens, /quota, /check-quota
│   │   │       ├── questions.py     # POST /generate (SSE), /syllabus-generate
│   │   │       ├── syllabus.py      # GET / (list), /exam-patterns
│   │   │       ├── tasks.py         # POST /create-plan, /approve, /start, /auto-resume
│   │   │       ├── files.py         # POST /upload, /process
│   │   │       ├── search.py        # GET / (global search)
│   │   │       ├── folders.py       # CRUD + /tree
│   │   │       ├── pdf_reader.py    # PDF notes/bookmarks/annotations
│   │   │       └── admin.py         # Dashboard stats, user mgmt, audit logs
│   │   │
│   │   ├── core/
│   │   │   ├── security.py          # JWT create/verify, bcrypt hashing
│   │   │   └── permissions.py       # RoleEnum, PermissionEnum, ROLE_PERMISSIONS
│   │   │
│   │   ├── models/                  # 17 SQLAlchemy ORM models
│   │   │   ├── base.py              # Base + TimestampMixin (UUID PK, timestamps)
│   │   │   ├── user.py              # User, Role, Permission
│   │   │   ├── token_quota.py       # TokenQuota, TokenUsageLog
│   │   │   ├── generation_task.py   # GenerationTask, TaskPhase, TaskApproval
│   │   │   ├── question.py          # PreviousYearQuestion, QuestionBank, GeneratedPaper
│   │   │   ├── syllabus.py          # Syllabus, Topic, SubTopic
│   │   │   ├── uploaded_file.py     # UploadedFile
│   │   │   ├── exam_pattern.py      # ExamPattern
│   │   │   ├── answer_key.py        # AnswerKey, Explanation
│   │   │   ├── current_affair.py    # CurrentAffair, GovernmentScheme
│   │   │   ├── ocr_data.py          # OCRData, Image
│   │   │   ├── ai_job.py            # AIJob, PromptTemplate
│   │   │   ├── log.py               # AuditLog, ActivityLog
│   │   │   ├── setting.py           # Setting
│   │   │   ├── pdf_note.py          # PDFNote, PDFBookmark, PDFAnnotation
│   │   │   └── folder.py            # Folder
│   │   │
│   │   ├── schemas/                 # Pydantic request/response schemas
│   │   │   ├── user.py              # UserCreate, LoginRequest, TokenResponse
│   │   │   ├── question.py          # QuestionGenerate, PaperResponse
│   │   │   ├── file.py              # FileUploadResponse
│   │   │   ├── folder.py            # FolderCreate, FolderTreeResponse
│   │   │   └── pdf_note.py          # PDFNoteCreate/Response
│   │   │
│   │   └── services/                # Business logic layer
│   │       ├── auth_service.py      # User CRUD, login, refresh, RBAC
│   │       ├── ai_service.py        # Gemini API wrapper (generate, stream, validate)
│   │       ├── question_service.py  # Paper generation pipeline, search, dedup
│   │       ├── task_service.py      # Phased tasks, auto-resume, batch generation
│   │       ├── token_service.py     # Quota tracking, daily limits, notifications
│   │       ├── file_service.py      # File storage/retrieval
│   │       └── ocr_service.py       # Tesseract OCR, text extraction
│   │
│   └── src/                         # === EXPRESS.JS SECONDARY BACKEND ===
│       ├── index.ts                 # Express app (:3001)
│       ├── shared/                  # Shared TypeScript types
│       │   └── types.ts
│       ├── routes/
│       │   ├── exams.ts             # Exam CRUD
│       │   ├── upload.ts            # File upload (Multer)
│       │   ├── analyze.ts           # Document analysis + blueprint (SSE)
│       │   ├── generate.ts          # Paper generation (SSE)
│       │   ├── papers.ts            # Paper CRUD + PDF/DOCX export
│       │   └── questions.ts         # Question bank search
│       ├── services/
│       │   ├── gemini.ts            # Gemini 2.5 Flash AI service
│       │   ├── supabase.ts          # Supabase CRUD operations
│       │   ├── fileParser.ts        # PDF/DOCX/TXT/Image parsing
│       │   └── export.ts            # PDF + DOCX export
│       ├── middleware/
│       │   ├── upload.ts            # Multer config
│       │   └── errorHandler.ts      # Global error handler
│       ├── prompts/
│       │   ├── systemPrompt.ts      # Master KKE paper setter persona
│       │   ├── analysisPrompt.ts    # Document analysis prompt
│       │   ├── blueprintPrompt.ts   # Blueprint generation prompt
│       │   ├── paperPrompt.ts       # Paper generation prompt
│       │   └── explanationPrompt.ts # Explanation + trap analysis prompt
│       └── db/
│           ├── index.ts             # Unified DB dispatch
│           └── sqlite.ts            # better-sqlite3 implementation
│
├── frontend/                        # === REACT + VITE + TYPESCRIPT SPA ===
│   ├── index.html
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig*.json
│   └── src/
│       ├── main.tsx                 # React entry point
│       ├── App.tsx                  # Router + protected routes + sidebar layout
│       ├── index.css                # Tailwind imports + theme variables
│       │
│       ├── pages/                   # 9 route pages
│       │   ├── LoginPage.tsx        # Login form with test credentials
│       │   ├── RegisterPage.tsx     # Registration form
│       │   ├── DashboardPage.tsx    # Stats, folders, syllabus-based generation
│       │   ├── UploadPage.tsx       # File upload interface
│       │   ├── ExamPage.tsx         # Exam view
│       │   ├── PaperViewPage.tsx    # Paper detail with questions
│       │   ├── FolderViewPage.tsx   # Folder contents
│       │   ├── ProfilePage.tsx      # User profile + token quota display
│       │   └── TaskPlannerPage.tsx  # Multi-phase task planner with SSE
│       │
│       ├── components/
│       │   ├── ThemeProvider.tsx     # Light/dark theme context
│       │   ├── ModeToggle.tsx       # Theme toggle button
│       │   └── ui/                  # shadcn-style primitives
│       │       ├── button.tsx       # Button with variants
│       │       ├── card.tsx         # Card layout components
│       │       ├── input.tsx        # Input field
│       │       ├── badge.tsx        # Status badge
│       │       ├── toast.tsx        # Toast notification component
│       │       └── toaster.tsx      # Toast renderer
│       │
│       ├── stores/                  # Zustand state management
│       │   ├── authStore.ts         # JWT tokens + user state (persisted)
│       │   ├── appStore.ts          # Current exam/paper context
│       │   └── folderStore.ts       # Folder tree + CRUD state
│       │
│       ├── hooks/
│       │   ├── useApi.ts            # TanStack Query hooks for all entities
│       │   ├── useSSE.ts            # Server-Sent Events hook for streaming
│       │   └── use-toast.ts         # Toast notification system
│       │
│       ├── lib/
│       │   ├── api.ts               # Full API client (~50 endpoints)
│       │   └── utils.ts             # cn() helper (tailwind-merge + clsx)
│       │
│       └── assets/
```

---

## Feature Flows

### Authentication Flow

```mermaid
flowchart TD
    A[User visits app] --> B{Has stored JWT?}
    B -->|No| C[Redirect to /login]
    B -->|Yes| D{Token valid?}
    D -->|Yes| E[Show protected routes]
    D -->|No| F{Refresh token valid?}
    F -->|Yes| G[Get new access token]
    G --> E
    F -->|No| C

    C --> H[Enter credentials]
    H --> I[POST /api/v1/auth/login]
    I --> J[Verify bcrypt hash]
    J -->|Invalid| H
    J -->|Valid| K[Generate JWT access + refresh tokens]
    K --> L[Store in Zustand authStore]
    L --> M[localStorage persistence]
    M --> E

    subgraph Frontend
        A
        C
        E
        H
        L
        M
    end

    subgraph Backend
        I
        J
        K
    end
```

### Syllabus Upload & Question Generation Flow

```mermaid
flowchart TD
    A[User opens Dashboard] --> B{Choose input method}
    B -->|Type syllabus text| C[Enter text in textarea]
    B -->|Upload file| D[Select PDF/DOCX/TXT/Image]
    B -->|Use existing syllabus| E[Select from saved syllabi]

    C --> F[Configure generation params]
    D --> F
    E --> F

    F --> G[Select: exam type, question count (5-500), difficulty]
    G --> H[Click Generate]

    H --> I[POST /api/v1/questions/generate]
    I --> J[Backend receives request]

    J --> K{Has syllabus text?}
    K -->|No| L[Extract text from uploaded file]
    K -->|Yes| M[Use provided text]

    L --> N[POST /api/v1/files/process - OCR if image]
    M --> N

    N --> O[Call Gemini AI: generate MCQs]
    O --> P{Streaming mode?}

    P -->|Yes| Q[SSE response: event stream]
    Q --> R[progress/chunk/complete events]
    R --> S[Frontend updates UI in real-time]
    S --> T[Questions appear as generated]

    P -->|No| U[Return all questions at once]
    U --> T

    T --> V[Parse + validate each question]
    V --> W[Check duplicates against question bank]
    W --> X[Store in: generated_papers + generated_questions]
    X --> Y[Display with expandable explanations]

    subgraph DashboardPage
        A
        B
        C
        D
        E
        F
        G
        H
        S
        Y
    end

    subgraph FastAPI
        I
        J
        K
        L
        M
        N
        O
        P
        Q
        U
        V
        W
        X
    end
```

### Phased Task Planning & Auto-Resume Flow

```mermaid
flowchart TD
    A[User opens Task Planner] --> B[Click 'Create New Plan']
    B --> C[POST /api/v1/tasks/create-plan]
    C --> D[AI breaks down syllabus into phases]
    D --> E[Save GenerationTask + TaskPhases]

    E --> F[Display phases for user review]
    F --> G[User approves each phase]

    G --> H[POST /api/v1/tasks/{id}/approve]
    H --> I[Phase status: approved]

    I --> J[Click 'Start Task']
    J --> K[POST /api/v1/tasks/{id}/start]

    K --> L{Token quota sufficient?}
    L -->|No - Check thresholds| M{Is quota reset needed?}
    M -->|Yes - Daily reset| N[Reset quota automatically]
    N --> O[Auto-resume paused tasks]
    O --> L

    M -->|No| P[Mark task as paused]
    P --> Q[Wait for quota renewal]
    Q --> R[POST /api/v1/tasks/auto-resume]
    R --> S[Find all paused tasks]
    S --> T[Resume generation from last phase]
    T --> L

    L -->|Yes| U[Generate batch of questions per phase]
    U --> V[Track token consumption]
    V --> W{Phase complete?}
    W -->|No| U
    W -->|Yes| X{More phases?}
    X -->|Yes| U
    X -->|No| Y[Task complete]

    V --> Z{Token threshold crossed?}
    Z -->|50/75/90/100%| AA[Notify user via toast]
    AA --> Z

    subgraph TaskPlannerPage
        A
        B
        F
        G
        J
        Q
    end

    subgraph Backend - TaskService
        C
        D
        E
        H
        I
        K
        L
        M
        N
        O
        P
        R
        S
        T
        U
        V
        W
        X
        Y
    end

    subgraph TokenService
        Z
        AA
    end
```

### Token Quota Tracking & Notification Flow

```mermaid
flowchart TD
    A[User performs any AI action] --> B[TokenService.track_usage]
    B --> C[Record tokens used + model used]

    C --> D[TokenService.get_usage_stats]
    D --> E[Calculate today's usage]
    E --> F[Compute daily_pct = used / daily_limit * 100]

    F --> G{Check NOTIFICATION_THRESHOLDS}
    G --> H[50, 75, 90, 100]

    H --> I{Any threshold just crossed?}
    I -->|Yes| J{Already notified for this pct?}
    J -->|No| K[Create notification]
    K --> L[Update last_notification_pct]
    L --> M[Return needs_notification=true]

    J -->|Yes| N[Skip notification]
    I -->|No| N

    M --> O[Frontend displays toast]
    O --> P[ProfilePage shows current usage]

    N --> Q[Return usage stats normally]

    subgraph TokenService
        A
        B
        C
        D
        E
        F
        G
        H
        I
        J
        K
        L
        M
        N
        Q
    end

    subgraph Frontend
        O
        P
    end
```

### File Management Flow

```mermaid
flowchart TD
    A[User uploads file] --> B[POST /api/v1/files/upload]
    B --> C[MIME type validation]
    C --> D{Valid type?}
    D -->|No| E[Reject with error]
    D -->|Yes| F[Save to uploads/{date}/ folder]

    F --> G[Create UploadedFile DB record]
    G --> H[Return file ID + metadata]

    H --> I[User chooses to process]
    I --> J[POST /api/v1/files/process/{id}]

    J --> K{File type?}
    K -->|Image| L[Tesseract OCR]
    K -->|PDF| M[PyMuPDF extract text]
    K -->|DOCX| N[python-docx extract]
    K -->|TXT| O[Read raw text]
    K -->|XLSX| P[openpyxl extract]

    L --> Q[Store extracted text]
    M --> Q
    N --> Q
    O --> Q
    P --> Q

    Q --> R[Update UploadedFile.extracted_text]
    R --> S[File ready for question generation]

    subgraph Frontend
        A
        I
    end

    subgraph FastAPI
        B
        C
        D
        E
        F
        G
        H
        J
        K
        L
        M
        N
        O
        P
        Q
        R
        S
    end
```

### Admin Dashboard Flow

```mermaid
flowchart TD
    A[Admin logs in] --> B{Role = admin?}
    B -->|No| C[Redirect to user dashboard]
    B -->|Yes| D[GET /api/v1/admin/dashboard]

    D --> E[Query DB for stats]
    E --> F[Total users, papers, questions, files]
    F --> G[Token usage across all users]
    G --> H[Recent activity timeline]
    H --> I[Return dashboard response]

    I --> J[Admin can manage users]
    J --> K[PUT /api/v1/admin/users/{id}]
    K --> L[Update role, status, permissions]

    J --> M[View audit logs]
    M --> N[GET /api/v1/admin/audit-logs]
    N --> O[Paginated activity log]

    J --> P[Manage app settings]
    P --> Q[GET /api/v1/admin/settings]

    J --> R[Monitor AI jobs]
    R --> S[GET /api/v1/admin/jobs]

    subgraph Backend (admin.py + AuthService)
        B
        D
        E
        F
        G
        H
        I
        K
        L
        N
        O
        Q
        S
    end

    subgraph Frontend Admin
        A
        C
        J
        M
        P
        R
    end
```

---

## Data Model Diagrams

### Core User & Auth Models

```mermaid
erDiagram
    User {
        uuid id PK
        string username "unique"
        string email "unique"
        string hashed_password
        string full_name
        bool is_active
        uuid role_id FK
        datetime created_at
        datetime updated_at
        datetime deleted_at "soft delete"
    }

    Role {
        uuid id PK
        string name "admin|editor|student"
        string description
    }

    Permission {
        uuid id PK
        string codename "32 granular permissions"
        string description
    }

    RolePermission {
        uuid role_id FK
        uuid permission_id FK
    }

    User ||--o{ Role : "has"
    Role ||--o{ RolePermission : "grants"
    Permission ||--o{ RolePermission : "assigned to"
```

### Question Generation Models

```mermaid
erDiagram
    Syllabus {
        uuid id PK
        string title
        text description
        uuid user_id FK
        uuid folder_id FK
        datetime created_at
    }

    Topic {
        uuid id PK
        string name
        uuid syllabus_id FK
        uuid parent_id FK "self-referencing"
    }

    SubTopic {
        uuid id PK
        string name
        uuid topic_id FK
    }

    GeneratedPaper {
        uuid id PK
        uuid user_id FK
        uuid syllabus_id FK
        string title
        string exam_type
        int question_count
        int total_marks
        int duration_minutes
        string status "draft|completed"
        datetime created_at
    }

    GeneratedQuestion {
        uuid id PK
        uuid paper_id FK
        string question_text
        json options "MCQ options"
        string correct_answer
        string explanation
        string difficulty "easy|medium|hard"
        string topic
        string sub_topic
        string question_type "mcq|descriptive"
        int marks
        uuid topic_id FK
    }

    QuestionBank {
        uuid id PK
        uuid user_id FK
        uuid syllabus_id FK
        string question_text
        json options
        string correct_answer
        string explanation
        string difficulty
        string topic
        string source "generated|uploaded|manual"
        bool verified
        datetime created_at
    }

    AnswerKey {
        uuid id PK
        uuid paper_id FK
        json answers
        int total_marks
        string status
    }

    Explanation {
        uuid id PK
        uuid question_id FK
        text explanation_text
        json references
        string created_by "AI|manual"
    }

    Syllabus ||--o{ Topic : contains
    Topic ||--o{ SubTopic : contains
    Syllabus ||--o{ GeneratedPaper : generates
    GeneratedPaper ||--o{ GeneratedQuestion : contains
    Syllabus ||--o{ QuestionBank : sources
    GeneratedPaper ||--o{ AnswerKey : has
    GeneratedQuestion ||--o{ Explanation : explained_by
```

### Token & Task Management Models

```mermaid
erDiagram
    TokenQuota {
        uuid id PK
        uuid user_id FK "unique"
        int daily_limit "default: 10000"
        int used_today
        int total_tokens_used
        datetime last_reset_date
        float last_notification_pct "tracks last notified threshold"
        bool is_active
        datetime created_at
        datetime updated_at
    }

    TokenUsageLog {
        uuid id PK
        uuid user_id FK
        uuid quota_id FK
        int tokens_used
        string model_used
        string action "generate|analyze|ocr|search"
        string entity_type "paper|question|file"
        uuid entity_id
        datetime created_at
    }

    GenerationTask {
        uuid id PK
        uuid user_id FK
        string title
        string status "pending|in_progress|completed|paused|failed"
        string syllabus_text
        string exam_type
        int question_count
        int difficulty "enum"
        int current_phase
        int total_phases
        uuid paper_id FK "result"
        datetime created_at
        datetime updated_at
    }

    TaskPhase {
        uuid id PK
        uuid task_id FK
        int phase_number
        string name
        string description
        string status "pending|awaiting_approval|approved|in_progress|completed"
        string focus_area
        string topics_json
        int question_count
        datetime completed_at
    }

    TaskApproval {
        uuid id PK
        uuid phase_id FK
        uuid approved_by FK "user"
        string status "pending|approved|rejected"
        text comments
        datetime created_at
    }

    TokenQuota ||--o{ TokenUsageLog : tracks
    GenerationTask ||--o{ TaskPhase : has
    TaskPhase ||--o{ TaskApproval : requires
    TokenQuota }o--|| User : belongs_to
    GenerationTask }o--|| User : owned_by
```

### File & Folder Models

```mermaid
erDiagram
    Folder {
        uuid id PK
        string name
        uuid parent_id FK "self-referencing for tree"
        uuid user_id FK
        string color
        string icon
        int sort_order
        datetime created_at
        datetime updated_at
    }

    UploadedFile {
        uuid id PK
        uuid user_id FK
        uuid folder_id FK
        string filename
        string original_filename
        string mime_type
        int file_size
        string file_path
        string extracted_text "processed content"
        string status "uploaded|processing|processed|failed"
        string processing_type "ocr|text"
        datetime created_at
    }

    PDFNote {
        uuid id PK
        uuid user_id FK
        uuid file_id FK
        int page_number
        text content
        float position_x
        float position_y
        datetime created_at
    }

    PDFBookmark {
        uuid id PK
        uuid user_id FK
        uuid file_id FK
        int page_number
        string title
        int sort_order
    }

    PDFAnnotation {
        uuid id PK
        uuid user_id FK
        uuid file_id FK
        int page_number
        string type "highlight|underline|comment"
        json data "coordinates, colors, text"
        datetime created_at
    }

    Folder ||--o{ Folder : "parent/children"
    Folder ||--o{ UploadedFile : contains
    UploadedFile ||--o{ PDFNote : has
    UploadedFile ||--o{ PDFBookmark : has
    UploadedFile ||--o{ PDFAnnotation : has
```

---

## Setup & Installation

### Prerequisites

- **Python 3.11+** with pip
- **Node.js 18+** with npm
- **Tesseract OCR** (optional, for image text extraction)

### Quick Start (Windows)

```bash
# Clone the repository
git clone <repo-url>
cd kke-question-paper-generator

# Run the one-click launcher (auto-installs deps + starts both servers)
.\run_project.bat
```

### Manual Setup

#### 1. Backend (Python FastAPI)

```bash
cd backend

# Create virtual environment (optional but recommended)
python -m venv venv
venv\Scripts\activate  # Windows
# source venv/bin/activate  # Linux/Mac

# Install dependencies
pip install -r requirements.txt

# Set environment variables
set USE_SQLITE=1
set PYTHONPATH=.

# Initialize database
python -c "import asyncio; from scripts.init_db import main; asyncio.run(main())"

# Start backend
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

#### 2. Backend (Express.js - Legacy)

```bash
cd backend/src
npm install
npm run dev
```

#### 3. Frontend (React + Vite)

```bash
cd frontend
npm install
npm run dev
```

### One-Click Launchers

| Script | Platform |
|--------|----------|
| `run_project.bat` | Windows CMD |
| `run_project.ps1` | Windows PowerShell |
| `run_project.sh` | Linux / macOS |
| `run_project.py` | Cross-platform Python |

Or use the root `package.json`:

```bash
npm run dev          # Starts both backend + frontend via concurrently
npm run dev:backend  # Start backend only
npm run dev:frontend # Start frontend only
npm run build        # Build frontend for production
```

---

## Running the Project

### Quick Run

```bash
# From project root - starts both servers
npm run dev
```

Or double-click `run_project.bat` (Windows) / `run_project.sh` (Linux/Mac).

### Access Points

| Service | URL | Description |
|---------|-----|-------------|
| Frontend (Vite) | http://localhost:5173 | React SPA |
| FastAPI Backend | http://localhost:8000 | Primary API |
| API Docs (Swagger) | http://localhost:8000/docs | Interactive API docs |
| API Docs (ReDoc) | http://localhost:8000/redoc | Alternative docs |
| Express Backend | http://localhost:3001 | Legacy API |

### Test Credentials

| Field | Value |
|-------|-------|
| Username | `testuser` |
| Email | `test@kke.com` |
| Password | `Test@123` |

---

## API Endpoints

### Authentication (`/api/v1/auth`)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/test-credentials` | Get test credentials | No |
| POST | `/register` | Register new user | No |
| POST | `/login` | Login, returns JWT tokens | No |
| POST | `/refresh` | Refresh access token | Refresh |
| GET | `/me` | Get current user | Yes |
| PUT | `/me` | Update profile | Yes |
| POST | `/change-password` | Change password | Yes |

### Questions (`/api/v1/questions`)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/generate` | Generate questions (SSE stream) | Yes |
| POST | `/syllabus-generate` | Generate from saved syllabus | Yes |
| POST | `/upload-and-generate` | Upload + generate in one call | Yes |
| GET | `/papers` | List generated papers | Yes |
| GET | `/papers/{id}` | Get paper with questions | Yes |
| DELETE | `/papers/{id}` | Delete paper | Yes |
| GET | `/question-bank` | Search question bank | Yes |

### Tasks (`/api/v1/tasks`)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/` | List user tasks | Yes |
| POST | `/create-plan` | Create phased task plan | Yes |
| POST | `/{id}/approve` | Approve a phase | Yes |
| POST | `/{id}/start` | Start task execution (SSE) | Yes |
| GET | `/{id}/status` | Get task status | Yes |
| POST | `/auto-resume` | Auto-resume paused tasks on quota reset | Yes |

### Profile & Tokens (`/api/v1/profile`)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/tokens` | Token usage history | Yes |
| GET | `/quota` | Current quota + usage stats | Yes |
| GET | `/check-quota` | Check quota with notification check | Yes |

### Files (`/api/v1/files`)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/upload` | Upload file | Yes |
| GET | `/` | List user files | Yes |
| GET | `/{id}` | Get file details | Yes |
| POST | `/{id}/process` | Process/OCR file | Yes |
| DELETE | `/{id}` | Delete file | Yes |

### Folders (`/api/v1/folders`)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/` | Create folder | Yes |
| GET | `/` | List folders | Yes |
| GET | `/tree` | Get folder tree | Yes |
| GET | `/{id}` | Get folder details | Yes |
| PUT | `/{id}` | Update folder | Yes |
| DELETE | `/{id}` | Delete folder (recursive) | Yes |
| PUT | `/{id}/move` | Move folder | Yes |

### Syllabus (`/api/v1/syllabus`)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/` | List syllabi (with filters) | Yes |
| GET | `/exam-patterns` | List exam patterns | Yes |
| GET | `/{id}` | Get syllabus with topics | Yes |

### Search (`/api/v1/search`)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/` | Global search across entities | Yes |

### PDF Reader (`/api/v1/pdf-reader`)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| CRUD | `/notes` | PDF notes | Yes |
| CRUD | `/bookmarks` | PDF bookmarks | Yes |
| CRUD | `/annotations` | PDF annotations | Yes |

### Admin (`/api/v1/admin`)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/dashboard` | Admin stats dashboard | Admin |
| GET | `/users` | List all users | Admin |
| PUT | `/users/{id}` | Update user | Admin |
| GET | `/audit-logs` | Paginated audit logs | Admin |
| GET | `/settings` | App settings | Admin |
| GET | `/jobs` | AI jobs list | Admin |

### Health

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Full health check (app + DB) |

---

## Environment Variables

### FastAPI Backend (`backend/.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `USE_SQLITE` | `1` | Use SQLite instead of PostgreSQL |
| `GEMINI_API_KEY` | — | Google Gemini API key for AI features |
| `JWT_SECRET_KEY` | auto-generated | Secret for JWT signing |
| `JWT_ALGORITHM` | `HS256` | JWT signing algorithm |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `30` | Access token validity |
| `REFRESH_TOKEN_EXPIRE_DAYS` | `7` | Refresh token validity |
| `SUPABASE_DB_URL` | — | PostgreSQL connection string |
| `REDIS_URL` | `redis://localhost:6379` | Redis for Celery |
| `CELERY_BROKER_URL` | `redis://localhost:6379` | Celery broker |
| `CORS_ORIGINS` | `http://localhost:3000,http://localhost:5173` | Allowed CORS origins |
| `RATE_LIMIT` | `60/minute` | API rate limit |
| `LOG_LEVEL` | `DEBUG` | Logging level |
| `TESSERACT_CMD` | `tesseract` | Tesseract OCR executable path |

### Frontend (`frontend/.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_URL` | `http://localhost:8000/api/v1` | Backend API base URL |

---

## Key Design Decisions

### Why Two Backends?

The project evolved from a Node.js prototype (Express.js + Supabase) to a more robust Python FastAPI implementation. The Express.js backend remains for legacy compatibility but all new development happens in FastAPI.

### Token Quota System

Every AI action costs tokens. The `TokenService` tracks:
- **Daily limit**: Configurable per user (default: 10,000 tokens)
- **Per-action tracking**: Records tokens used per model, per action type
- **Threshold notifications**: Users are notified at 50%, 75%, 90%, and 100% of daily limit
- **Auto-resume**: Tasks paused due to quota are automatically resumed on daily reset

### Phased Task Planning

Large question generation jobs are broken into phases by AI:
1. AI analyzes the syllabus
2. Splits it into logical phases (e.g., by topic or unit)
3. User reviews and approves each phase
4. Each phase generates questions independently
5. If quota runs out, task pauses and auto-resumes when quota resets

### SSE Streaming

Question generation uses Server-Sent Events (SSE) for real-time updates:
- `progress`: Current generation status
- `chunk`: New question generated
- `complete`: All questions done
- `error`: Generation failed

The frontend uses `fetch()` with a ReadableStream reader (not native `EventSource`) to support Authorization headers.

---

## Troubleshooting

### Backend won't start

```bash
# Check Python version
python --version  # Need 3.11+

# Verify dependencies installed
pip list | grep fastapi

# Try running directly with error output
cd backend
set PYTHONPATH=.
set USE_SQLITE=1
python -c "from app.main import app; print('OK')"

# Check .env file exists
```

### Frontend build fails

```bash
cd frontend
npm install
npx tsc --noEmit  # Check TypeScript errors
npx vite build     # Full build
```

### Database issues

```bash
# Delete SQLite DB and reinitialize
del backend\data\kke.db
cd backend
set PYTHONPATH=.
python -c "import asyncio; from scripts.init_db import main; asyncio.run(main())"
```

### Token quota not showing

```bash
# Check quota endpoint directly
curl http://localhost:8000/api/v1/profile/quota -H "Authorization: Bearer <token>"
```

---

## Contributing

1. All new development goes in the **FastAPI backend** (`backend/app/`)
2. Follow existing code patterns (async SQLAlchemy, Pydantic schemas, service layer)
3. Use `ruff` for Python linting
4. Frontend follows the existing component patterns (shadcn-style, Zustand stores)
5. Run `npx tsc --noEmit` in `frontend/` before committing frontend changes
6. Run `python -c "from app.main import app"` in `backend/` to verify imports

---

## License

Private / Proprietary — Karnataka Knowledge Corporation
