import * as vscode from "vscode";
import * as buffers from "./buffers";
import Storage from "./storage";

export default class Recorder {
  private _disposable: vscode.Disposable;
  private _textEditor: vscode.TextEditor | undefined;
  private _buffers = 0;
  private _currentChanges: vscode.TextDocumentContentChangeEvent[] = [];
  private _storage: Storage;

  public static register(context: vscode.ExtensionContext) {
    return () => {
      buffers.clear();

      vscode.window.showInformationMessage("Hacker aaaa Typer is now recording!");
      const recorder = new Recorder(Storage.getInstance(context));
      context.subscriptions.push(recorder);
    };
  }

  constructor(storage: Storage) {
    this._storage = storage;

    let subscriptions: vscode.Disposable[] = [];

    vscode.workspace.onDidChangeTextDocument(
      this.onDidChangeTextDocument,
      this,
      subscriptions
    );

    vscode.window.onDidChangeTextEditorSelection(
      this.onDidChangeTextEditorSelection,
      this,
      subscriptions
    );

    const insertNamedStop = vscode.commands.registerCommand(
      "tiagodanin.vscode-hacker-typer.insertNamedStop",
      this.insertNamedStop,
      this
    );

    const insertStop = vscode.commands.registerCommand(
      "tiagodanin.vscode-hacker-typer.insertStop",
      () => {
        this.insertStop(null);
      }
    );

    const save = vscode.commands.registerCommand(
      "tiagodanin.vscode-hacker-typer.saveMacro",
      () => {
        this.saveRecording(save);
      }
    );

    this._textEditor = vscode.window.activeTextEditor;
    this._disposable = vscode.Disposable.from(
      ...subscriptions,
      insertNamedStop,
      insertStop,
      save
    );

    if (this._textEditor) {
      this.insertStartingPoint(this._textEditor);
    }
  }

  private insertStartingPoint(textEditor: vscode.TextEditor) {
    const content = textEditor.document.getText();
    const selections = textEditor.selections;
    const language = textEditor.document.languageId;

    buffers.insert({
      position: this._buffers++,
      content,
      language,
      selections
    });
  }

  private insertNamedStop() {
    vscode.window
      .showInputBox({
        prompt: "What do you want to call your stop point?",
        placeHolder: "Type a name or ENTER for unnamed stop point"
      })
      .then(name => {
        this.insertStop(name || null);
      });
  }

  private insertStop(name: string | null) {
    buffers.insert({
      stop: {
        name: name || null
      },
      position: this._buffers++
    });
  }

  private saveRecording(command: vscode.Disposable) {
    vscode.window
      .showInputBox({
        prompt: "Give this thing a name",
        placeHolder: "cool-macro"
      })
      .then(name => {
        if (name) {
          return this._storage
            .save({
              name,
              description: "",
              buffers: buffers.all()
            })
            .then(macro => {
              vscode.window.showInformationMessage(
                `Saved ${macro.buffers.length} buffers under "${macro.name}".`
              );
              this.dispose();
              command.dispose();
            });
        }
      });
  }

  private onDidChangeTextDocument(e: vscode.TextDocumentChangeEvent) {
    this._currentChanges = e.contentChanges;
  }

  private onDidChangeTextEditorSelection(
    e: vscode.TextEditorSelectionChangeEvent
  ) {
    if (e.textEditor !== this._textEditor) {
      return;
    }

    const changes = this._currentChanges;
    const selections = e.selections || [];
    this._currentChanges = [];

    buffers.insert({
      changes,
      selections,
      position: this._buffers++
    });
  }

  dispose() {
    if (this._disposable) {
      this._disposable.dispose();
    }
  }
}
