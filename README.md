# NEON AI

NEON AI is a learning-focused chatbot for programming and game development questions. It combines a React and TypeScript chat interface with a FastAPI backend, a local Qwen model running through Ollama, and Tavily web search.

## Features

- Local AI responses powered by Ollama and `qwen2.5:1.5b`
- Web search through Tavily, with source links in responses
- Streaming responses and a stop-generation button
- Chat history saved in the browser
- Searchable conversation history and a collapsible sidebar
- Light lavender interface, with responsive layouts
- Copy buttons for responses and code blocks
- Text and code file contents can be added to a message

> Attachments are added to the message as text. The backend does not upload or process image and binary files.

## Technology

- **Frontend:** React, TypeScript, Vite
- **Backend:** Python, FastAPI
- **Local model:** Ollama with Qwen 2.5 1.5B
- **Web search:** Tavily Search API

## Requirements

Install these before running the project:

- Python
- Node.js and npm
- Ollama
- A Tavily API key

## Setup

### 1. Get the project

```powershell
git clone https://github.com/Jayalakshmikulal/NEON-AI.git
cd NEON-AI
