import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { GitApi } from "./types";

export const getBranchTimeLogPath = (): string | null => {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    return null;
  }

  const vscodeDir = path.join(workspaceFolder.uri.fsPath, ".vscode");
  if (!fs.existsSync(vscodeDir)) {
    fs.mkdirSync(vscodeDir, { recursive: true });
  }

  return path.join(vscodeDir, "branch-time.json");
};

export const loadBranchTimeLog = (): Record<
  string,
  {
    focus: number;
    writing: number;
    lastActivity: string;
  }
> | null => {
  const timeLogPath = getBranchTimeLogPath();

  try {
    if (!timeLogPath) {
      return null;
    }
    const rawTimeLog = fs.readFileSync(timeLogPath, "utf8");
    return JSON.parse(rawTimeLog);
  } catch (err) {
    console.error("Failed to read time log:", err);
    return null;
  }
};

export const updateBranchTimeLog = (
  branchName: string,
  secondsSpendWorking: number,
  mode: "focus" | "writing"
): void => {
  const timeLog = loadBranchTimeLog();

  if (!timeLog) {
    return;
  }

  const currentDate = new Date().toISOString();
  const branchData = timeLog[branchName] || {
    focus: 0,
    writing: 0,
    lastActivity: currentDate,
  };

  if (mode === "writing") {
    branchData.writing += secondsSpendWorking;
  } else {
    branchData.focus += secondsSpendWorking;
  }

  branchData.lastActivity = currentDate;
  timeLog[branchName] = branchData;
  saveBranchTimeLog(timeLog);
};

export const saveBranchTimeLog = (
  timeLog: Record<
    string,
    {
      focus: number;
      writing: number;
      lastActivity: string;
    }
  >
) => {
  const timeLogPath = getBranchTimeLogPath();

  try {
    if (!timeLogPath) {
      return;
    }
    fs.writeFileSync(timeLogPath, JSON.stringify(timeLog, null, 2), "utf8");
  } catch (err) {
    console.error("Failed to write time log:", err);
  }
};

export const initializeStatusBar = (
  context: vscode.ExtensionContext
): vscode.StatusBarItem => {
  const statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    100
  );
  statusBarItem.text = "$(watch) Branch Time Tracking";
  statusBarItem.tooltip = "Click to open .vscode/branch-time.json";
  statusBarItem.command = "branch-timer.openLog";
  statusBarItem.show();

  context.subscriptions.push(statusBarItem);

  const openLogCommand = vscode.commands.registerCommand(
    "branch-timer.openLog",
    () => {
      const logPath = getBranchTimeLogPath();
      if (logPath && fs.existsSync(logPath)) {
        vscode.workspace.openTextDocument(logPath).then((doc) => {
          vscode.window.showTextDocument(doc);
        });
      } else {
        vscode.window.showWarningMessage("Time log file not found.");
      }
    }
  );

  context.subscriptions.push(openLogCommand);

  return statusBarItem;
};

export const getActiveGitBranchName = (git: GitApi): string | undefined => {
  const repo = git.repositories[0]; // TODO: Handle multiple repos
  return repo?.state?.HEAD?.name;
};

export function updateStatusBarText(
  statusBarItem: vscode.StatusBarItem,
  branchName: string
) {
  const completeTimeLog = loadBranchTimeLog();

  const branchData = completeTimeLog?.[branchName] || {
    focus: 0,
    writing: 0,
    lastActivity: new Date().toISOString(),
  };
  const totalTime = branchData.focus + branchData.writing;

  if (!totalTime) {
    return;
  }

  const hoursFocus = Math.floor(branchData.focus / 3600);
  const minutesFocus = Math.floor((branchData.focus % 3600) / 60);
  const hoursWriting = Math.floor(branchData.writing / 3600);
  const minutesWriting = Math.floor((branchData.writing % 3600) / 60);

  statusBarItem.text = `${branchName} - FOCUSED: ${hoursFocus}h${minutesFocus}m WRITING: ${hoursWriting}h${minutesWriting}m`;
}

export const handleShowDashboardCommand = (
  context: vscode.ExtensionContext
) => {
  context.subscriptions.push(
    vscode.commands.registerCommand("branch-timer.showDashboard", () => {
      const panel = vscode.window.createWebviewPanel(
        "branch-timer-dashboard",
        "Branch Timer Dashboard",
        vscode.ViewColumn.One,
        { enableScripts: true }
      );

      const branchTimeLogPath = getBranchTimeLogPath();

      if (!branchTimeLogPath) {
        vscode.window.showErrorMessage("Could not read branch tracking data.");
        return;
      }

      try {
        const raw = fs.readFileSync(branchTimeLogPath, "utf8");
        const data = JSON.parse(raw);
        panel.webview.html = getDashboardHtml(data);
      } catch (err) {
        vscode.window.showErrorMessage("Could not read branch tracking data.");
      }
    })
  );
};

export const getDashboardHtml = (
  data: Record<
    string,
    {
      focus: number;
      writing: number;
      lastActivity: string;
    }
  >
): string => {
  const rows = Object.entries(data).map(
    ([branch, { focus, writing, lastActivity }]) => {
      const readingHours = Math.floor(focus / 3600);
      const readingMinutes = Math.floor((focus % 3600) / 60);
      const editingHours = Math.floor(writing / 3600);
      const editingMinutes = Math.floor((writing % 3600) / 60);
      const formattedDate = new Date(lastActivity).toLocaleString();

      return `
        <tr>
          <td>${branch}</td>
          <td>${readingHours}h ${readingMinutes}m</td>
          <td>${editingHours}h ${editingMinutes}m</td>
          <td>${formattedDate}</td>
        </tr>
      `;
    }
  );

  return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <style>
          body { font-family: sans-serif; padding: 20px; }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
          }
          th, td {
            padding: 8px 12px;
            border-bottom: 1px solid #ddd;
          }
          th {
            text-align: left;
            background: #f3f3f3;
          }
          tr:hover {
            background-color: #f5f5f5;
          }
          .explanation {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 5px;
            margin-bottom: 20px;
          }
          .explanation h3 {
            margin-top: 0;
            color: #333;
          }
          .explanation ul {
            margin: 10px 0;
            padding-left: 20px;
          }
          .explanation li {
            margin: 5px 0;
          }
        </style>
      </head>
      <body>
        <h2>Branch Time Dashboard</h2>
        
        <div class="explanation">
          <h3>How Time is Tracked</h3>
          <ul>
            <li><strong>Focus Time:</strong> Tracks the total time VS Code is focused (active window). This includes:
              <ul>
                <li>Time starts when VS Code gains focus</li>
                <li>Time stops when VS Code loses focus</li>
                <li>All focus time is logged without any caps or thresholds</li>
              </ul>
            </li>
            <li><strong>Writing Time:</strong> Tracks time spent actively editing code. This includes:
              <ul>
                <li>Time between text changes is capped at 30 seconds</li>
                <li>If no changes for 2 minutes, time is considered idle</li>
                <li>Only counts actual editing activity</li>
              </ul>
            </li>
          </ul>
        </div>

        <table>
          <thead>
            <tr>
              <th>Branch</th>
              <th>Reading Time</th>
              <th>Editing Time</th>
              <th>Last Activity</th>
            </tr>
          </thead>
          <tbody>
            ${rows.join("")}
          </tbody>
        </table>
      </body>
      </html>
    `;
};
