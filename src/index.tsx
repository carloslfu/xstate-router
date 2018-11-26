import * as toRegex from 'path-to-regexp'
import { Machine, matchesState, StateSchema, EventObject, MachineConfig, MachineOptions } from 'xstate'
import { interpret } from 'xstate/lib/interpreter'
import { getNodes } from 'xstate/lib/graph'
import { assign } from 'xstate/lib/actions'
import { createBrowserHistory } from 'history'

export function matchURI(path, uri) {
  const keys: any = []
  const pattern = toRegex(path, keys) // TODO: Use caching
  const match = pattern.exec(uri)
  if (!match) return null
  const params = Object.create(null)
  for (let i = 1; i < match.length; i++) {
    params[keys[i - 1].name] = match[i] !== undefined ? match[i] : undefined
  }
  return params
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

export const routerEventPrefix = 'Router_'

export function getRoutes(config) {
  const nodes = getNodes(Machine(config))
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
  config.on.RouterCmd_refresh = {
    actions: assign(ctx => ({
      ...ctx,
      location: history.location,
      match: resolve(routes, history.location)
    }))
  }
  for (const route of routes) {
    config.on[routerEventPrefix + route[0].join('_')] = {
      target: '#(machine).' + route[0].join('.'),
      actions: assign(ctx => ({
        ...ctx,
        location: history.location,
        match: matchURI(route[1], history.location.pathname)
      }))
    }
  }
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

export function routerMachine<
  TContext = any,
  TState extends StateSchema = any,
  TEvent extends EventObject = any
>({
  config,
  options = {},
  initialContext = {},
  history = createBrowserHistory(),
}: RouterArgs) {
  let debounceHistoryFlag = false
  let debounceState = false
  const routes = getRoutes(config)
  const enhancedConfig = addRouterEvents(history, config, routes)
  const currentLocation = history.location
  const enhancedContext = {
    ...initialContext,
    match: resolve(routes, currentLocation),
    location: currentLocation,
    history
  }
  const service = interpret(Machine(enhancedConfig, options, enhancedContext))
  service.start()
  service.onTransition(state => {
    if (debounceState) {
      debounceState = false
      return
    }
    const stateNode = service.machine.getStateNodeByPath((state.tree as any).paths[0])
    const path = findPathRecursive(stateNode)
    if (!matchURI(path, history.location.pathname)) {
      debounceHistoryFlag = true
      history.push(path)
      service.send('RouterCmd_refresh')
    }
  })

  handleRouterTransition(history.location)

  history.listen(location => {
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
      debounceState = true
      service.send(routerEventPrefix + matchingRoute[0].join('_'))
      const state = service.state.value
      if (!matchesState(state, matchingRoute[0].join('.'))) {
        const stateNode = service.machine.getStateNodeByPath(
          (service.state.tree as any).paths[0]
        )
        if (stateNode.meta && stateNode.meta.path) {
          if (debounceHistory) {
            debounceHistoryFlag = true
          }
          history.replace(stateNode.meta.path)
        }
      }
    }
  }

  return service
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
