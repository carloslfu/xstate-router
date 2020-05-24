# xstate-router

XState Router. Add routes to your XState machine and maintain it in sync with the actual route.

## Use

Install the library with `npm i xstate-router`.

If you don't have XState installed, install it: `npm i xstate`

Try the live example here: https://codesandbox.io/s/rllly3pyxp.

The `routerMachine` function returns an interpreter:

```javascript
import { routerMachine } from 'xstate-router'

const machineConfig = {
    initial: 'main',
    context: { myValue: 0 },
    states: {
        main: { meta: { path: '/' } },
        blog: { meta: { path: '/blog' } },
    },
}

const service = routerMachine({
    config: machineConfig,
    options,
    initialContext,
})

// The state changes on a route change and the route changes on a state change.
service.onTransition(state => console.log(state.value))

// The context is enhanced with router properties.
service.onChange(ctx => console.log(ctx))
/* Context
    {
        myValue: 0,
        // Router properties:
        match,
        location,
        history,
    }
*/

```

### Use with React Hooks

```javascript
import { useRouterMachine } from 'xstate-router'

const config = {
  initial: 'home',
  states: {
    home: { meta: { path: '/' }, on: { NEXT: 'about' } },
    about: { meta: { path: '/about' }, on: { NEXT: 'dashboard' } },
    dashboard: {
      meta: { path: '/dashboard' },
      initial: 'login',
      on: { NEXT: 'home' },
      states: {
        loggedIn: {
          initial: 'main',
          states: {
            main: { meta: { path: '/dashboard/main' } },
            data: { meta: { path: '/dashboard/data' } }
          }
        },
        login: {
          meta: { path: '/dashboard/login' },
          on: { LoggedIn: 'loggedIn' }
        }
      }
    }
  }
}

function App() {
    const service = useRouterMachine({ config })

    return <div>{service.state.value}</div>
}
```

### Enhanced context

1. *match:*
Tells you whether the route in the location matches the current state's path. If it matches it contains an object holding properties for each route parameter's value if the path was parameterized. Examples: `null` (not matching), `{}` (no parameters), `{ param1: 4711 }`
1. *location:*
The current value of `history.location`
1. *history:*
`routerMachine(...)` accepts a history object as fourth parameter. If it is missing it defaults to `createBrowserHistory()` (from package `'history'`) and is published in the context.

if you translate to a state having a parameterized route then you have to ensure that context.match contains the values of those parameters. Otherwise the placeholder is shown in the route. Example:
```javascript
  states: {
      list: { meta: { path: '/items' },
         on: {
            ShowDetails: {
                target: 'details',
                actions: assign((ctx, event) => ({
                                    ...ctx,
                                    match: { id: event.item }
                                }))
            }
         }
      }
      details: { meta: { path: '/items/:id:/details'} }
  }
```
where the event trigger could look like this:
```html
<button onClick={() => this.send('ShowDetails', { item: 817 })}>Show details...</button>
```

### Paths

Paths could have parameters such as `/items/:id:/details` and regular expressions, for more information please read this: https://github.com/pillarjs/path-to-regexp.

### Router events

If a route changes then a parameterized event `'route-changed'` is fired: e.g. `{ dueToStateTransition: "true", route: "/blog", service: /* the xstate interpreter */ }`. 
1. If the route changes because a state is entered which has a route configured, then `dueToStateTransition` is `true`. If the route changes because the location was changed (either by the user in the browsers location bar or by a script changing `history.location`), then `dueToStateTransition` is `false`.
1. `route` gives you the current route which causes the event
1. `service` provides the xstate interpreter which can be used to send another event.

Placing an `on: 'router-changed'` event at a state can be used to avoid leaving the current state if the route changes. Think of a state which might show unsaved data and you want to ask the user *'Leave and loose unsaved data?'*. If you decide to accept the new route anyway you have to resend the event:
```javascript
  on: {
    'route-changed': {
      cond: (context, event) => event.dueToStateTransition === false
          && !event.processed,            // interfere only new events
      actions: (context, event) => {
        if (context.unsavedData) return;  // suppress current route change
        event.processed = true;           // mark event as processed
        event.service.send(event);        // resend the event to establish the origin route change
      }
    }
  },
```
