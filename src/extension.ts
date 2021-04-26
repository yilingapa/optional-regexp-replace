import * as vscode from 'vscode';
import * as path from 'path'
import * as fs from 'fs'
import { FileHandler } from './utils'
import { defaultHighlightColor, getColorStr, secretsKey, uniqueUIDForSyncStoreCommand } from '../views/const'

export function activate(context: vscode.ExtensionContext) {
  let currentPanel: vscode.WebviewPanel | undefined = undefined;
  let highlightColor = getColorStr(defaultHighlightColor.rgba)
  let currentFile: FileHandler | undefined = undefined
  let fileStr: string | undefined = undefined

  context.subscriptions.push(
    vscode.commands.registerCommand('optional.regexp.replace', () => {
      const columnToShowIn = vscode.window.activeTextEditor
        ? vscode.ViewColumn.Two
        : undefined;

      if (currentPanel) {
        // If we already have a panel, show it in the target column
        currentPanel.reveal(columnToShowIn);
      } else {
        // Otherwise, create a new panel
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
        }, 2000)

        currentPanel.webview.onDidReceiveMessage(message => {
          if (currentPanel !== undefined) {
            switch (message.command) {
              case 'searchAllAndHightLight':
                {
                  currentFile?.clearStatus()
                  currentFile = new FileHandler()
                  fileStr = currentFile.getFile()
                  if (fileStr !== undefined) {
                    const num = currentFile.highLightString(fileStr, message.payload, highlightColor)
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
                  highlightColor = message.payload
                  currentFile?.resetHighlightColor(highlightColor)
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
                  if (currentFile !== undefined && fileStr !== undefined) {
                    currentFile.ignoreCase = message.payload.checked
                    currentFile.highLightString(fileStr, message.payload.match, highlightColor)
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
                  const res = currentFile?.editSelected(message.payload.match, message.payload.to)
                  if (res) {
                    currentPanel.webview.postMessage({
                      command: 'vscodeCB',
                      payload: {
                        data: res,
                        cbUID: message.cbUID
                      }
                    })
                  }
                }
                break
              case 'editAllSelected':
                {
                  currentFile?.editAllSelected(message.payload.match, message.payload.to).then(res => {
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

        // Reset when the current panel is closed
        currentPanel.onDidDispose(
          () => {
            currentFile?.clearStatus()
            currentFile = undefined
            currentPanel = undefined
            fileStr = undefined
          },
          null,
          context.subscriptions
        );
      }
    })
  );

}

export function deactivate() { }
