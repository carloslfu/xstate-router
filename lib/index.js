"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const react_1 = require("react");
const path_to_regexp_1 = require("path-to-regexp");
const react_2 = require("@xstate/react");
const xstate_1 = require("xstate");
const graph_1 = require("@xstate/graph");
const actions_1 = require("xstate/lib/actions");
const history_1 = require("history");
function matchURI(path, uri) {
    if (path === undefined) {
        return {};
    }
    const keys = [];
    const pattern = path_to_regexp_1.pathToRegexp(path, keys);
    const match = pattern.exec(uri);
    if (!match)
        return null;
    const params = Object.create(null);
    for (let i = 1; i < match.length; i++) {
        params[keys[i - 1].name] = match[i] !== undefined ? match[i] : undefined;
    }
    return params;
}
exports.matchURI = matchURI;
function buildURI(path, match) {
    const keys = [];
    const pattern = path_to_regexp_1.pathToRegexp(path, keys); // TODO: Use caching
    const regexp = pattern.exec(path);
    if (!regexp)
        return path;
    let result = '';
    var lastIndex = 0;
    for (let i = 1; i < regexp.length; i++) {
        const param = regexp[i]; // e.g. :whatever
        const paramName = param.substr(1); // e.g. whatever
        const pos = path.indexOf(param, lastIndex);
        result += path.substring(lastIndex, pos) + match[paramName];
        lastIndex = pos + param.length;
    }
    result += path.substr(lastIndex);
    return result;
}
exports.buildURI = buildURI;
function resolve(routes, location, handleError) {
    for (const route of routes) {
        const uri = location.pathname;
        const params = matchURI(route[1], uri);
        if (params)
            return params;
    }
    if (!handleError) {
        return resolve(routes, location, true);
    }
}
exports.resolve = resolve;
exports.routerEvent = 'route-changed';
function getRoutes(config) {
    const nodes = graph_1.getStateNodes(xstate_1.Machine(config));
    const routes = [];
    for (const node of nodes) {
        if (node.meta && node.meta.path) {
            routes.push([node.path, node.meta.path]);
        }
    }
    return routes;
}
exports.getRoutes = getRoutes;
function addRouterEvents(history, configObj, routes) {
    const config = Object.assign({}, configObj);
    if (!config.on) {
        config.on = {};
    }
    else {
        config.on = Object.assign({}, config.on);
    }
    const given = exports.routerEvent in config.on ? config.on[exports.routerEvent] : [];
    const on = given instanceof Array ? given : [given];
    on.push({
        cond: (context, event) => event.dueToStateTransition,
        actions: actions_1.assign(() => ({
            location: history.location,
            match: resolve(routes, history.location)
        }))
    });
    for (const route of routes) {
        on.push({
            target: '#(machine).' + route[0].join('.'),
            cond: (context, event) => event.dueToStateTransition === false && event.route && event.route === route[1],
            actions: actions_1.assign(() => ({
                location: history.location,
                match: matchURI(route[1], history.location.pathname)
            }))
        });
    }
    config.on[exports.routerEvent] = on;
    return config;
}
exports.addRouterEvents = addRouterEvents;
function createRouterMachine({ config, options = {}, initialContext = {}, history = history_1.createBrowserHistory(), }) {
    const routes = getRoutes(config);
    const enhancedConfig = addRouterEvents(history, config, routes);
    const currentLocation = history.location;
    const enhancedContext = Object.assign(Object.assign({}, initialContext), { match: resolve(routes, currentLocation), location: currentLocation, history });
    return xstate_1.Machine(enhancedConfig, options, enhancedContext);
}
exports.createRouterMachine = createRouterMachine;
function routerMachine({ config, options = {}, initialContext = {}, history = history_1.createBrowserHistory(), }, interpreterOptions) {
    const machine = createRouterMachine({ config, options, initialContext, history });
    const service = xstate_1.interpret(machine, interpreterOptions);
    service.start();
    handleTransitionEvents(service, history, getRoutes(config));
    return service;
}
exports.routerMachine = routerMachine;
function useRouterMachine({ config, options = {}, initialContext = {}, history = history_1.createBrowserHistory(), }, interpreterOptions) {
    const machine = createRouterMachine({ config, options, initialContext, history });
    const [state, send, service] = react_2.useMachine(machine, interpreterOptions);
    react_1.useEffect(() => {
        handleTransitionEvents(service, history, getRoutes(config));
    }, []);
    return { state, send, service };
}
exports.useRouterMachine = useRouterMachine;
function handleTransitionEvents(service, history, routes) {
    let debounceHistoryFlag = false;
    let debounceState = false;
    handleRouterTransition(history.location);
    service.onTransition(state => {
        const stateNode = getCurrentStateNode(service, state);
        const path = findPathRecursive(stateNode);
        if (debounceState
            // debounce only if no target for event was given e.g. in case of 
            // fetching 'route-changed' events by the user
            && debounceState[1] === path) {
            debounceState = false;
            return;
        }
        if (!matchURI(path, history.location.pathname)) {
            debounceHistoryFlag = true;
            const uri = buildURI(path, state.context.match);
            history.push(uri);
            service.send({ type: exports.routerEvent, dueToStateTransition: true, route: path, service: service });
        }
    });
    history.listen(location => {
        if (!service.initialized) {
            service.start();
        }
        if (debounceHistoryFlag) {
            debounceHistoryFlag = false;
            return;
        }
        handleRouterTransition(location, true);
    });
    function handleRouterTransition(location, debounceHistory) {
        let matchingRoute;
        for (const route of routes) {
            const params = matchURI(route[1], location.pathname);
            if (params) {
                matchingRoute = route;
                break;
            }
        }
        if (matchingRoute) {
            debounceState = matchingRoute[1]; // debounce only for this route
            service.send({ type: exports.routerEvent, dueToStateTransition: false, route: matchingRoute[1], service: service });
            const state = service.state.value;
            if (!xstate_1.matchesState(state, matchingRoute[0].join('.'))) {
                const stateNode = getCurrentStateNode(service, service.state);
                if (stateNode.meta && stateNode.meta.path) {
                    if (debounceHistory) {
                        debounceHistoryFlag = true;
                    }
                    history.replace(stateNode.meta.path);
                }
            }
        }
    }
}
exports.handleTransitionEvents = handleTransitionEvents;
function findPathRecursive(stateNode) {
    let actual = stateNode;
    while (actual.parent) {
        if (actual.meta && actual.meta.path) {
            return actual.meta.path;
        }
        actual = actual.parent;
    }
}
exports.findPathRecursive = findPathRecursive;
function getCurrentStateNode(service, state) {
    const strings = state.toStrings();
    const stateNode = service.machine.getStateNodeByPath(strings[strings.length - 1]);
    return stateNode;
}
