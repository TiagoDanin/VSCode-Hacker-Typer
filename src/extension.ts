"use strict";

import * as vscode from "vscode";
import Storage from "./storage";
import Recorder from "./Recorder";
import * as replay from "./replay";
import { onSelectMacro } from "./replay";

export function activate(context: vscode.ExtensionContext) {
  console.log(
    'Congratulations, your extension "vscode-hacker-typer" is now active!'
  );

  const onCommandRecord = vscode.commands.registerCommand(
    "tiagodanin.vscode-hacker-typer.recordMacro",
    Recorder.register(context)
  );

  const onCommandPlay = vscode.commands.registerCommand(
    "tiagodanin.vscode-hacker-typer.playMacro",
    () => {
      replay.start(context);
    }
  );

  const onCommandRemove = vscode.commands.registerCommand(
    "tiagodanin.vscode-hacker-typer.removeMacro",
    () => {
      const storage = Storage.getInstance(context);
      const items = storage.list();
      vscode.window.showQuickPick(items.map(item => item.name)).then(picked => {
        if (!picked) {
          return;
        }

        storage.remove(picked);
        vscode.window.showInformationMessage(`Removed "${picked}"`);
      });
    }
  );

  const onCommandType = vscode.commands.registerCommand("type", replay.onType);

  const onCommandBackspace = vscode.commands.registerCommand(
    "tiagodanin.vscode-hacker-typer.backspace",
    replay.onBackspace
  );

  const onOpenFile = vscode.workspace.onDidOpenTextDocument((file) => {
    console.log('file', file)
    vscode.window.showInformationMessage(`File open: ${file}` );
    const currentFileName = file.fileName
    const storage = Storage.getInstance(context);
    const items = storage.list();
    const macroToFile = items.find(item => item.name === currentFileName);
    if (macroToFile) {
      const macro = storage.getByName(macroToFile.name);
      onSelectMacro(macro)
    }
  })

  context.subscriptions.push(onCommandRecord, onCommandPlay, onCommandType, onCommandBackspace, onCommandRemove, onOpenFile);
}

export function deactivate() {}
