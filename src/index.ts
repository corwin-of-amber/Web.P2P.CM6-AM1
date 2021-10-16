import { EventEmitter } from 'events';
import { EditorState, ChangeSet } from '@codemirror/state';
import { EditorView } from '@codemirror/view';

import * as collab from '@codemirror/collab';

import { CodeMirror } from './editor';
import { expose } from './infra/dev';


expose({CodeMirror, EditorState, EditorView, collab});


/**
 * Collaboration boilerplate based on:
 * https://codemirror.net/6/examples/collab/
 */
class CollabCore extends EventEmitter {
    cm: CodeMirror

    constructor(cm: CodeMirror) {
        super();
        this.cm = cm;
        this._bindEvents();
    }

    data(serializedUpdates: any) {
        this.cm.view.dispatch(collab.receiveUpdates(this.cm.state,
            CollabCore.updatesFromJSON(serializedUpdates)));
    }

    _bindEvents() {
        this.cm.on('change', (cm, changeObj) => {
            var ch = collab.sendableUpdates(changeObj.transaction.state);

            if (ch.length > 0) {
                var send = CollabCore.updatesToJSON(ch);
                // In order to immediately dispatch changes to current client
                Promise.resolve().then(() =>
                    cm.view.dispatch(collab.receiveUpdates(cm.state, ch)));

                this.emit('data', send);
            }
        });
    }

    static updatesToJSON(updates: readonly collab.Update[]) {
        return updates.map(lu => ({
            clientID: lu.clientID,
            changes: lu.changes.toJSON()
        }));
    }

    static updatesFromJSON(json: {clientID: string, changes: any}[]) {
        return json.map(el => ({
            clientID: el.clientID,
            changes: ChangeSet.fromJSON(el.changes)
        }));
    }
}


document.addEventListener('DOMContentLoaded', () => {
    var cm1 = new CodeMirror(document.body, {
        extensions: [collab.collab()]
    });

    cm1.focus();

    var cm2 = new CodeMirror(document.body, {
        extensions: [collab.collab()]
    });

    var peers = [cm1, cm2].map(e => new CollabCore(e));

    for (let p of peers) {
        p.on('data', (data) => {
            for (let q of peers)
                if (q !== p) q.data(data);
        });
    }

    expose({CodeMirror, ChangeSet, cm1, cm2, peers, collab});
});
