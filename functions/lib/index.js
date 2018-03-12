'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
// import * as functions from 'firebase-functions';
// import DialogflowApp as App from 'actions-on-google';
const App = require('actions-on-google').DialogflowApp;
const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp(functions.config().firebase);
const dbref = admin.database().ref();
process.env.DEBUG = "actions-on-google:*";
class UserPreference {
    constructor(init) {
        Object.assign(this, init);
        // this.id = id;
        // this.startTime = 0;
        // this.countTime = 10 * 1000;
        // this.loginedAt = loginedAt;
    }
    isStarting() {
        return this.startTime > 0;
    }
    start(second) {
        this.countTime = second * 1000;
        this.startTime = new Date().getTime();
    }
    reset() {
        this.startTime = 0;
    }
    timeDiff(now) {
        return now - this.startTime;
    }
    isInTime(now, range) {
        const diff = now - this.startTime;
        return this.countTime - range < diff && diff < this.countTime + range;
    }
}
class Storage {
    constructor(path) {
        this.path = path;
    }
    set(value) {
        dbref.child(this.path).set(value);
    }
    update(value) {
        dbref.child(this.path).update(value);
    }
    setComplete(value) {
        return new Promise((resolve, reject) => {
            dbref.child(this.path)
                .set(value, err => {
                if (err !== null) {
                    resolve();
                }
                else {
                    reject(err);
                }
            });
        });
    }
    fetch() {
        return new Promise((resolve, reject) => {
            dbref.child(this.path)
                .on('value', (snapshot) => {
                resolve(snapshot.val());
            }, (err) => {
                reject(err);
            });
        });
    }
}
exports.dialogflowFirebaseFulfillment = functions.https.onRequest((request, response) => {
    console.log("Request body: " + JSON.stringify(request.body));
    const app = new App({ request: request, response: response });
    const user_id = app.getUser().user_id;
    const storage = new Storage(`/users/${user_id}`);
    const requestTime = new Date(app.body_.timestamp);
    const actionMap = new Map();
    actionMap.set('instruction.welcome', (_app) => {
        console.log("instruction.welcome3");
        _app.ask('<speak>決闘カウントダウンへようこそ。ルールを知りたいときは、<prosody volume="loud">「ルール」</prosody>やめたいときは<prosody volume="loud">「さらばだ」</prosody>といってね</speak>', []);
        const user = new UserPreference({ id: user_id, loginedAt: new Date().getTime() });
        storage.set(user);
    });
    actionMap.set('battle.start', (_app) => {
        console.log("battle.start");
        storage.fetch()
            .then(_user => {
            const second = _app.data.number;
            _app.ask(`${second} 秒で勝負！`, []);
            const user = new UserPreference(_user);
            user.start(second);
            storage.set(user);
        })
            .catch(err => console.error(err));
    });
    actionMap.set('battle.end', (_app) => {
        console.log("battle.end");
        storage.fetch()
            .then(_user => {
            const now = requestTime.getTime();
            const user = new UserPreference(_user);
            if (!user.isStarting()) {
                _app.ask('はじめるときは、10秒で勝負. というようにいってみよう', []);
                return;
            }
            if (user.isInTime(now, 300)) {
                _app.ask(`<speak><prosody volume="loud">ぐわっ</prosody><break time="1s"/>やられた. 時間は ${user.timeDiff(now) / 1000.0} 秒</speak>`, []);
            }
            else {
                _app.ask(`貴様の負けだ. 時間は ${user.timeDiff(now) / 1000.0} 秒`, []);
            }
            user.reset();
            storage.set(user);
        })
            .catch(err => console.error(err));
    });
    actionMap.set('instruction.exit', (_app) => {
        console.log('bye');
        _app.tell('さらばだ! また会おう');
    });
    app.handleRequest(actionMap);
});
//# sourceMappingURL=index.js.map