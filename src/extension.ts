import * as vscode from 'vscode';
import * as path from 'path'
import * as fs from 'fs'
import { FileHandler } from './utils'
import { secretsKey, uniqueUIDForSyncStoreCommand } from '../views/const'

export function activate(context: vscode.ExtensionContext) {
  let currentPanel: vscode.WebviewPanel | undefined = undefined;
  let currentFile: FileHandler | undefined = undefined

  context.subscriptions.push(
    vscode.commands.registerCommand('optional.regexp.replace', () => {
      const columnToShowIn = vscode.window.activeTextEditor
        ? vscode.ViewColumn.Two
        : undefined;

      if (currentPanel) {
        currentPanel.reveal(columnToShowIn);
      } else {
        currentPanel = vscode.window.createWebviewPanel(
          'testWebview',
          'Optional Regexp Replace',
          columnToShowIn!,
          {
            enableScripts: true,
            retainContextWhenHidden: true,
          }
        );
        const htmlPath = path.join(context.extensionPath, './dist/index.html')
        const htmlFile = fs.readFileSync(htmlPath, 'utf-8').toString()
        const sourceToLocal = htmlFile.replace(
          /(<link.+?href="|<script.+?src=")(.+?)"/g, (m, $1, $2) => {
            return $1 + currentPanel!.webview.asWebviewUri(vscode.Uri.file(path.resolve(path.dirname(htmlPath), $2))) + '"';
          })
        currentPanel.webview.html = sourceToLocal;

        setTimeout(() => {
          if (currentPanel) {
            context.secrets.get(secretsKey).then(res => {
              if (res) {
                currentPanel!.webview.postMessage({
                  command: uniqueUIDForSyncStoreCommand,
                  payload: res
                })
              }
            })
          }
        }, 1000)


        const prepareCurrentFile = () => {
          if (!currentFile) {
            currentFile = new FileHandler()
          }
        }

        currentPanel.webview.onDidReceiveMessage(message => {
          if (currentPanel !== undefined) {
            switch (message.command) {
              case 'setCurrentMatch':
                {
                  prepareCurrentFile()
                  currentFile!.currentMatch = message.payload
                  currentPanel.webview.postMessage({
                    command: 'vscodeCB',
                    payload: {
                      data: null,
                      cbUID: message.cbUID
                    }
                  })
                }
                break
              case 'setCurrentHighlightColor':
                {
                  prepareCurrentFile()
                  currentFile!.currentHighlightColor = message.payload
                  currentPanel.webview.postMessage({
                    command: 'vscodeCB',
                    payload: {
                      data: null,
                      cbUID: message.cbUID
                    }
                  })
                }
                break
              case 'searchAllAndHightLight':
                {
                  prepareCurrentFile()
                  currentFile!.clearStatus()
                  if (currentFile!.currentFileStr = currentFile!.getFile()) {
                    const num = currentFile!.highLightString()
                    currentPanel.webview.postMessage({
                      command: 'vscodeCB',
                      payload: {
                        data: num,
                        cbUID: message.cbUID
                      }
                    })
                  }
                }
                break
              case 'saveOptionsToContext':
                {
                  context.secrets.store(secretsKey, JSON.stringify(message.payload))
                }
                break
              case 'setHighlightColor':
                {
                  currentFile?.resetHighlightColor()
                  currentPanel.webview.postMessage({
                    command: 'vscodeCB',
                    payload: {
                      data: undefined,
                      cbUID: message.cbUID
                    }
                  })
                }
                break
              case 'setPrevious':
                {
                  const line = currentFile?.selectPrevious()
                  currentPanel.webview.postMessage({
                    command: 'vscodeCB',
                    payload: {
                      data: line === undefined ? 0 : line + 1,
                      cbUID: message.cbUID
                    }
                  })
                }
                break
              case 'setNext':
                {
                  const line = currentFile?.selectNext()
                  currentPanel.webview.postMessage({
                    command: 'vscodeCB',
                    payload: {
                      data: line === undefined ? 0 : line + 1,
                      cbUID: message.cbUID
                    }
                  })
                }
                break
              case 'clearStatus':
                currentFile?.clearStatus()
                currentPanel.webview.postMessage({
                  command: 'vscodeCB',
                  payload: {
                    data: null,
                    cbUID: message.cbUID
                  }
                })
                break
              case 'ignoreCase':
                {
                  if (currentFile !== undefined) {
                    currentFile.ignoreCase = message.payload.checked
                    currentFile.highLightString()
                    currentPanel.webview.postMessage({
                      command: 'vscodeCB',
                      payload: {
                        data: null,
                        cbUID: message.cbUID
                      }
                    })
                  }
                }
                break
              case 'editSelected':
                {
                  currentFile?.editSelected(message.payload.to).then(res => {
                    if (res) {
                      currentPanel?.webview.postMessage({
                        command: 'vscodeCB',
                        payload: {
                          data: res,
                          cbUID: message.cbUID
                        }
                      })
                    }
                  })
                }
                break
              case 'editAllSelected':
                {
                  currentFile?.editAllSelected(message.payload.to).then(res => {
                    if (res) {
                      currentPanel?.webview.postMessage({
                        command: 'vscodeCB',
                        payload: {
                          data: res,
                          cbUID: message.cbUID
                        }
                      })
                    }
                  })
                }
                break
            }
          }
        })

        currentPanel.onDidDispose(
          () => {
            currentFile?.clearStatus()
            currentFile = undefined
            currentPanel = undefined
          },
          null,
          context.subscriptions
        );
      }
    })
  );

}

export function deactivate() { }
