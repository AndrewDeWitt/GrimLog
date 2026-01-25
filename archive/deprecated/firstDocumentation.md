# Project Plan: Warhammer 40K AI Game Assistant MVP

## 1. Project Overview

**Goal:** Develop a Minimum Viable Product (MVP) of a web-based AI assistant for solo Warhammer 40,000 players. The application will listen to the player's voice, identify the current game phase, and display it on the screen.

**Tech Stack:**
* **Framework:** Next.js (App Router)
* **Styling:** Tailwind CSS
* **AI Services:** OpenAI API (Whisper for Speech-to-Text, GPT for Intent Recognition)
* **Deployment:** Vercel

---

## 2. Core MVP Features

1.  **Microphone Access:** Securely request and access the user's microphone via the browser.
2.  **Real-time Audio Capture:** Capture audio while the user is speaking.
3.  **Speech-to-Text (STT):** Send captured audio to OpenAI's Whisper API for transcription.
4.  **Game Phase Recognition:** Analyze the transcribed text to identify keywords related to Warhammer 40K game phases (e.g., "Command Phase," "start my movement," "shooting phase").
5.  **Dynamic UI:** Display the current recognized game phase to the user in a clean interface.
6.  **Status Indicators:** Show the application's status (e.g., "Listening," "Processing," "Idle").

---

## 3. Technical Architecture

### Frontend (Next.js & Tailwind CSS)

The frontend will be a single-page interface.

* **`app/page.tsx`:** The main component that houses the UI and handles client-side logic.
* **Components (`components/`):**
    * **`PhaseDisplay.tsx`:** A component to show the current game phase.
    * **`StatusIndicator.tsx`:** A component to display the app's current status.
    * **`StartStopButton.tsx`:** A button to initiate and stop the audio capture.
    * **`TranscriptionLog.tsx`:** (Optional but recommended) A small panel to show the live transcription from Whisper.

### Backend (Next.js API Routes)

We will use a single API route to handle the AI processing.

* **`app/api/transcribe/route.ts`:**
    * Receives audio data (as a Blob or similar format) from the frontend.
    * Forwards the audio to the OpenAI Whisper API for transcription.
    * Takes the resulting text and sends it to the OpenAI Chat Completions API (GPT-4) with a specific prompt to extract the game phase.
    * Returns the identified phase (e.g., `{ phase: "Movement Phase" }`) to the frontend as a JSON object.

### State Management

For the MVP, we can use React's built-in `useState` and `useCallback` hooks within the main `page.tsx` component to manage the application's state (e.g., `currentPhase`, `isListening`, `statusMessage`).

---

## 4. Step-by-Step Implementation Plan

### Phase 1: Project Setup

1.  **Initialize Next.js App:**
    ```bash
    npx create-next-app@latest warhammer-ai-assistant --typescript --tailwind --eslint
    ```
2.  **Install Dependencies:** We'll need a library to handle audio recording easily. `mic-recorder-to-mp3` is a good choice.
    ```bash
    npm install mic-recorder-to-mp3 openai
    ```
3.  **Environment Variables:** Create a `.env.local` file in the root directory and add your OpenAI API key.
    ```
    OPENAI_API_KEY="your_secret_api_key_here"
    ```

### Phase 2: Build the Basic UI

Create the component files listed in the architecture section. Style them with Tailwind CSS to create a simple, clean interface.

* **`app/page.tsx`:** Assemble the main layout using the components.
* **`components/PhaseDisplay.tsx`:** A large text element to show the phase.
* **`components/StatusIndicator.tsx`:** A small text element or badge.
* **`components/StartStopButton.tsx`:** A button that will trigger the recording logic.

### Phase 3: Implement Client-Side Audio Capture

In `app/page.tsx`, implement the logic to handle microphone input.

* Use the `mic-recorder-to-mp3` library to request microphone permissions and record audio.
* Create a function to start recording when the user clicks the "Start" button.
* Create a function that stops recording after a few seconds of silence or when the user clicks "Stop."
* When recording stops, this function should take the resulting MP3 blob and send it to our backend API endpoint.

### Phase 4: Create the Backend API Route

Implement the `app/api/transcribe/route.ts` file.

1.  **Receive Audio:** The handler will receive a `POST` request with the audio file in the request body.
2.  **Call Whisper API:** Use the `openai` library to send the audio file to the Whisper API for transcription.
3.  **Call Chat Completions API:** Take the text returned by Whisper. Create a prompt to instruct the GPT model.
    * **Example Prompt:** `"You are an expert Warhammer 40K game assistant. Analyze the following text and identify which of the 9 game phases it refers to. The phases are: Command, Movement, Reinforcements, Shooting, Charge, Fight, Morale, Pysker, and Fortification. If a phase is mentioned, respond with only the JSON object: {\"phase\": \"Phase Name\"}. If no phase is mentioned, respond with {\"phase\": \"Unknown\"}. Text: '{transcribed_text_here}'"`
4.  **Return Response:** Parse the model's response and send the JSON object back to the frontend.

### Phase 5: Connect Frontend and Backend

In `app/page.tsx`, update the audio handling logic:

* When the `fetch` call to your `/api/transcribe` endpoint returns successfully, use the response data to update the `currentPhase` state.
* This will automatically re-render the `PhaseDisplay` component with the new game phase.
* Implement error handling for API calls and update the status indicator accordingly.

### Phase 6: Deployment

1.  **Push to GitHub:** Initialize a git repository and push your code to GitHub.
2.  **Deploy on Vercel:**
    * Connect your Vercel account to your GitHub repository.
    * Configure the project environment variables in the Vercel dashboard by adding your `OPENAI_API_KEY`.
    * Deploy the `main` branch. Vercel will handle the rest. Remember that microphone access requires an **HTTPS** connection, which Vercel provides automatically.

---

## 5. Proposed File Structure