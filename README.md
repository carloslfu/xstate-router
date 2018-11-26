# xstate-router

XState Router. Add routes to your XState machine.

Install it with: `npm i xstate-router`

If you want to use this solution with hooks [use-router-machine](https://github.com/carloslfu/use-router-machine)

## Use

Install the library with `npm i xstate-router`.

Live example: https://codesandbox.io/s/rllly3pyxp

The `routerMachine` function returns an interpreter:

```javascript
import { routerMachine } from 'xstate-router'

const service = routerMachine({
    config: machineConfig,
    options,
    initialContext,
})

service.onTransition(state => console.log(state.value))

```
