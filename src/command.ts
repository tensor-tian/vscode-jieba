import * as path from "path";
import * as vscode from "vscode";

import { Token, parseAllSelections, parseLine } from "./parse";

export function forwardWord() {
  const editor = vscode.window.activeTextEditor;
  if (editor === undefined) {
    return;
  }
  const { newSelections: newSelections } = searchForward();
  editor.selections = newSelections;
}

export function backwardWord() {
  const editor = vscode.window.activeTextEditor;
  if (editor === undefined) {
    return;
  }
  const { newSelections: newSelections } = searchBackward();
  editor.selections = newSelections;
}

export async function killWord() {
  const editor = vscode.window.activeTextEditor;
  if (editor === undefined) {
    return;
  }
  const clipboard = vscode.env.clipboard;
  const document = editor.document;

  const { newSelections, rangesToDelete } = searchForward();

  for (const range of rangesToDelete) {
    const textToCut = document.getText(range);
    clipboard.writeText(textToCut);
    break;
  }
  editor.selections = newSelections;
  await editor.edit((edit) => {
    for (const range of rangesToDelete) {
      edit.delete(range);
    }
  });
}

export async function backwardKillWord() {
  const editor = vscode.window.activeTextEditor;
  if (editor === undefined) {
    return;
  }
  const clipboard = vscode.env.clipboard;
  const document = editor.document;

  const { newSelections, rangesToDelete } = searchBackward();

  for (const range of rangesToDelete) {
    const textToCut = document.getText(range);
    clipboard.writeText(textToCut);
    break;
  }
  editor.selections = newSelections;
  await editor.edit((edit) => {
    for (const range of rangesToDelete) {
      edit.delete(range);
    }
  });
}

export function selectWord() {
  const editor = vscode.window.activeTextEditor;
  if (editor === undefined) {
    return;
  }

  const tokensBySelections = parseAllSelections();

  const newSelections: vscode.Selection[] = [];

  for (const [selection, tokens] of tokensBySelections) {
    const start = selection.start;
    const lineNum = start.line;
    const charNum = start.character;

    for (const token of tokens) {
      if (token.start <= charNum && token.end > charNum) {
        const wordStart = new vscode.Position(lineNum, token.start);
        const wordEnd = new vscode.Position(lineNum, token.end);
        newSelections.push(new vscode.Selection(wordStart, wordEnd));
        break;
      }
    }
  }

  editor.selections = newSelections;
}
export function selectWordForward() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return;
  }
  const document = vscode.window.activeTextEditor!.document;

  const { anchor, active } = editor.selection;
  const lineNum = active.line;
  const line = document.lineAt(lineNum);
  const isMarkdown = vscode.window
    .activeTextEditor!.document.fileName.toLowerCase()
    .endsWith(".md");
  const cursor =
    !isMarkdown && active.character > 0
      ? active.character - 1
      : active.character;

  // line end
  if (active.isEqual(line.range.end)) {
    const nextLineStart = new vscode.Position(active.line + 1, 0);
    editor.selection = new vscode.Selection(anchor, nextLineStart);
    return;
  }

  const tokens = parseLine(lineNum);
  console.log(tokens.map((t) => t.word).join("|"));
  let idx = tokens.findIndex((token) =>
    isMarkdown
      ? cursor === 0 || (token.start < cursor && token.end >= cursor)
      : token.start <= cursor && token.end > cursor
  );
  // console.log("found", idx, cursor, tokens[idx]);
  if (idx === -1) {
    return;
  }
  const moveAnchor =
    isMarkdown &&
    anchor.line === lineNum &&
    anchor.character > tokens[idx].start;
  const start = moveAnchor
    ? new vscode.Position(lineNum, tokens[idx].start)
    : anchor;

  // move forward
  if (!isMarkdown || (tokens[idx].end === cursor && !moveAnchor)) {
    idx++;
  }

  // skip whitespace tokens
  while (idx < tokens.length && isWhiteSpace(tokens[idx].word)) {
    idx++;
  }
  // console.log(idx, tokens[idx]);
  // move to next line
  if (idx === tokens.length) {
    const nextLineStart = new vscode.Position(active.line + 1, 0);
    editor.selection = new vscode.Selection(anchor, nextLineStart);
    return;
  }
  const end = new vscode.Position(
    lineNum,
    isMarkdown ? tokens[idx].end : tokens[idx].start + 1
  );
  editor.selection = new vscode.Selection(start, end);
}

export function selectWordBackward() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return;
  }
  const document = vscode.window.activeTextEditor!.document;

  const primarySelection = editor.selections[0];
  const cursor = primarySelection.active;
  const line = document.lineAt(cursor.line);
  if (primarySelection.active.isEqual(line.range.start)) {
  }
}

function searchForward(): {
  newSelections: vscode.Selection[];
  rangesToDelete: vscode.Range[];
} {
  const document = vscode.window.activeTextEditor!.document;
  const tokensBySelections = parseAllSelections();

  const newSelections: vscode.Selection[] = [];
  const rangesToDelete: vscode.Range[] = [];

  for (const [selection, tokens] of tokensBySelections) {
    let cursor = selection.start;
    const line = document.lineAt(cursor.line);

    /*
     * if the cursor is not at the end of the line
     * and the character after is whitespace,
     * then mark range(cursor, next non-whitespace) for deletion
     * and move the cursor to the next non-whitespace character,
     * then continue the process of moving forward.
     */
    if (
      cursor.character !== line.range.end.character &&
      isWhiteSpace(line.text[cursor.character])
    ) {
      const nonSpacePos = findFirstNonSpace(line.text.slice(cursor.character));
      const nextPos =
        nonSpacePos === -1
          ? line.range.end.character
          : cursor.character + nonSpacePos;
      const nextNonSpace = new vscode.Position(cursor.line, nextPos);
      rangesToDelete.push(new vscode.Range(cursor, nextNonSpace));
      cursor = nextNonSpace;
    }

    /*
     * if the cursor is at the end of the line
     * and the next line exists,
     * then jump to the beginning of the next line.
     */
    if (
      cursor.isEqual(line.range.end) &&
      document.lineCount > cursor.line + 1
    ) {
      const nextLineStart = new vscode.Position(cursor.line + 1, 0);
      newSelections.push(new vscode.Selection(nextLineStart, nextLineStart));
      continue;
    }

    /*
     * jump to the end of the word
     * and mark range(cursor, end of the word + 1) for deletion.
     */
    for (const token of tokens) {
      if (token.start <= cursor.character && token.end > cursor.character) {
        const wordEnd = new vscode.Position(cursor.line, token.end);
        rangesToDelete.push(new vscode.Range(cursor, wordEnd));
        newSelections.push(new vscode.Selection(wordEnd, wordEnd));
        break;
      }
    }
  }

  return { newSelections, rangesToDelete };
}

function searchBackward(): {
  newSelections: vscode.Selection[];
  rangesToDelete: vscode.Range[];
} {
  const document = vscode.window.activeTextEditor!.document;

  const tokensBySelections = parseAllSelections();

  const newSelections: vscode.Selection[] = [];
  const rangesToDelete: vscode.Range[] = [];

  for (const [selection, tokens] of tokensBySelections) {
    let cursor = selection.start;
    const line = document.lineAt(cursor.line);

    /*
     * if the cursor is not at the beginning of the line,
     * and the character before is whitespace,
     * then mark range(last non-whitespace + 1, cursor) for deletion
     * and move cursor to (last non-whitespace + 1) before it,
     * then continue the process of moving backward.
     */
    if (
      cursor.character !== 0 &&
      isWhiteSpace(line.text[cursor.character - 1])
    ) {
      const nonSpacePos = findLastNonSpace(
        line.text.slice(0, cursor.character)
      );
      const nextPos = nonSpacePos === -1 ? 0 : nonSpacePos;
      const whitespaceStart = new vscode.Position(cursor.line, nextPos + 1);
      rangesToDelete.push(new vscode.Range(whitespaceStart, cursor));
      cursor = whitespaceStart;
    }

    /*
     * if the cursor is at the beginning of the line,
     * and the previous line exists,
     * jump to the end of the previous line.
     */
    if (cursor.character === 0 && cursor.line > 0) {
      const prevLineEnd = document.lineAt(cursor.line - 1).range.end;
      newSelections.push(new vscode.Selection(prevLineEnd, prevLineEnd));
      continue;
    }

    /*
     * jump to the beginning of the word
     * and mark range(the beginning of the word, cursor) for deletion
     */
    for (const token of tokens) {
      if (token.start < cursor.character && token.end >= cursor.character) {
        const wordStart = new vscode.Position(cursor.line, token.start);
        rangesToDelete.push(new vscode.Range(wordStart, cursor));
        newSelections.push(new vscode.Selection(wordStart, wordStart));
        break;
      }
    }
  }

  return { newSelections, rangesToDelete };
}

function findFirstNonSpace(text: string): number {
  return text.search(/[^\s]/);
}

function findLastNonSpace(text: string): number {
  const match = text.match(/(^.*)([^\s])\s*$/);
  if (match === null) {
    return -1;
  }
  return match[1].length + match[2].length - 1;
}

function isWhiteSpace(c: string): boolean {
  return /^[\s]$/.test(c);
}
