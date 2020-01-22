import * as React from 'react'
import { render, fireEvent, cleanup } from '@testing-library/react'
import { createMemoryHistory } from 'history'
import { MachineOptions } from 'xstate'
import { toStatePaths } from 'xstate/lib/utils'
import { assign } from 'xstate/lib/actions'
import { routerMachine } from './index'

function renderWithRouter(
  ui,
  { route = '/', history = createMemoryHistory({initialEntries: [route]}) } = {},
) {
  return {
    ...render(React.createElement(ui, { history })),
    history,
  }
}

function stateToString(stateValue) {
  return toStatePaths(stateValue)[0].join('.')
}

const machineConfig = {
  initial: 'home',
  on: {
    GoAbout: 'about',
    GoSubstateB: 'substate.b',
    GoSubstateC: {
        target: 'substate.c',
        actions: assign({
          match: (ctx, event) => ({ param: (event as any).param }),
        })
    }
  },
  states: {
    home: {
      meta: { path: '/' },
    },
    about: {
      meta: { path: '/about' },
      on: {
        'route-changed': [
          {
            cond: (context, event) => event.dueToStateTransition === false
              && event.route 
              && event.route === '/substate/a',
            target: 'substate.c',
            actions: assign({
              match: { param: 815 }
            }),
          },
          {
            cond: (context, event) => event.dueToStateTransition === false
              && event.route 
              && event.route === '/substate/b',
          }
        ],
      }
    },
    substate: {
      meta: { path: '/substate' },
      initial: 'a',
      states: {
        a: {
          meta: { path: '/substate/a' }
        },
        b: {},
        c: {
          meta: { path: '/substate/:param/c' }
        }
      }
    },
    noMatch: {
      meta: { path: '(.*)' }
    },
  }
}

const options: MachineOptions<any, any> = {} as MachineOptions<any, any>

const initialContext = {}

class App extends React.Component<any, any> {

  send: any
  service: any

  constructor(props) {
    super(props)
    this.service = routerMachine({
      config: machineConfig,
      options,
      initialContext,
      history: this.props.history
    })
    this.state = {
      machineState: this.service.state.value,
      ctx: this.service.machine.context
    }
    this.send = this.service.send
  }

  componentDidMount() {
    this.service.onTransition(state =>
      this.setState({ machineState: state.value })
    )
    this.service.onChange(ctx => this.setState({ ctx }))
  }

  render() {
    return (
      <div>
        <div><button data-testid="go-about" onClick={() => this.send('GoAbout')}></button></div>}
        <div><button data-testid="go-substate-b" onClick={() => this.send('GoSubstateB')}></button></div>}
        <div><button data-testid="go-substate-c" onClick={() => this.send('GoSubstateC', { param: 817 })}></button></div>}
        <div data-testid="state">{stateToString(this.state.machineState)}</div>}
        <div data-testid="location-display">{this.props.history.location.pathname}</div>
      </div>
    )
  }
}

afterEach(cleanup)

describe('XStateRouter', () => {

  it('When enter a route, should update the state', () => {
    const { getByTestId } = renderWithRouter(App, { route: '/about' })
    expect(getByTestId('state').textContent).toBe('about')
  })

  it('When enter a route and the machine enters to a routable substate, should update the route', () => {
    const { getByTestId } = renderWithRouter(App, { route: '/substate' })
    expect(getByTestId('location-display').textContent).toBe('/substate/a')
  })

  it('When enter a routable state, should update the route', () => {
    const { getByTestId } = renderWithRouter(App)
    fireEvent.click(getByTestId('go-about'))
    expect(getByTestId('state').textContent).toBe('about')
  })

  it('When go back in history, should update state acordinglly', () => {
    const { getByTestId, history } = renderWithRouter(App)
    fireEvent.click(getByTestId('go-about'))
    history.goBack()
    expect(getByTestId('state').textContent).toBe('home')
  })

  it('When enter a routable state, should be able to redirect state update', () => {
    const { getByTestId, history } = renderWithRouter(App)
    fireEvent.click(getByTestId('go-about'))
    history.replace('/substate/a')
    expect(getByTestId('state').textContent).toBe('substate.c')
    expect(getByTestId('location-display').textContent).toBe('/substate/815/c')
  })

  it('When enter a routable parameterized state, match should contain parameter value', () => {
    const { getByTestId } = renderWithRouter(App, { route: '/substate/816/c' })
    expect(getByTestId('state').textContent).toBe('substate.c')
    expect(getByTestId('location-display').textContent).toBe('/substate/816/c')
  })

  it('When enter a routable state, should be able to stop state update', () => {
    const { getByTestId, history } = renderWithRouter(App)
    history.replace('/substate/b')
    fireEvent.click(getByTestId('go-about'))
    expect(getByTestId('state').textContent).toBe('about')
  })

  it('When enter a substate of a routable state from other routable state, should update the route', () => {
    const { getByTestId } = renderWithRouter(App, { route: '/about' })
    fireEvent.click(getByTestId('go-substate-b'))
    expect(getByTestId('location-display').textContent).toBe('/substate')
  })

  it('When enter a state having a parameterized route, the route should reflect the current param value', () => {
    const { getByTestId } = renderWithRouter(App, { route: '/about' })
    fireEvent.click(getByTestId('go-substate-c'))
    expect(getByTestId('location-display').textContent).toBe('/substate/817/c')
  })

  it('When the path doesn\'t match, should go to the default route', () => {
    const { getByTestId } = renderWithRouter(App, { route: '/no-matching-route' })
    expect(getByTestId('state').textContent).toBe('noMatch')
  })

})
