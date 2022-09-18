import * as vscode from "vscode";
import * as buffers from "./buffers";
import Storage, { Macro } from "./storage";
import * as Queue from "promise-queue";

const stopPointBreakChar = `\n`;
const replayConcurrency = 1;
const replayQueueMaxSize = Number.MAX_SAFE_INTEGER;
const replayQueue = new Queue(replayConcurrency, replayQueueMaxSize);

let isEnabled = false;
let currentBuffer: buffers.Buffer | undefined;

export function start(context: vscode.ExtensionContext) {
  const storage = Storage.getInstance(context);
  const items = storage.list();
  vscode.window.showQuickPick(items.map(item => item.name)).then(picked => {
    if (!picked) {
      return;
    }

    const macro = storage.getByName(picked);
    onSelectMacro(macro)
  });
}

export function onSelectMacro(macro: Macro) {
  buffers.inject(macro.buffers);

  currentBuffer = buffers.get(0);
  if (!currentBuffer) {
    vscode.window.showErrorMessage("No active recording");
    return;
  }

  const textEditor = vscode.window.activeTextEditor;
  if (buffers.isStartingPoint(currentBuffer)) {
    setStartingPoint(currentBuffer, textEditor);
  }

  isEnabled = true;
  vscode.window.showInformationMessage(
    `Now playing ${buffers.count()} buffers from ${macro.name}!`
  );
}

async function setStartingPoint(
  startingPoint: buffers.StartingPoint,
  textEditor: vscode.TextEditor | undefined
) {
  let editor = textEditor;
  if (!editor) {
    vscode.window.showInformationMessage("opening new window");
    const document = await vscode.workspace.openTextDocument({
      language: startingPoint.language,
      content: startingPoint.content
    });

    editor = await vscode.window.showTextDocument(document);
  } else {
    const existingEditor = editor;
    await existingEditor.edit(edit => {
      const l = existingEditor.document.lineCount;
      const range = new vscode.Range(
        new vscode.Position(0, 0),
        new vscode.Position(
          l,
          Math.max(
            0,
            existingEditor.document.lineAt(Math.max(0, l - 1)).text.length - 1
          )
        )
      );

      edit.delete(range);
      edit.insert(new vscode.Position(0, 0), startingPoint.content);
    });
  }

  if (editor) {
    updateSelections(startingPoint.selections, editor);
  }

  currentBuffer = buffers.get(startingPoint.position + 1);
}

export function disable() {
  isEnabled = false;
  currentBuffer = undefined;
}

export function onType({ text }: { text: string }) {
  if (isEnabled) {
    replayQueue.add(
      () =>
        new Promise((resolve, reject) => {
          try {
            advanceBuffer(resolve, text);
          } catch (e) {
            console.log(e);
            reject(e);
          }
        })
    );
  } else {
    vscode.commands.executeCommand("default:type", { text });
  }
}

export function onBackspace() {
  if (isEnabled && currentBuffer && currentBuffer.position > 0) {
    currentBuffer = buffers.get(currentBuffer.position - 1);
  }

  vscode.commands.executeCommand("deleteLeft");
}

export function stopMacro() {
  isEnabled = false;
  vscode.window.showInformationMessage(
    `Macro is stopped`
  );
}

function updateSelections(
  selections: vscode.Selection[],
  editor: vscode.TextEditor
) {
  editor.selections = selections;

  const { start, end } = editor.selections[0];
  editor.revealRange(
    new vscode.Range(start, end),
    vscode.TextEditorRevealType.InCenterIfOutsideViewport
  );
}

function advanceBuffer(done: () => void, userInput: string) {
  const editor = vscode.window.activeTextEditor;
  const buffer = currentBuffer;

  if (!editor) {
    vscode.window.showErrorMessage("No active editor");
    return;
  }

  if (!buffer) {
    vscode.window.showErrorMessage("No buffer to advance");
    return;
  }

  if (buffers.isStopPoint(buffer)) {
    if (userInput === stopPointBreakChar) {
      currentBuffer = buffers.get(buffer.position + 1);
    }

    return done();
  }

  const { changes, selections } = <buffers.Frame>buffer;

  const updateSelectionAndAdvanceToNextBuffer = () => {
    if (selections.length) {
      updateSelections(selections, editor);
    }

    currentBuffer = buffers.get(buffer.position + 1);

    if (!currentBuffer) {
      disable();
    }

    done();
  };

  if (changes && changes.length > 0) {
    editor
      .edit(edit => applyContentChanges(changes, edit))
      .then(updateSelectionAndAdvanceToNextBuffer);
  } else {
    updateSelectionAndAdvanceToNextBuffer();
  }
}

function applyContentChanges(
  changes: vscode.TextDocumentContentChangeEvent[],
  edit: vscode.TextEditorEdit
) {
  changes.forEach(change => applyContentChange(change, edit));
}

function applyContentChange(
  change: vscode.TextDocumentContentChangeEvent,
  edit: vscode.TextEditorEdit
) {
  if (change.text === "") {
    edit.delete(change.range);
  } else if (change.rangeLength === 0) {
    edit.insert(change.range.start, change.text);
  } else {
    edit.replace(change.range, change.text);
  }
}

