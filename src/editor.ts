/**
 * A facade for CodeMirror that makes it "feel" like CodeMirror 5,
 * while still providing the advantages of the declarative framework.
 * 
 * Useful if you are used to 5, or just want a dead-simple interface to get
 * started quickly.
 */

 import { EventEmitter } from 'events';
 import { EditorState, EditorStateConfig,
          StateField, StateEffect, Extension } from '@codemirror/state';
 import { EditorView } from '@codemirror/view';
 import { basicSetup } from '@codemirror/basic-setup';
 
 
 
class CodeMirror {
    config: {state: EditorStateConfig}
    view: EditorView

    constructor(parent?: HTMLElement, options?: CodeMirror.Options) {
        this.config = {
            state: {
                extensions: [basicSetup, eventField, 
                    ...(options?.extensions ?? [])]
            }
        };
        this.view = new EditorView({state: this.newState(), parent});
    }

    get state(): EditorState { return this.view.state; }

    getValue() {
        return this.state.doc.toString();
    }

    setValue(value: string) {
        this.view.setState(this.newState(value));
    }

    newState(doc: string = "") {
        return EditorState.create({...this.config.state, doc});
    }

    getWrapperElement() {
        return this.view.dom;
    }

    focus() {
        this.view.focus();
    }

    on(event: string, handler: (...a: any[]) => void) {
        var bound = (...a: any[]) => handler(this, ...a);
        (<any>handler)._bound = bound; /** @oops */
        this.view.dispatch({
            effects: eventEffect.of({on: {[event]: [bound]}})
        });
    }

    off(event: string, handler: (...a: any[]) => void) {
        var bound = (<any>handler)._bound; /** @oops */
        if (bound) {
            this.view.dispatch({
                effects: eventEffect.of({off: {[event]: [bound]}})
            });
        }
    }
}


namespace CodeMirror {
     export type Options = {
         extensions?: Extension[]
     };
 
    export type EventHandlers = {
        [event: string]: Iterable<(...args: any) => void>
    };

    export const eventField = StateField.define<EventEmitter>({
        create(state) { return new EventEmitter; },
        update(value, tr) {
            for (let e of tr.effects) {
                if (e.is(eventEffect)) {
                    for (let [k, v] of Object.entries(e.value.on ?? {}))
                        for (let h of v) value.on(k, h);
                    for (let [k, v] of Object.entries(e.value.off ?? {}))
                        for (let h of v) value.off(k, h);
                }
            }
    
            if (!tr.changes.empty) {
                var changeObj = {transaction: tr};    /** @todo */
                value.emit('change', changeObj);      /** @todo */
                value.emit('changes', [changeObj]);   /** @todo */
            }
            return value;
        }
    });
    
    
    export const eventEffect =
        StateEffect.define<{on?: EventHandlers, off?: EventHandlers}>();
}

import eventField = CodeMirror.eventField;
import eventEffect = CodeMirror.eventEffect;


export { CodeMirror }