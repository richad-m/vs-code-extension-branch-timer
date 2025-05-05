# Branch Time Tracker

Track how much time you spend actively coding on each Git branch directly inside VS Code — lightweight, seamless, and private.

---

## ✨ Features

- 🕒 Tracks coding time **per Git branch**
- 💤 Ignores idle time (no tracking if you stop coding for a while)
- 🚫 Doesn't track just being open — only real edits count
- 💾 Saves time data in `.vscode/branch-time.json`
- 🔍 One-click access to your logs from the status bar

---

## 🚀 Getting Started

### 🔌 Install

- From VSCode Marketplace (coming soon), or:
- Manual install:
  1. Run `vsce package` to build `.vsix`
  2. In VSCode: `Cmd+Shift+P` → `Extensions: Install from VSIX`
  3. Choose your `.vsix` file

---

## 📂 Where is the log saved?

The extension writes a JSON file to your current workspace: .vscode/branch-time.json

Each Git branch gets its own timer. All time is stored in **seconds**.

---

## ⚙️ How It Works

- On each file edit, the extension checks how long it's been since your last activity
- If the delay is short (e.g. <2 minutes), it adds the time to your branch log
- Time between edits is capped (to avoid idle bloat)
- No tracking when you're not typing

---

## 🧠 Why Use This?

> Because time-tracking tools often miss developer flow.

This extension is:

- 🔐 100% local (no data leaves your machine)
- 🧩 Git-branch aware
- 🧘‍♀️ Automatic – no need to start or stop timers manually

Great for:

- Tracking task time
- Comparing effort between branches/features
- Estimating PR time

---

## 💬 Feedback / Contributions

This is an open work-in-progress. Feedback and ideas welcome!

- Issues / suggestions → [GitHub repo](https://github.com/richad-m/vs-code-extension-branch-timer)
- Pull requests welcome!

---
