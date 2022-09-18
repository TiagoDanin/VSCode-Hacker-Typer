import * as vscode from "vscode";
import * as Cache from "vscode-cache";
import { Buffer } from "./buffers";
import { SerializedBuffer, rehydrateBuffer } from "./rehydrate";

const LISTINGS = "HackerTyper:Listings";
const MACROS = "HackerTyper:Macros";

type Metadata = {
  name: string;
  description: string;
};

export type Macro = Metadata & {
  buffers: Buffer[];
};

export default class Storage {
  private static _instance: Storage | undefined;
  public static getInstance(context: vscode.ExtensionContext) {
    if (Storage._instance) {
      return Storage._instance;
    }

    return (Storage._instance = new Storage(context));
  }

  private _listings: Cache<Metadata>;
  private _macros: Cache<SerializedBuffer[]>;

  private constructor(context: vscode.ExtensionContext) {
    this._listings = new Cache(context, LISTINGS);
    this._macros = new Cache(context, MACROS);
  }

  public list(): Metadata[] {
    const listings = this._listings.all();
    return Object.keys(listings).map(key => listings[key]);
  }

  public getByName(name: string): Macro {
    const listing = this._listings.get(name);
    const buffers = this._macros.get(name);
    return {
      ...listing,
      buffers: buffers.map(rehydrateBuffer)
    };
  }

  public save(macro: Macro): Promise<Macro> {
    const { buffers, ...metadata } = macro;
    const operations = [
      this._listings.put(macro.name, metadata),
      this._macros.put(macro.name, JSON.parse(JSON.stringify(buffers)))
    ];

    return Promise.all(operations).then(() => {
      return macro;
    });
  }

  public remove(name: string): void {
    this._listings.forget(name);
    this._macros.forget(name);
  }
}
