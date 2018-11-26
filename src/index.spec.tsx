import * as React from 'react'
import { render, fireEvent, cleanup } from 'react-testing-library'
import { createMemoryHistory } from 'history'
import { toStatePaths } from 'xstate/lib/utils'
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
    GoSubstateB: 'substate.b'
  },
  states: {
    home: {
      meta: { path: '/' },
    },
    about: {
      meta: { path: '/about' }
    },
    substate: {
      meta: { path: '/substate' },
      initial: 'a',
      states: {
        a: {
          meta: { path: '/substate/a' }
        },
        b: {},
      }
    },
    noMatch: {
      meta: { path: '*' }
    },
  }
}

const options = {}

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

  it('When enter a substate of a routable state from other routable state, should update the route', () => {
    const { getByTestId } = renderWithRouter(App, { route: '/about' })
    fireEvent.click(getByTestId('go-substate-b'))
    expect(getByTestId('location-display').textContent).toBe('/substate')
  })

})
