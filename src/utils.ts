import * as vscode from 'vscode'
import * as fs from 'fs'
import * as os from 'os'
import { debounce } from 'lodash'


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
  editor?: vscode.TextEditor
  document?: vscode.TextDocument
  currentFileStr?: string
  currentDecoration?: vscode.TextEditorDecorationType
  currentLineDecoration?: vscode.TextEditorDecorationType
  matchedPositions: { start: vscode.Position, end: vscode.Position, matchedStr: string }[] = []
  currentSelectedIndex: number = 0
  ignoreCase: boolean = false
  currentMatch: string = ''
  currentHighlightColor?: string
  clearOnChangeSelectionListener?: vscode.Disposable
  clearOnChangeDocListener?: vscode.Disposable

  updateCurrentHighlightColor = (color: string) => {
    this.currentHighlightColor = color
  }

  updateCurrentMatch = (match: string) => {
    this.currentMatch = match
  }

  getFile = () => {
    try {
      this.editor = vscode.window.activeTextEditor ?? vscode.window.visibleTextEditors[0]
      this.document = this.editor?.document
      if (!this.document) {
        throw 'no opened file'
      }
      this.clearOnChangeSelectionListener = vscode.window.onDidChangeTextEditorSelection((e) => {
        if (e.textEditor === this.editor) {
          const selectionItemIndex = this.matchedPositions.findIndex(i => i.start.line === e.selections[0]?.start.line)
          if (selectionItemIndex > -1) {
            this.currentSelectedIndex = selectionItemIndex
            this.select({ ...this.matchedPositions[selectionItemIndex], ifSetSelection: false })
          }
        }
      })
      const memoDebounce = debounce(() => this.highLightString(false))
      this.clearOnChangeDocListener = vscode.workspace.onDidChangeTextDocument(e => {
        if (this.matchedPositions.length === 0) {
          this.clearStatus()
        } else {
          this.currentFileStr = this.document?.getText()
          memoDebounce()
        }
      })
      this.currentFileStr = this.document.getText()
      return this.currentFileStr
    } catch (e) {
      Utils.showError(e)
      return undefined
    }
  }

  select = ({ start, end, ifSetSelection = true }: { start: vscode.Position, end: vscode.Position, ifSetSelection?: boolean }) => {
    if (this.editor) {
      if (ifSetSelection) {
        this.editor.selections = [new vscode.Selection(start, end)]
      }
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
    this.clearOnChangeSelectionListener?.dispose()
    this.clearOnChangeDocListener?.dispose()
    this.matchedPositions = []
    this.currentSelectedIndex = 0
  }

  refreshDecoration = (ranges: vscode.Range[]) => {
    this.currentDecoration?.dispose()
    this.currentDecoration = vscode.window.createTextEditorDecorationType({
      backgroundColor: this.currentHighlightColor,
      border: `1px solid #ececec`
    })
    this.editor?.setDecorations(this.currentDecoration, ranges)
  }

  highLightString = (needSelection = true) => {
    if (this.editor) {
      const pos: PosItem[] = []
      const rows = this.currentFileStr?.split(os.EOL) ?? []
      let matchStr: RegExpExecArray | null = null
      const matchRegexp = new RegExp(this.currentMatch, this.ignoreCase ? 'ig' : 'g')
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
      if (needSelection) {
        if (this.matchedPositions[0]) {
          this.currentSelectedIndex = 0
          this.select(this.matchedPositions[0])
        }
      }
      this.refreshDecoration(ranges)
      return pos.length
    }
  }

  resetHighlightColor = () => {
    if (this.editor) {
      this.currentDecoration?.dispose()
      this.currentDecoration = vscode.window.createTextEditorDecorationType({
        backgroundColor: this.currentHighlightColor,
        border: `1px solid #ececec`
      })
      this.editor?.setDecorations(this.currentDecoration, this.matchedPositions.map(i => {
        return new vscode.Range(i.start, i.end)
      }))
    }
  }

  editSelected = async (regexp: string) => {
    const selected = this.matchedPositions[this.currentSelectedIndex]
    if (selected) {
      const to = selected.matchedStr.replace(new RegExp(this.currentMatch, this.ignoreCase ? 'ig' : 'g'), regexp)
      await this.editor?.edit(editCommand => {
        editCommand.replace(new vscode.Range(selected.start, selected.end), to)
      })
      this.matchedPositions.splice(this.currentSelectedIndex, 1)
      this.currentSelectedIndex -= 1
      this.selectNext()
      this.highLightString(false)
      return {
        line: selected.end.line,
        text: to
      }
    }
    return null
  }

  editAllSelected = async (regexp: string) => {
    const times = this.matchedPositions.length
    for (const selected of this.matchedPositions) {
      const to = selected.matchedStr.replace(new RegExp(this.currentMatch, this.ignoreCase ? 'ig' : 'g'), regexp)
      await this.editor?.edit(editCommand => {
        editCommand.replace(new vscode.Range(selected.start, selected.end), to)
      })
    }
    this.clearStatus()
    return {
      times,
      text: regexp
    }
  }
}