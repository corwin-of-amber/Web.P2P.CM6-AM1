import { EventEmitter } from 'events';
import Automerge from 'automerge';


class DocSet<D = any> extends EventEmitter {
    docs = new Map<string, DocWithSync<D>>()

    syncStates = new Map<string, Automerge.SyncState>()

    createDoc(docId: string) {
        return this._createDoc(docId).doc;
    }

    getDoc(docId: string) {
        return this.docs.get(docId)?.doc;
    }

    setDoc(docId: string, d: Automerge.Doc<D>) {
        var ed = this.docs.get(docId);
        if (ed) ed.doc = d;
        else this.docs.set(docId, new DocWithSync(d));
        this.emit('change', docId, d);
    }

    _createDoc(docId: string) {
        var newDoc = new DocWithSync<D>();
        this.docs.set(docId, newDoc);
        return newDoc;
    }

    generateSyncMessages(peerId: string) {
        var msgs = new Map<string, Automerge.BinarySyncMessage>();
        for (let [docId, doc] of this.docs.entries()) {
            var msg = doc.generateSyncMessages(peerId);
            if (msg) msgs.set(docId, msg);
        }
        return msgs.size > 0 ? msgs : null;
    }

    receiveSyncMessages(peerId: string, msgs: Map<string, Automerge.BinarySyncMessage>) {
        for (let [docId, msg] of msgs.entries()) {
            var doc = this.docs.get(docId) || this._createDoc(docId);
            doc.receiveSyncMessages(peerId, msg);
        }
    }
}

/**
 * Compatibility class.
 */
class Connection<D = any> extends EventEmitter {
    ds: DocSet<D>
    peerId = '*'

    constructor(ds: DocSet<D>) {
        super();
        this.ds = ds;
        this.ds.on('change', () => this.notify());
        Promise.resolve().then(() => this.notify());
    }

    notify() {
        var msg = this.ds.generateSyncMessages(this.peerId);
        if (msg)
            this.emit('data', msg);
    }

    data(msg: Map<string, Automerge.BinarySyncMessage>) {
        console.log('Connection', msg);
        this.ds.receiveSyncMessages(this.peerId, msg);
        this.notify();
    }
}

/**
 * Following `SYNC.md`.
 */
class DocWithSync<D> {
    doc: Automerge.Doc<D>
    syncStates = new Map<string, Automerge.SyncState>()
    observable = new Automerge.Observable()

    constructor(doc?: Automerge.Doc<D>) {
        this.doc = doc ?? Automerge.init<D>({observable: this.observable});
    }

    generateSyncMessages(peerId: string) {
        var [newState, msg] = Automerge.generateSyncMessage(
            this.doc, this.getSyncState(peerId));
        this.syncStates.set(peerId, newState);
        return msg;
    }

    receiveSyncMessages(peerId: string, msg: Automerge.BinarySyncMessage) {
        var [newDoc, newState] = Automerge.receiveSyncMessage(
            this.doc, this.getSyncState(peerId),
            msg
        );
        this.doc = newDoc;
        this.syncStates.set(peerId, newState);
        return [newDoc, newState];
    }

    getSyncState(peerId: string) {
        var v = this.syncStates.get(peerId);
        if (!v) this.syncStates.set(peerId, v = Automerge.initSyncState());
        return v;
    }
}


export { DocSet, Connection }