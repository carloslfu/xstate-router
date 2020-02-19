import * as React from 'react'
import { render, fireEvent, cleanup } from '@testing-library/react'
import { createMemoryHistory } from 'history'
import { MachineOptions } from 'xstate'
import { toStatePaths } from 'xstate/lib/utils'
import { assign } from 'xstate/lib/actions'
import { routerMachine, useRouterMachine } from './index'

const originalError = console.error
beforeAll(() => {
  console.error = (...args) => {
    if (/Warning.*not wrapped in act/.test(args[0])) {
      return
    }
    originalError.call(console, ...args)
  }
})

afterAll(() => {
  console.error = originalError
})

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
    },
    GoToWithoutPath: 'nested_mixed_without_path.without_path',
    GoToWithoutPathRoot: 'root_without_path',
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
    nested_mixed_without_path: {
      meta: { path: '/nested_mixed_without_path' },
      initial: 'path0',
      states: {
        path0: {
          meta: { path: '/nested_mixed_without_path/path0' }
        },
        path1: {
          meta: { path: '/nested_mixed_without_path/path1' }
        },
        path2: {},
        without_path: {},
      },
    },
    root_path0: {
      meta: { path: '/root_without_path/path0' }
    },
    root_path1: {},
    root_without_path: {},
    noMatch: {
      meta: { path: '(.*)' }
    },
  }
}

const options: MachineOptions<any, any> = {} as MachineOptions<any, any>

const initialContext = {}

const commonRender = (state, send, history) => (<div>
  <div><button data-testid="go-about" onClick={() => send('GoAbout')}></button></div>
  <div><button data-testid="go-substate-b" onClick={() => send('GoSubstateB')}></button></div>
  <div><button data-testid="go-substate-c" onClick={() => send('GoSubstateC', { param: 817 })}></button></div>
  <div><button data-testid="go-without_path" onClick={() => send('GoToWithoutPath')}></button></div>
  <div><button data-testid="go-without_path_root" onClick={() => send('GoToWithoutPathRoot')}></button></div>
  <div data-testid="state">{stateToString(state.machineState)}</div>}
  <div data-testid="location-display">{history.location.pathname}</div>
</div>) 

class AppClassComponent extends React.Component<any, any> {

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
    return (commonRender(this.state, this.send, this.props.history));
  }
}

const AppFunctionalComponent = ({history}) => {
   const machine = useRouterMachine({
      config: machineConfig,
      options,
      initialContext,
      history 
    })

    const state = {
      machineState:  machine.state.value,
      ctx: machine.state.context
    }

    return (commonRender(state, machine.send, history));
}  

afterEach(cleanup)

const testClassWithComponent = (App) => {
  it('When enter a route, should update the state', () => {
    const { getByTestId } = renderWithRouter(App, { route: '/about' })
    expect(getByTestId('state').textContent).toBe('about')
  })

  it('When enter a route with siblings states with no path, should work', () => {
    const { getByTestId } = renderWithRouter(App, { route: '/nested_mixed_without_path/path1' })
    expect(getByTestId('state').textContent).toBe('nested_mixed_without_path.path1')
  })

  it('When enter a state with no path with siblings with path, should work', () => {
    const { getByTestId } = renderWithRouter(App, { route: '/nested_mixed_without_path' })
    fireEvent.click(getByTestId('go-without_path'))
    expect(getByTestId('state').textContent).toBe('nested_mixed_without_path.without_path')
  })

  it('When enter a route with siblings states with no path, should work (Root level)', () => {
    const { getByTestId } = renderWithRouter(App, { route: '/root_without_path/path0' })
    expect(getByTestId('state').textContent).toBe('root_path0')
  })

  it('When enter a state with no path with siblings with path, should work (Root level)', () => {
    const { getByTestId } = renderWithRouter(App, { route: '/nested_mixed_without_path' })
    fireEvent.click(getByTestId('go-without_path_root'))
    expect(getByTestId('state').textContent).toBe('root_without_path')
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
}


describe('XStateRouter', () => {
  describe('routerMachine', () => {
    testClassWithComponent(AppClassComponent)
  })

  describe('useRouterMachine', () => {
    testClassWithComponent(AppFunctionalComponent)
  })
})
