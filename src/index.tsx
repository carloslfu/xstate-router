import { useEffect } from 'react';
import { pathToRegexp } from 'path-to-regexp'
import { useMachine } from '@xstate/react'
import { Machine, matchesState, StateSchema, EventObject, MachineConfig, MachineOptions, StateMachine, InterpreterOptions, interpret } from 'xstate'
import { getStateNodes } from '@xstate/graph'
import { assign } from 'xstate/lib/actions'
import { createBrowserHistory } from 'history'

export function matchURI(path, uri) {
  if (path === undefined) {
    return {}
  }
  const keys: any[] = []
  const pattern = pathToRegexp(path, keys)
  const match = pattern.exec(uri)
  if (!match) return null
  const params = Object.create(null)
  for (let i = 1; i < match.length; i++) {
    params[keys[i - 1].name] = match[i] !== undefined ? match[i] : undefined
  }
  return params
}

export function buildURI(path: string, match: any) {
    const keys: any = []
    const pattern: RegExp = pathToRegexp(path, keys) // TODO: Use caching
    const regexp = pattern.exec(path)
    if (!regexp) return path
    let result = ''
    var lastIndex = 0
    for (let i = 1; i < regexp.length; i++) {
        const param: string = regexp[i]           // e.g. :whatever
        const paramName: string = param.substr(1) // e.g. whatever
        const pos: number = path.indexOf(param, lastIndex)
        result += path.substring(lastIndex, pos) + match[paramName]
        lastIndex = pos + param.length
    }
    result += path.substr(lastIndex)
    return result
}

export function resolve(routes, location, handleError?: boolean) {
  for (const route of routes) {
    const uri = location.pathname
    const params = matchURI(route[1], uri)
    if (params) return params
  }
  if (!handleError) {
    return resolve(routes, location, true)
  }
}

export const routerEvent = 'route-changed'

export function getRoutes(config) {
  const nodes = getStateNodes(Machine(config))
  const routes: any = []
  for (const node of nodes) {
    if (node.meta && node.meta.path) {
      routes.push([node.path, node.meta.path])
    }
  }
  return routes
}

export function addRouterEvents(history, configObj, routes) {
  const config = { ...configObj }
  if (!config.on) {
    config.on = {}
  } else {
    config.on = { ...config.on }
  }
  const given: any = routerEvent in config.on ? config.on[routerEvent] : []
  const on: any = given instanceof Array ? given : [given]
  on.push({
    cond: (context, event) => event.dueToStateTransition,
    actions: assign(() => ({
      location: history.location,
      match: resolve(routes, history.location)
    }))
  })
  for (const route of routes) {
      on.push({
        target: '#(machine).' + route[0].join('.'),
        cond: (context, event) => event.dueToStateTransition === false && event.route && event.route === route[1],
        actions: assign(() => ({
            location: history.location,
            match: matchURI(route[1], history.location.pathname)
        }))
      })
  }
  config.on[routerEvent] = on
  return config
}

interface RouterArgs<
  TContext = any,
  TState extends StateSchema = any,
  TEvent extends EventObject = any
> {
  config: MachineConfig<TContext, TState, TEvent>,
  options: MachineOptions<TContext, TEvent>,
  initialContext: TContext,
  history?
}

export function createRouterMachine<
  TContext = any,
  TState extends StateSchema = any,
  TEvent extends EventObject = any
>({
  config,
  options = ({} as MachineOptions<TContext, TEvent>),
  initialContext = {},
  history = createBrowserHistory(),
}: RouterArgs): StateMachine<TContext, TState, TEvent> {
  const routes = getRoutes(config)
  const enhancedConfig = addRouterEvents(history, config, routes)
  const currentLocation = history.location
  const enhancedContext = {
    ...initialContext,
    match: resolve(routes, currentLocation),
    location: currentLocation,
    history
  }

  return Machine(enhancedConfig, options, enhancedContext);
}

export function routerMachine<
  TContext = any,
  TState extends StateSchema = any,
  TEvent extends EventObject = any
>({
  config,
  options = ({} as MachineOptions<TContext, TEvent>),
  initialContext = {},
  history = createBrowserHistory(),
}: RouterArgs,
  interpreterOptions?: Partial<InterpreterOptions>
) {
  const machine = createRouterMachine({config, options, initialContext, history})
  const service = interpret(machine, interpreterOptions)
  service.start()

  handleTransitionEvents(service, history, getRoutes(config))

  return service
}

export function useRouterMachine
<
  TContext = any,
  TState extends StateSchema = any,
  TEvent extends EventObject = any
>({
  config,
  options = ({} as MachineOptions<TContext, TEvent>),
  initialContext = {},
  history = createBrowserHistory(),
}: RouterArgs,
  interpreterOptions?: Partial<InterpreterOptions>) {
  const machine = createRouterMachine({config, options, initialContext, history})
  const [state, send, service] = useMachine(machine, interpreterOptions);

  useEffect(() => {
    handleTransitionEvents(service, history, getRoutes(config))
  }, [])

  return {state, send, service};
}

export function handleTransitionEvents (service, history, routes) {
  let debounceHistoryFlag = false
  let debounceState = false
  handleRouterTransition(history.location)

  service.onTransition(state => {
    const stateNode = getCurrentStateNode(service, state)
    const path = findPathRecursive(stateNode)
    if (debounceState
        // debounce only if no target for event was given e.g. in case of 
        // fetching 'route-changed' events by the user
        && debounceState[1] === path) {
      debounceState = false
      return
    }
    if (!matchURI(path, history.location.pathname)) {
      debounceHistoryFlag = true
      const uri = buildURI(path, state.context.match)
      history.push(uri)
      service.send({ type: routerEvent, dueToStateTransition: true, route: path, service: service })
    }
  })

  history.listen(location => {
    
    if (!service.initialized) {
      service.start();
    }
    
    if (debounceHistoryFlag) {
      debounceHistoryFlag = false
      return
    }
    
    handleRouterTransition(location, true)
  })

  function handleRouterTransition(location, debounceHistory?: boolean) {
    let matchingRoute
    for (const route of routes) {
      const params = matchURI(route[1], location.pathname)
      if (params) {
        matchingRoute = route
        break
      }
    }
    if (matchingRoute) {
      debounceState = matchingRoute[1]  // debounce only for this route
      service.send({ type: routerEvent, dueToStateTransition: false, route: matchingRoute[1], service: service })
      const state = service.state.value
      if (!matchesState(state, matchingRoute[0].join('.'))) {
        const stateNode = getCurrentStateNode(service, service.state)

        if (stateNode.meta && stateNode.meta.path) {
          if (debounceHistory) {
            debounceHistoryFlag = true
          }
          history.replace(stateNode.meta.path)
        }
      }
    }
  }
}

export function findPathRecursive(stateNode) {
  let actual = stateNode
  while (actual.parent) {
    if (actual.meta && actual.meta.path) {
      return actual.meta.path
    }
    actual = actual.parent
  }
}

function getCurrentStateNode(service, state) {
  const strings = state.toStrings()
  const stateNode = service.machine.getStateNodeByPath(strings[strings.length - 1])
  return stateNode
}
