# VCA Desktop v0.0.1

Prototype for Windows desktop observation and manually authorized actions.

## Install

Requires Node.js and native build tools for robotjs (Python and Visual Studio C++ Build Tools). `robotjs` is a legacy native module and may fail to build with newer Node versions. Prefer Node 20 LTS if your environment supports it. Run `npm install`, then `npm run dev`.

Open http://127.0.0.1:5173. Local API listens on 127.0.0.1:4317.

## Features

- Desktop screenshots and OCR (English language model).
- Manual scroll and text input on the active Windows window.
- Move/click available in API with validated screen coordinates.
- Observation mode is default. Execution mode must be enabled manually.

## Limitations

This is a proof of concept, not an autonomous agent. The STOP button disables subsequent actions but cannot interrupt an already running synchronous robotjs call. It does not have a global emergency hotkey, sensitive-screen detection, persistent tasks, or visual change detection. The UI is itself a window: minimize or move it away to operate on the target window. Screenshots are held in memory and returned through localhost. Avoid exposing localhost to untrusted web pages; add authentication and strict origin checks before production use. Do not use this to evade access restrictions or platform security measures.
