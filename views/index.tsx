import React, { memo, PropsWithChildren, useCallback, useEffect, useMemo, useState } from 'react'
import ReactDom from 'react-dom'
import { ChromePicker, ColorResult } from 'react-color'
import { defaultHighlightColor, getColorStr, uniqueUIDForSyncStoreCommand } from './const'
import { debounce } from 'lodash';

const vscode = acquireVsCodeApi();

function vscodeBridge() {
  const callbacks: {
    [key: number]: (...arg: any[]) => void
  } = {}
  return {
    post: ({
      command,
      payload
    }: {
      command: string
      payload: any
    }, cb: (...arg: any[]) => void) => {
      const cbUID = new Date().getTime()
      callbacks[cbUID] = cb
      vscode.postMessage({
        command,
        payload,
        cbUID
      })
    },
    listen: (cbUID: number, data: any) => {
      callbacks[cbUID] && callbacks[cbUID](data)
      delete callbacks[cbUID]
    }
  }
}

const bridge = vscodeBridge()

window.addEventListener('message', (event: {
  data: {
    command: string
    payload: any
  }
}) => {
  const message = event.data;
  switch (message.command) {
    case 'vscodeCB':
      bridge.listen(message.payload.cbUID, message.payload.data)
      break;
    default:
      break;
  }
});

type RegexpItem = {
  checked: boolean
  regexp?: string
}

const Item = memo((
  props: PropsWithChildren<{
    index: number
    remove: (index: number) => void
    toggleChecked: (index: number, checked: boolean) => void
    setRegexp: (index: number, regexp: string) => void
  } & RegexpItem>
) => {
  const remove = useCallback(() => {
    props.remove(props.index)
  }, [])
  const toggleChecked = useCallback((e) => {
    props.toggleChecked(props.index, e.target.checked)
  }, [])
  const setRegexp = useCallback((e) => {
    props.setRegexp(props.index, e.target.value)
  }, [])
  return <div className="item">
    <input onChange={toggleChecked} type="checkbox" checked={props.checked} />
    <input placeholder="input regexp" onChange={setRegexp} type="text" value={props.regexp} />
    <button onClick={remove}>-</button>
  </div>
})

const ColorPicker = memo(({
  onChange
}: PropsWithChildren<{
  onChange: (color: string) => void
}>) => {
  const [show, toggleShow] = useState(false)
  const [color, setColor] = useState<ColorResult["rgb"]>(defaultHighlightColor.rgba)
  const togglePanelShow = () => {
    toggleShow(s => !s)
  }
  const setColorAndSync = useCallback((color: ColorResult) => {
    onChange(getColorStr(color.rgb))
  }, [onChange])

  const setColorInner = useCallback((color: ColorResult) => {
    setColor(color.rgb)
  }, [])
  return <div className="color-pop">
    <button onClick={togglePanelShow}>
      <span>set highlight color</span>
      <span style={{ backgroundColor: getColorStr(color) }} className="color-preview" />
    </button>
    {
      show ? <div className="pop-wrap">
        <div className="close" onClick={() => toggleShow(false)} />
        <ChromePicker
          onChange={setColorInner}
          onChangeComplete={setColorAndSync}
          color={color}
          disableAlpha={false}
        />
      </div> : null
    }
  </div>
})

function APP() {
  const [list, setList] = useState<RegexpItem[]>([])
  const [history, setHistory] = useState<string[]>([])
  const [findRegExp, setFindRegexp] = useState<string>()
  const [ignoreCase, setIgnoreCase] = useState(false)

  useEffect(() => {
    const listener = (
      event: {
        data: {
          command: string
          payload: any
        }
      }
    ) => {
      try {
        if (event.data?.command === uniqueUIDForSyncStoreCommand) {
          setList(JSON.parse(event.data.payload))
        }
      } catch {
        setHistory(s => {
          s.unshift(getLog('error', `sync option store filed`))
          return [...s]
        })
      }
    }
    window.addEventListener('message', listener)
    return () => {
      window.removeEventListener('message', listener)
    }
  }, [])

  const getLog = useMemo(() => {
    return (type: 'info' | 'error',
      text: string) => `[${type}] ${new Date().toLocaleTimeString()}: ${text}\n`
  }, [])


  const saveToContext = useMemo(() => {
    return debounce((list: RegexpItem[]) => bridge.post({
      command: 'saveOptionsToContext',
      payload: list
    }, () => null), 199)
  }, [])

  const addRegexp = useCallback(() => {
    setList(s => {
      s.unshift({
        checked: s.length === 0,
        regexp: ''
      })
      saveToContext(s)
      return [...s]
    })
  }, [])

  const remove = useCallback((index: number) => {
    setList(s => {
      s.splice(index, 1)
      saveToContext(s)
      return [...s]
    })
  }, [])

  const toggleChecked = useCallback((index: number, checked: boolean) => {
    setList(s => {
      s.forEach(i => i.checked = false)
      s[index].checked = checked
      saveToContext(s)
      return [...s]
    })
  }, [])

  const setRegexp = useCallback((index: number, regexp: string) => {
    setList(s => {
      s[index].regexp = regexp
      saveToContext(s)
      return [...s]
    })
  }, [])

  const searchAllAndHightLight = useCallback(() => {
    if (findRegExp) {
      bridge.post({
        command: 'searchAllAndHightLight',
        payload: findRegExp
      }, (time: number) => {
        setHistory(s => {
          s.unshift(getLog('info', `search for ${findRegExp}, found ${time}`))
          return [...s]
        })
      })
    } else {
      bridge.post({
        command: 'clearStatus',
        payload: findRegExp
      }, () => {
        setHistory(s => {
          s.unshift(getLog('error', `empty regexp`))
          return [...s]
        })
      })
    }
  }, [findRegExp])

  const pre = useCallback(() => {
    bridge.post({
      command: 'setPrevious',
      payload: null
    }, (line: number) => {
      setHistory(s => {
        s.unshift(getLog('info', `go to line: ${line}`))
        return [...s]
      })
    })
  }, [])

  const next = useCallback(() => {
    bridge.post({
      command: 'setNext',
      payload: null
    }, (line: number) => {
      setHistory(s => {
        s.unshift(getLog('info', `go to line: ${line}`))
        return [...s]
      })
    })
  }, [])

  const setFindRegexpCB = useCallback((e) => {
    setFindRegexp(e.target.value)
  }, [])

  const setHighlightColor = useCallback((color) => {
    bridge.post({
      command: 'setHighlightColor',
      payload: color
    }, () => {
      setHistory(s => {
        s.unshift(getLog('info', `set highlight color ${color}`))
        return [...s]
      })
    })
  }, [])

  const editSelected = useCallback(() => {
    const selected = list.find(i => i.checked)
    if (selected) {
      bridge.post({
        command: 'editSelected',
        payload: {
          to: selected.regexp ?? '',
          match: findRegExp
        }
      }, ({ line, text }: { line: number, text: string }) => {
        setHistory(s => {
          s.unshift(getLog('info', `set target to [ ${text} ] at line: ${line}`))
          return [...s]
        })
      })
    } else {
      setHistory(s => {
        s.unshift(getLog('error', `no regexp checked`))
        return [...s]
      })
    }
  }, [list, findRegExp])

  const editALLSelected = useCallback(() => {
    const selected = list.find(i => i.checked)
    if (selected) {
      bridge.post({
        command: 'editAllSelected',
        payload: {
          to: selected.regexp ?? '',
          match: findRegExp
        }
      }, ({ times, text }: { times: number, text: string }) => {
        setHistory(s => {
          s.unshift(getLog('info', `set target to [ ${text} ], ${times} times`))
          return [...s]
        })
      })
    } else {
      setHistory(s => {
        s.unshift(getLog('error', `no regexp checked`))
        return [...s]
      })
    }
  }, [list, findRegExp])


  const toggleIgnoreCase = useCallback((e) => {
    setIgnoreCase(i => {
      bridge.post({
        command: 'ignoreCase',
        payload: {
          checked: !i,
          match: findRegExp
        }
      }, () => undefined)
      setHistory(s => {
        s.unshift(getLog('info', `toggle ignore case: ${!i}`))
        return [...s]
      })
      return !i
    })
  }, [findRegExp])

  const clearLog = useCallback(() => {
    setHistory([])
  }, [])

  return <div className="regexp-wrap-grid">
    <div>
      <h3>Optional Regexp Replace</h3>
      <div className="row-1-grid">
        <input
          className="find-regexp-input"
          value={findRegExp}
          onChange={setFindRegexpCB}
          placeholder="regexp" />
        <div className="ignore-wrap">
          <input type="checkbox" checked={ignoreCase} />
          <button onClick={toggleIgnoreCase}>ignore case</button>
        </div>
      </div>
      <div className="dvd" />
      <div className="common-grid">
        <button className="primary-button" onClick={searchAllAndHightLight}>search ⌕</button>
        <button onClick={pre}>←previous</button>
        <button onClick={next}>→next</button>
      </div>
      <div className="dvd" />
      <div className="common-grid">
        <button onClick={addRegexp} className="primary-button">+add regexp option</button>
        <button onClick={editSelected} className="fire-button">▶︎replace</button>
        <button onClick={editALLSelected} className="fire-button">▶︎replace all</button>
      </div>
      <div className="dvd" />
      <div className="common-grid">
        <ColorPicker onChange={setHighlightColor} />
      </div>
      {
        list.map((_, i) => {
          return <Item
            key={i}
            toggleChecked={toggleChecked}
            setRegexp={setRegexp}
            index={i}
            remove={remove}
            checked={_.checked}
            regexp={_.regexp}
          />
        })
      }
    </div>
    <div className="log-title">
      <b>Log</b> <button onClick={clearLog}>clear</button>
    </div>
    <div className="history">
      {
        history.map((_, i) => {
          return i === 0 ? <div className="log-text-deco">{`${_}`}</div> : <div>{_}</div>
        })
      }
    </div>
  </div>
}

ReactDom.render(<APP />, document.getElementById('app'))