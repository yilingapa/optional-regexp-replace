import * as vscode from 'vscode'
import * as fs from 'fs'
import * as os from 'os'


type PosItem = {
  row: number
  col: number
  strLength: number
  matchStr: string
}

export const Utils = {
  showError(text: string) {
    vscode.window.showErrorMessage(text)
  },
  showInfo(text: string) {
    vscode.window.showInformationMessage(text)
  }
}

export class FileHandler {
  editor: vscode.TextEditor | undefined = undefined
  document: vscode.TextDocument | undefined = undefined
  currentDecoration: vscode.TextEditorDecorationType | undefined = undefined
  currentLineDecoration: vscode.TextEditorDecorationType | undefined = undefined
  matchedPositions: { start: vscode.Position, end: vscode.Position, matchedStr: string }[] = []
  currentSelectedIndex: number = 0
  ignoreCase: boolean = false
  currentHighlightColor: string | undefined = undefined
  clearOnChangeEditor: vscode.Disposable | undefined = undefined
  clearOnChangeDoc: vscode.Disposable | undefined = undefined

  getFile = (uri?: string) => {
    try {
      this.editor = vscode.window.activeTextEditor ?? vscode.window.visibleTextEditors[0]
      if (!uri) {
        this.document = this.editor?.document
      }
      if (!this.document) {
        throw '无打开的文件'
      }
      this.clearOnChangeEditor = vscode.window.onDidChangeActiveTextEditor(editor => {
        if (editor !== this.editor) {
          this.clearStatus()
        }
      })
      this.clearOnChangeDoc = vscode.workspace.onDidChangeTextDocument(e => {
        if (this.matchedPositions.length === 0) {
          this.clearStatus()
        }
      })
      return this.document.getText()
    } catch (e) {
      Utils.showError(e)
      return undefined
    }
  }
  select = ({ start, end }: { start: vscode.Position, end: vscode.Position }) => {
    if (this.editor) {
      this.editor.selections = [new vscode.Selection(start, end)]
      const range = new vscode.Range(start, end)
      this.editor.revealRange(range)

      this.currentLineDecoration?.dispose()
      this.currentLineDecoration = vscode.window.createTextEditorDecorationType({
        backgroundColor: `rgba(100,100,100,0.3)`,
        isWholeLine: true,
        border: `1px solid #ececec`,
        borderWidth: '0.5'
      })
      this.editor.setDecorations(this.currentLineDecoration, [range])
    }
  }
  selectNext = () => {
    this.currentSelectedIndex += 1
    if (this.currentSelectedIndex === this.matchedPositions.length) {
      this.currentSelectedIndex = 0
    }
    this.select(this.matchedPositions[this.currentSelectedIndex])
    return this.matchedPositions[this.currentSelectedIndex].end.line
  }
  selectPrevious = () => {
    this.currentSelectedIndex -= 1
    if (this.currentSelectedIndex < 0) {
      this.currentSelectedIndex = this.matchedPositions.length - 1
    }
    this.select(this.matchedPositions[this.currentSelectedIndex])
    return this.matchedPositions[this.currentSelectedIndex].end.line
  }
  clearStatus = () => {
    this.currentDecoration?.dispose()
    this.currentLineDecoration?.dispose()
    this.clearOnChangeEditor?.dispose()
    this.clearOnChangeDoc?.dispose()
    this.matchedPositions = []
    this.currentSelectedIndex = 0
  }
  refreshDecoration = (color: string, ranges: vscode.Range[]) => {
    this.currentDecoration?.dispose()
    this.currentDecoration = vscode.window.createTextEditorDecorationType({
      backgroundColor: color,
      border: `1px solid #ececec`
    })
    this.editor?.setDecorations(this.currentDecoration, ranges)
  }
  highLightString = (fileString: string, match: string, color: string) => {
    if (this.editor) {
      const pos: PosItem[] = []
      const rows = fileString.split(os.EOL)
      let matchStr: RegExpExecArray | null = null
      const matchRegexp = new RegExp(match, this.ignoreCase ? 'ig' : 'g')
      rows.forEach((colStr, index) => {
        while (matchStr = matchRegexp.exec(colStr)) {
          pos.push({
            row: index,
            col: matchRegexp.lastIndex - matchStr[0].length,
            strLength: matchStr[0].length,
            matchStr: matchStr[0]
          })
        }
      })
      if (!pos.length) return 0
      this.currentHighlightColor = color
      this.matchedPositions = []
      const ranges = pos.map((item) => {
        const start = new vscode.Position(item.row, item.col)
        const end = new vscode.Position(item.row, item.col + item.strLength)
        this.matchedPositions.push({
          start,
          end,
          matchedStr: item.matchStr
        })
        return new vscode.Range(start, end)
      })
      if (this.matchedPositions[0]) {
        this.currentSelectedIndex = 0
        this.select(this.matchedPositions[0])
      }
      this.refreshDecoration(this.currentHighlightColor, ranges)
      return pos.length
    }
  }
  resetHighlightColor = (color: string) => {
    if (this.editor) {
      this.currentDecoration?.dispose()
      this.currentDecoration = vscode.window.createTextEditorDecorationType({
        backgroundColor: color,
        border: `1px solid #ececec`
      })
      this.editor?.setDecorations(this.currentDecoration, this.matchedPositions.map(i => {
        return new vscode.Range(i.start, i.end)
      }))
    }
  }
  editSelected = (match: string, regexp: string) => {
    const selected = this.matchedPositions[this.currentSelectedIndex]
    if (selected) {
      const to = selected.matchedStr.replace(new RegExp(match, this.ignoreCase ? 'ig' : 'g'), regexp)
      this.editor?.edit(editCommand => {
        editCommand.replace(new vscode.Range(selected.start, selected.end), to)
      })
      this.matchedPositions.splice(this.currentSelectedIndex, 1)
      this.currentSelectedIndex -= 1
      this.refreshDecoration(this.currentHighlightColor!, this.matchedPositions.map(i => {
        return new vscode.Range(i.start, i.end)
      }))
      this.selectNext()
    }
  }
}