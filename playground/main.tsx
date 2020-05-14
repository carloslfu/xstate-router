import * as React from 'react'
import * as ReactDOM from 'react-dom'
import { toStatePaths } from 'xstate/lib/utils'
import { assign } from 'xstate/lib/actions'
import { routerMachine, useRouterMachine } from '../src/index'
import { createHashHistory } from 'history'

const machineConfig = {
  initial: 'home',
  on: {
    ChangeParameter: {
      target: 'uri_template_issue',
      actions: assign({
        match: {id: '4321'},
      })
    },
  },
  states: {
    home: {
      meta: { path: '/' },
    },
    uri_template_issue: {
      meta: { path: '/path/:id' },
    },
    noMatch: {
      meta: { path: '(.*)' }
    },
  }
}

const history = createHashHistory({})

history.push('/path/1234')

function App() {
  const machine = useRouterMachine({
    config: machineConfig,
    options: {} as any,
    initialContext: {},
    history 
  })

  const state = {
    machineState:  machine.state.value,
    ctx: machine.state.context
  }

  return <div>
    <div>
      <button data-testid="change-parameter" onClick={() => machine.send('ChangeParameter')}>
        Change Parameter
      </button>
    </div>
    <div data-testid="state">{JSON.stringify(state.machineState)}</div>
    <div data-testid="location-display">{history.location.pathname}</div>
    <div data-testid="context">{JSON.stringify(state.ctx)}</div>
  </div>
}

ReactDOM.render(<App />, document.getElementById('app'))
