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

export const loadBranchTimeLog = (): Record<string, number> | null => {
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
  secondsSpendWorking: number
) => {
  const timeLog = loadBranchTimeLog();

  if (!timeLog) {
    return;
  }

  timeLog[branchName] = (timeLog[branchName] || 0) + secondsSpendWorking;
  saveBranchTimeLog(timeLog);
};

export const saveBranchTimeLog = (timeLog: Record<string, number>) => {
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

  const branchTimeLog = completeTimeLog?.[branchName] || 0;

  if (!branchTimeLog) {
    updateBranchTimeLog(branchName, 0);
  }

  const hours = Math.floor(branchTimeLog / 3600);
  const minutes = Math.floor((branchTimeLog % 3600) / 60);

  statusBarItem.text = `${branchName} - ${hours}h${minutes}m`;
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

export const getDashboardHtml = (data: Record<string, number>): string => {
  const rows = Object.entries(data).map(([branch, totalMs]) => {
    const lastActive = "—"; // Not tracked in your current format

    const hours = Math.floor(totalMs / 3600);
    const minutes = Math.floor((totalMs % 3600) / 60);

    return `
        <tr>
          <td>${branch}</td>
          <td>${hours}h ${minutes}m</td>
          <td>${lastActive}</td>
        </tr>
      `;
  });

  return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <style>
          body { font-family: sans-serif; padding: 20px; }
          table {
            width: 100%;
            border-collapse: collapse;
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
        </style>
      </head>
      <body>
        <h2>Branch Time Dashboard</h2>
        <table>
          <thead>
            <tr>
              <th>Branch</th>
              <th>Total Time</th>
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
