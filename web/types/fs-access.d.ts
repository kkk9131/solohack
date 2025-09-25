// 日本語メモ: File System Access API の型補完（Chrome系向け）。
// CI/ローカルの型解決で entries() が未定義になる環境を補助するための最小宣言。

export {};

declare global {
  interface FileSystemHandle {
    kind: 'file' | 'directory';
    name: string;
  }

  interface FileSystemFileHandle extends FileSystemHandle {
    kind: 'file';
    getFile(): Promise<File>;
    createWritable(options?: any): Promise<any>;
  }

  interface FileSystemDirectoryHandle extends FileSystemHandle {
    kind: 'directory';
    entries(): AsyncIterableIterator<[
      string,
      FileSystemFileHandle | FileSystemDirectoryHandle
    ]>;
  }
}
