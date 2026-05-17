

# Visual Notebook: Agentic Command Center

Visual Notebook is an advanced interactive computing environment that blends code, prose, diagrams, animations and rich media into a single, shareable document. Unlike traditional notebooks (e.g., Jupyter) which are primarily linear and text-based, a Visual Notebook emphasizes multiple modalities: you can have code cells (Python, JavaScript, etc.), markdown explanations, interactive charts, diagrams (e.g., Mermaid), and even embedded canvas-like tools for sketching or mind maps.

## 🚀 Key Features

*   **Interactive Web Sandboxing**: A dedicated cell type supporting independent HTML, CSS, and JS editing. Features a fully sandboxed iframe preview with real-time console output interception.
*   **Pro-active WhatsApp Agent**: Deep integration with WhatsApp (via `@whiskeysockets/baileys`) providing a mobile engineering interface and proactive background messaging capabilities.
*   **Autonomous Task Management**: Robust terminal subprocess handling with state recovery, signal handling, and clean process cleanup via a Python-powered WebSocket backend.
*   **AI-Assisted Workflows**: Seamlessly integrated with several AI providers to support automated code generation, creating rich markup and animations and structural optimizations.
*   **Advanced State Recovery**: High-performance backend-backed notebook storage and state management preventing UI lag and ensuring a reliable development experience.

## 🛠️ Tech Stack

*   **Frontend**: React 19, Vite, Tailwind CSS 4, Framer Motion
*   **Backend Services**: Python (`server.py`) and Node.js (`whatsapp_service.js`)
*   **Integrations**: Xterm.js for terminal emulation, Baileys for WhatsApp, Google GenAI SDK, etc.

## 🏃‍♂️ Getting Started

**Prerequisites:** Node.js (v20+ recommended) and Python 3.

1.  **Install JS Dependencies:**
    ```bash
    npm install
    ```

2.  **Install Python Dependencies:**
    ```bash
    pip install -r requirements.txt
    ```

3.  **Environment Variables:**
    Create a `.env` (or `.env.local`) file and add your API Keys:
    ```env
    AI_API_KEY=your_api_key_here
    ```

4.  **Run the Application:**
    Start the Vite frontend, Python backend, and WhatsApp service concurrently:
    ```bash
    npm run dev
    ```

The application will be available at `http://localhost:3000`.
