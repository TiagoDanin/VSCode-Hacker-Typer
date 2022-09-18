"use strict";

import * as vscode from "vscode";
import Storage from "./storage";
import Recorder from "./Recorder";
import * as replay from "./replay";
import { onSelectMacro } from "./replay";

export function activate(context: vscode.ExtensionContext) {
  const onCommandRecord = vscode.commands.registerCommand(
    "com.tiagodanin.vscode-hacker-typer.recordMacro",
    Recorder.register(context)
  );
  context.subscriptions.push(onCommandRecord);

  const onCommandPlay = vscode.commands.registerCommand(
    "com.tiagodanin.vscode-hacker-typer.playMacro",
    () => {
      replay.start(context);
    }
  );
  context.subscriptions.push(onCommandPlay);

  const onCommandRemove = vscode.commands.registerCommand(
    "com.tiagodanin.vscode-hacker-typer.removeMacro",
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
  context.subscriptions.push(onCommandRemove);

  const onCommandType = vscode.commands.registerCommand("type", replay.onType);
  context.subscriptions.push(onCommandType);

  const onCommandBackspace = vscode.commands.registerCommand(
    "com.tiagodanin.vscode-hacker-typer.backspace",
    replay.onBackspace
  );
  context.subscriptions.push(onCommandBackspace);

  const onCommandExitMacro = vscode.commands.registerCommand(
    "jevakallio.vscode-hacker-typer.exitMacro",
    () => {
      replay.stopMacro();
    }
  )
  context.subscriptions.push(onCommandExitMacro);

  const onCommandExport = vscode.commands.registerCommand(
    "com.tiagodanin.vscode-hacker-typer.exportMacro",
    () => {
      const storage = Storage.getInstance(context);
      const items = storage.list();
      vscode.window.showQuickPick(items.map(item => item.name)).then(picked => {
        if (!picked) {
          return;
        }

        const options: vscode.SaveDialogOptions = {
          saveLabel: 'Export',
          filters: {
            JSON: ['json']
          }
        };

        vscode.window.showSaveDialog(options).then((location: vscode.Uri | undefined) => {
          if (location === undefined) { return; }

          storage.export(picked, location, (error) => {
            if (error) {
              vscode.window.showErrorMessage(`Error exporting ${picked}`);
              console.log(error);
              return;
            }

            vscode.window.showInformationMessage(`Exported "${picked}"`);
          });
        });

      });
    }
  );
  context.subscriptions.push(onCommandExport);

  const onCommandImport = vscode.commands.registerCommand(
    "com.tiagodanin.vscode-hacker-typer.importMacro",
    () => {
      const storage = Storage.getInstance(context);

      const options: vscode.OpenDialogOptions = {
        canSelectMany: true,
        openLabel: 'Import',
        filters: {
          JSON: ['json']
        }
      };

      vscode.window.showOpenDialog(options).then((files: vscode.Uri[] | undefined) => {
        if (files === undefined) {
          return;
        }

        for (let i = 0; i < files.length; i++) {
          storage.import(files[i], (error) => {
            if (error) {
              vscode.window.showErrorMessage(`Error importing ${files[i].fsPath}`);
              console.log(error);
              return;
            }

            vscode.window.showInformationMessage(`Imported "${files[i].fsPath}"`);
          });
        }
      });
    }
  );
  context.subscriptions.push(onCommandImport);

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
  context.subscriptions.push(onOpenFile);
}

export function deactivate() {}
