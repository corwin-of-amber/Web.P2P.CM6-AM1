/**
 * Useful to attach some values to the global `window` * object, for use 
 * in the JS REPL.
 * @param obj
 * @returns the object
 */
export function expose(obj: {}) {
    Object.assign(window, obj);
    return obj; 
}
