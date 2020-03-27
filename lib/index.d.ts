import { StateSchema, EventObject, MachineConfig, MachineOptions, StateMachine, InterpreterOptions } from 'xstate';
export declare function matchURI(path: any, uri: any): any;
export declare function buildURI(path: string, match: any): string;
export declare function resolve(routes: any, location: any, handleError?: boolean): any;
export declare const routerEvent = "route-changed";
export declare function getRoutes(config: any): any;
export declare function addRouterEvents(history: any, configObj: any, routes: any): any;
interface RouterArgs<TContext = any, TState extends StateSchema = any, TEvent extends EventObject = any> {
    config: MachineConfig<TContext, TState, TEvent>;
    options: MachineOptions<TContext, TEvent>;
    initialContext: TContext;
    history?: any;
}
export declare function createRouterMachine<TContext = any, TState extends StateSchema = any, TEvent extends EventObject = any>({ config, options, initialContext, history, }: RouterArgs): StateMachine<TContext, TState, TEvent>;
export declare function routerMachine<TContext = any, TState extends StateSchema = any, TEvent extends EventObject = any>({ config, options, initialContext, history, }: RouterArgs, interpreterOptions?: Partial<InterpreterOptions>): import("xstate").Interpreter<any, any, any, any>;
export declare function useRouterMachine<TContext = any, TState extends StateSchema = any, TEvent extends EventObject = any>({ config, options, initialContext, history, }: RouterArgs, interpreterOptions?: Partial<InterpreterOptions>): {
    state: import("xstate").State<any, any, any, any>;
    send: (event: any, payload?: import("xstate").EventData | undefined) => import("xstate").State<any, any, any, any>;
    service: import("xstate").Interpreter<any, any, any, any>;
};
export declare function handleTransitionEvents(service: any, history: any, routes: any): void;
export declare function findPathRecursive(stateNode: any): any;
export {};
