# xstate-router

XState Router. Add routes to your XState machine and maintain it in sync with the actual route.

If you want to use this solution with hooks [use-router-machine](https://github.com/carloslfu/use-router-machine).

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
