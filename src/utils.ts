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
