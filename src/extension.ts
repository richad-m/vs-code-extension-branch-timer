import * as vscode from "vscode";
import * as fs from "fs";
import {
  getActiveGitBranchName,
  getBranchTimeLogPath,
  handleShowDashboardCommand,
  initializeStatusBar,
  updateBranchTimeLog,
  updateStatusBarText,
} from "./utils";

let lastEditTime = Date.now();
// Cap active interval to 30s
// Because small breaks are normal. But you shouldn't get 5 minutes of "coding" credit for one line of code written after a break.
// Example : you typed, then 50 seconds later typed again → it only logs 30s max
const MAX_ACTIVE_INTERVAL = 30 * 1000; // Max 30s between edits

// Threshold for when the user is idle to prevent count time when
// Going to lunch, Leaving tab open, etc.
const IDLE_THRESHOLD_MS = 2 * 60 * 1000; // After 2 mins of no activity, elapsed time is ignored

export function activate(context: vscode.ExtensionContext) {
  const gitExt = vscode.extensions.getExtension("vscode.git")?.exports;
  const gitApi = gitExt?.getAPI(1);

  if (!gitApi) {
    vscode.window.showWarningMessage(
      "Git extension not found. Branch tracking won't work."
    );
    return;
  }

  const branchName = getActiveGitBranchName(gitApi);

  const timeLogPath = getBranchTimeLogPath();

  if (!timeLogPath || !branchName) {
    vscode.window.showWarningMessage(
      "Branch time log path not found. Branch tracking won't work."
    );
    return;
  }

  if (!fs.existsSync(timeLogPath)) {
    fs.writeFileSync(timeLogPath, JSON.stringify({}, null, 2), "utf8");
  }

  handleShowDashboardCommand(context);

  const statusBarItem = initializeStatusBar(context);

  // update status bar text every minute
  setInterval(() => {
    updateStatusBarText(statusBarItem, branchName);
  }, 60 * 1000);

  vscode.workspace.onDidChangeTextDocument(() => {
    onTextDocumentChange(branchName);
  });

  gitApi.onDidChangeRepository((repo: any) => {
    onBranchChange(repo);
    updateStatusBarText(statusBarItem, repo.state.activeBranch?.name);
  });
}

const onTextDocumentChange = (branchName: string) => {
  const now = Date.now();
  const elapsedTimeSinceLastEdit = now - lastEditTime;

  if (elapsedTimeSinceLastEdit > IDLE_THRESHOLD_MS) {
    return;
  }

  const timeToAdd = Math.min(elapsedTimeSinceLastEdit, MAX_ACTIVE_INTERVAL);

  updateBranchTimeLog(branchName, Math.floor(timeToAdd / 1000));

  lastEditTime = now;
};

export function deactivate() {
  vscode.window.showWarningMessage("Deactivating extension");
}

const onBranchChange = (gitApi: any) => {
  const branchName = getActiveGitBranchName(gitApi);
  if (!branchName) {
    return;
  }
  gitApi.onDidChangeRepository((repo: any) => {
    const newBranchName = repo.state.activeBranch?.name;

    if (!newBranchName) {
      return;
    }

    if (newBranchName !== branchName) {
      lastEditTime = 0; // Reset lastEditTime when the branch changes
    }
  });
};
