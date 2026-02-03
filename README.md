# AI-UML - AI-Powered Diagram Generator

Generate architecture diagrams, UML diagrams, and high-level designs from natural language using AI.

**Principle:** Keep the app light — minimal dependencies, small bundle, lean runtime. See [docs/PRINCIPLES.md](docs/PRINCIPLES.md).

![AI-UML](https://img.shields.io/badge/AI-Powered-blue)
![React](https://img.shields.io/badge/React-18-61dafb)
![Next.js](https://img.shields.io/badge/Next.js-16-black)
![Python](https://img.shields.io/badge/Python-3.11+-3776ab)
![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-009688)

## Features

- **Multiple Diagram Types**
  - Architecture Diagrams
  - High-Level Design (HLD)
  - Class Diagrams
  - Sequence Diagrams
  - Use Case Diagrams
  - Activity Diagrams
  - State Diagrams
  - Component Diagrams
  - Deployment Diagrams

- **Interactive Canvas**
  - ReactFlow-based node rendering
  - Mermaid-style animated edges
  - Drag and drop nodes
  - Zoom and pan controls
  - Mini-map navigation

- **AI-Powered Generation**
  - Natural language to diagram conversion
  - Supports OpenRouter and OpenAI models
  - RAG-enhanced context for better results

- **Theme Support**
  - Light and dark mode
  - Smooth theme transitions
  - Persistent theme preference

- **Export Options**
  - PNG image export
  - SVG vector export
  - PDF document export
  - JSON data export

## Tech Stack

### Frontend
- Next.js 16 (React 18)
- ReactFlow for diagram rendering
- Tailwind CSS for styling
- TypeScript

### Backend
- Python 3.11+
- FastAPI
- LangChain + LangGraph
- OpenRouter / OpenAI integration

## Getting Started

### Prerequisites
- Node.js 18+
- Python 3.11+
- OpenRouter API key or OpenAI API key

### Backend Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt

# Create .env file
echo "OPENROUTER_API_KEY=your_key_here" > .env

# Start the server
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

1. Select a diagram type from the dropdown
2. Choose an AI model
3. Enter a natural language description of your system
4. Click "Generate" to create the diagram
5. Interact with nodes (drag, select, edit)
6. Export your diagram in various formats

## Environment Variables

### 100% free setup (recommended)
- **Backend:** set only `OPENROUTER_API_KEY` (get a free key at [openrouter.ai](https://openrouter.ai)). Use free models (e.g. Trinity) in the app.
- **RAG:** leave `PINECONE_API_KEY` and `OPENAI_API_KEY` unset — the app uses built-in best-practice context at no cost.
- **GitHub (optional):** `GITHUB_TOKEN` for higher rate limit on “From repo”; not required for public repos.

### Backend (.env) — full reference
```
OPENROUTER_API_KEY=your_openrouter_key
# OR
OPENAI_API_KEY=your_openai_key
# Optional: PINECONE_API_KEY + OPENAI_API_KEY for vector RAG (paid embeddings)
```

### Frontend (.env.local)
```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## Project Structure

```
ai-uml/
├── backend/
│   ├── main.py           # FastAPI application
│   ├── agent.py          # LangGraph agent for diagram generation
│   ├── uml_flow.py       # UML diagram generators
│   ├── rag.py            # RAG retrieval system
│   └── requirements.txt
├── frontend/
│   ├── app/              # Next.js app directory
│   ├── components/       # React components
│   │   ├── Canvas.tsx    # Main diagram canvas
│   │   ├── MermaidStyleEdge.tsx
│   │   ├── ThemeProvider.tsx
│   │   └── uml/          # UML node components
│   └── lib/              # Utilities and API
└── README.md
```

## License

MIT License

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
