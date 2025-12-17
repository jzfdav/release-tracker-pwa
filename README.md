# Release Branching Checklist PWA

A lightweight, offline-first Progressive Web App (PWA) designed to track release branching tasks and set reminders.

## 🚀 Features

-   **Release Tracking**: Manage checklists for Quarterly (QR) and Minor (MR) releases.
-   **Offline-First**: Powered by IndexedDB for persistent local storage without a backend.
-   **Reminders & Notifications**: Set reminders for specific tasks.
-   **Background Notifications**: Service Worker handles reminder firing even when the app is backgrounded (best-effort locally).
-   **Dark Mode**: Built-in dark theme with system preference detection and persistence.
-   **PWA Ready**: Installable on mobile and desktop for a native-like experience.

## 🛠️ Technology Stack

-   **Vanilla JavaScript**: No heavy frameworks, just pure JS.
-   **CSS3**: Custom styling with CSS Variables for themes.
-   **IndexedDB**: Browser-based database for persistence.
-   **Service Workers**: Background logic and lifecycle management.
-   **Notification API**: Native OS notifications for alerts.

## 📦 Getting Started

### Prerequisites

-   A modern web browser (Chrome, Edge, or Safari).
-   A local web server (Python, Node.js, etc.) to handle Service Worker registration.

### Running Locally

1.  Clone the repository:
    ```bash
    git clone https://github.com/jzfdav/release-tracker-pwa.git
    cd release-tracker-pwa
    ```

2.  Serve the `src/app` directory. For example, using Python:
    ```bash
    cd src/app
    python3 -m http.server 8000
    ```

3.  Open `http://localhost:8000` in your browser.

## 📖 Usage

1.  **Create a Release**: Select the release type (QR/MR), year, and quarter.
2.  **Tracking Tasks**: Click on a release to see its branching checklist.
3.  **Reminders**: Click "Set Reminder" on any planned task.
4.  **Dark Mode**: Toggle the theme using the button in the top right.

## 📋 Note on Background Notifications

This app uses a Service Worker-based `setTimeout` mechanism for reminders. 
-   Reminders work best when the browser remains open.
-   Browsers may throttle or kill background Service Workers, which can delay or prevent alerts if the computer enters sleep mode or the browser process is fully terminated.

## 📄 License

MIT
