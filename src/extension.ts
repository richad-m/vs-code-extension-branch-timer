import * as vscode from "vscode";
import * as fs from "fs";
import {
  getActiveGitBranchName,
  getBranchTimeLogPath,
  initializeStatusBar,
  updateBranchTimeLog,
  updateStatusBarText,
} from "./utils";
import { GitApi } from "./types";
import { handleShowDashboardCommand } from "./dashboard";

let lastWritingTime = Date.now();
let lastFocusTime = Date.now();
let isVSCodeFocused = true;

// Cap active interval to 30s
const MAX_ACTIVE_INTERVAL = 30 * 1000; // Max 30s between activities

// Threshold for when the user is idle
const IDLE_THRESHOLD_MS = 2 * 60 * 1000; // After 2 mins of no activity, elapsed time is ignored

export function activate(context: vscode.ExtensionContext) {
  const gitExt = vscode.extensions.getExtension("vscode.git")?.exports;
  const gitApi = gitExt?.getAPI(1) as GitApi;

  if (!gitApi) {
    vscode.window.showWarningMessage(
      "Git extension not found. Branch tracking won't work."
    );
    return;
  }
  let currentActiveBranch = getActiveGitBranchName(gitApi);

  const timeLogPath = getBranchTimeLogPath();

  if (!timeLogPath) {
    vscode.window.showWarningMessage(
      "Branch time log path not found. Branch tracking won't work."
    );
    return;
  }

  if (!fs.existsSync(timeLogPath)) {
    fs.writeFileSync(timeLogPath, JSON.stringify({}, null, 2), "utf8");
  }

  vscode.window.showInformationMessage("Branch timer is now running");
  handleShowDashboardCommand(context);

  const statusBarItem = initializeStatusBar(context);

  vscode.window.onDidChangeWindowState((e) => {
    if (!currentActiveBranch) {
      return;
    }

    isVSCodeFocused = e.focused;

    if (e.focused) {
      onFocus();
    } else {
      onBlur(currentActiveBranch);
    }
  });

  vscode.workspace.onDidChangeTextDocument((event) => {
    if (!currentActiveBranch) {
      return;
    }

    // Skip if the changed document is our time log file
    if (event.document.uri.fsPath === timeLogPath) {
      return;
    }

    onEditingActivity(currentActiveBranch);
  });

  const state = gitApi?.repositories[0]?.state;

  if (!state) {
    vscode.window.showWarningMessage("No state found");
    return;
  }

  // Listen to branch changes
  state.onDidChange(() => {
    const newBranchName = getActiveGitBranchName(gitApi);

    if (!newBranchName || newBranchName === currentActiveBranch) {
      return;
    }

    currentActiveBranch = newBranchName;
    onBranchChange();
    updateStatusBarText(statusBarItem, newBranchName);
  });

  // update status bar text every minute
  setInterval(() => {
    const currentBranchName = getActiveGitBranchName(gitApi);

    if (!currentBranchName) {
      return;
    }

    updateStatusBarText(statusBarItem, currentBranchName);
  }, 60 * 1000);
}

const onEditingActivity = (branchName: string) => {
  const now = Date.now();
  const elapsedTimeSinceLastActivity = now - lastWritingTime;

  if (
    elapsedTimeSinceLastActivity > IDLE_THRESHOLD_MS &&
    lastWritingTime !== 0
  ) {
    return;
  }

  const timeToAdd = Math.min(elapsedTimeSinceLastActivity, MAX_ACTIVE_INTERVAL);
  updateBranchTimeLog(branchName, Math.floor(timeToAdd / 1000), "writing");
  lastWritingTime = now;
};

const onFocus = () => {
  lastFocusTime = Date.now();
};

const onBlur = (branchName: string) => {
  const now = Date.now();
  const timeSpentFocus = now - lastFocusTime;

  updateBranchTimeLog(branchName, Math.floor(timeSpentFocus / 1000), "focus");
  lastFocusTime = now;
};

export function deactivate() {
  lastWritingTime = Date.now();
  lastFocusTime = Date.now();
  vscode.window.showWarningMessage("Deactivating extension");
}

const onBranchChange = () => {
  lastWritingTime = Date.now();
  lastFocusTime = Date.now();
};
