import * as vscode from "vscode";

import { add_word, cut, tokenize } from "jieba-wasm";

export interface Token {
  word: string;
  start: number;
  end: number;
}

function init() {
  const jieba = vscode.workspace.getConfiguration("jieba");
  if (!jieba || !Array.isArray(jieba.words)) {
    return;
  }
  jieba.words.forEach((word) => add_word(word, 100));
}
init();

function parseSentence(sentence: string): Token[] {
  return tokenize(sentence, "default", true);
}

export function parseAllSelections(): Map<vscode.Selection, Token[]> {
  const editor = vscode.window.activeTextEditor!;
  const document = editor.document;
  const selections = editor.selections;

  const tokensBySelections = new Map<vscode.Selection, Token[]>();
  selections.map((s) => {
    const line = document.lineAt(s.start.line).text;
    tokensBySelections.set(s, parseSentence(line));
  });

  return tokensBySelections;
}

export function parseLine(lineNum: number): Token[] {
  const editor = vscode.window.activeTextEditor!;
  const document = editor.document;
  const line = document.lineAt(lineNum).text;
  return parseSentence(line);
}
