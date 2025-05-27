import * as vscode from "vscode";
import * as fs from "fs";
import { getBranchTimeLogPath } from "./utils";

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
  // Sort branches by lastActivity in descending order
  const sortedBranches = Object.entries(data).sort(([, a], [, b]) => {
    return (
      new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime()
    );
  });

  const rows = sortedBranches.map(
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
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
            padding: 20px;
            background-color: #1e1e1e;
            color: #d4d4d4;
          }
          h2 {
            color: #ffffff;
            margin-bottom: 20px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
            background-color: #252526;
          }
          th, td {
            padding: 12px 16px;
            border-bottom: 1px solid #3c3c3c;
            text-align: left;
          }
          th {
            background: #2d2d2d;
            color: #ffffff;
            font-weight: 600;
          }
          tr:hover {
            background-color: #2a2d2e;
          }
          .explanation {
            background: #252526;
            padding: 20px;
            border-radius: 6px;
            margin-bottom: 24px;
            border: 1px solid #3c3c3c;
          }
          .explanation h3 {
            margin-top: 0;
            color: #ffffff;
            font-size: 1.1em;
            margin-bottom: 16px;
          }
          .explanation ul {
            margin: 10px 0;
            padding-left: 20px;
            color: #d4d4d4;
          }
          .explanation li {
            margin: 8px 0;
            line-height: 1.5;
          }
          .explanation strong {
            color: #569cd6;
          }
          .explanation ul ul {
            margin-top: 8px;
            margin-bottom: 8px;
          }
          .explanation ul ul li {
            color: #9cdcfe;
            margin: 4px 0;
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
