import { EventEmitter } from 'events';
import { EditorState, EditorStateConfig, StateField, 
         StateEffect, Extension, ChangeSet } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { basicSetup } from '@codemirror/basic-setup';

import * as collab from '@codemirror/collab';


function expose(o: {}) { Object.assign(window, o); return o; }
expose({EditorState, EditorView, basicSetup, collab});


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
        this.view.dispatch({
            effects: eventEffect.of({on: {[event]: [bound]}})
        });
    }
}


namespace CodeMirror {
    export type Options = {
        extensions?: Extension[]
    };
}


const eventField = StateField.define<EventEmitter>({
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

type EventHandlers = {[event: string]: Iterable<(...args: any) => void>};

const eventEffect = StateEffect.define<{on?: EventHandlers, off?: EventHandlers}>();



document.addEventListener('DOMContentLoaded', () => {
    var cm = new CodeMirror(document.body, {
        extensions: [collab.collab()]
    });

    let updatesToJSON = (updates: readonly collab.Update[]) => updates.map(lu => ({
        clientID: lu.clientID,
        changes: lu.changes.toJSON()
    }));

    let updatesFromJSON = (json: {clientID: string, changes: any}[]) =>
        json.map(el => ({
            clientID: el.clientID,
            changes: ChangeSet.fromJSON(el.changes)
        }));

    cm.focus();

    var peer = new CodeMirror(document.body, {
        extensions: [collab.collab()]
    });

    var peers = [cm, peer];

    for (let cm of peers) {
        cm.on('change', (cm, changeObj) => {
            var ch = collab.sendableUpdates(changeObj.transaction.state);

            if (ch.length > 0) {
                var send = updatesToJSON(ch);
                console.log(expose({send}));
                // In order to immediately dispatch changes to current client
                Promise.resolve().then(() =>
                    cm.view.dispatch( collab.receiveUpdates(cm.state, ch) ) )

                // Simulate updates coming through the wire
                Promise.resolve().then(() => {
                    for (let p of peers)
                        if (p !== cm)
                            p.view.dispatch( collab.receiveUpdates(p.state,
                                updatesFromJSON(send)));
                });
            }
        });
    }

    expose({CodeMirror, ChangeSet, cm, peer, collab});
});
