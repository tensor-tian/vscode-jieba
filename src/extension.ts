import * as vscode from "vscode";

import {
  backwardKillWord,
  backwardWord,
  forwardWord,
  killWord,
  selectWord,
  selectWordForward,
} from "./command";

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand("jieba.forwardWord", forwardWord)
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("jieba.backwardWord", backwardWord)
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("jieba.killWord", killWord)
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("jieba.backwardKillWord", backwardKillWord)
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("jieba.selectWord", selectWord)
  );
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "jieba.selectWordForward",
      selectWordForward
    )
  );
}

// This method is called when your extension is deactivated
export function deactivate() {}
