'use strict';

// TODO: replace to import
// import * as functions from 'firebase-functions';
// import DialogflowApp as App from 'actions-on-google';

const App = require('actions-on-google').DialogflowApp;
const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp(functions.config().firebase);

const dbref = admin.database().ref();

process.env.DEBUG = "actions-on-google:*";

class UserPreference {
    public id: string;
    public countTime: number;
    public startTime: number;
    public loginedAt: number;

    constructor(init?: Partial<UserPreference>) {
        Object.assign(this, init);
    }

    public isStarting(): boolean {
        return this.startTime > 0;
    }

    public start(second: number) {
        this.countTime = second * 1000;
        this.startTime = new Date().getTime();
    }

    public reset() {
        this.startTime = 0;
    }

    public timeDiff(now: number): number {
        return now - this.startTime;
    }

    public isInTime(now: number, range: number): boolean {
        const diff = now - this.startTime;
        return this.countTime - range < diff && diff < this.countTime + range;
    }
}

class Storage {
    private path: string;

    constructor(path) {
        this.path = path;
    }

    public set(value: any) {
        dbref.child(this.path).set(value);
    }

    public update(value: any) {
        dbref.child(this.path).update(value);
    }

    public setComplete(value: any): Promise<void> {
        return new Promise((resolve, reject) => {
            dbref.child(this.path)
                .set(value, err => {
                    if (err !== null) {
                        resolve();
                    } else {
                        reject(err);
                    }
                });
        });
    }

    public fetch<T>(): Promise<T> {
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

export const dialogflowFirebaseFulfillment = functions.https.onRequest((request, response) => {
    console.log("Request body: " + JSON.stringify(request.body));

    const app = new App({request: request, response: response});
    const user_id = app.getUser().user_id;
    const storage = new Storage(`/users/${user_id}`);
    const requestTime = new Date(app.body_.timestamp);

    const actionMap = new Map();
    actionMap.set('instruction.welcome', (_app) => {
        console.log("instruction.welcome");

        _app.ask('<speak>決闘カウントダウンへようこそ。ルールを知りたいときは、<prosody volume="loud">「ルール」</prosody>やめたいときは<prosody volume="loud">「さらばだ」</prosody>といってね</speak>', []);
        const user = new UserPreference({id: user_id, loginedAt: new Date().getTime()});
        storage.set(user);
    });
    actionMap.set('battle.start', (_app) => {
        console.log("battle.start");

        storage.fetch<UserPreference>()
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

        storage.fetch<UserPreference>()
            .then(_user => {
                const now = requestTime.getTime();
                const user = new UserPreference(_user);

                if (!user.isStarting()) {
                    _app.ask('はじめるときは、10秒で勝負. というようにいってみよう', []);
                    return;
                }

                if (user.isInTime(now, 300)) {
                    _app.ask(`<speak><prosody volume="loud">ぐわっ</prosody><break time="1s"/>やられた. 時間は ${user.timeDiff(now) / 1000.0} 秒</speak>`, []);
                } else {
                    _app.ask(`貴様の負けだ. 時間は ${user.timeDiff(now) / 1000.0} 秒`, []);
                }

                user.reset();
                storage.set(user);
            })
            .catch(err => console.error(err));
    });
    actionMap.set('instruction.exit', (_app) => {
        console.log('instruction.exit');

        _app.tell('さらばだ! また会おう');
    });

    app.handleRequest(actionMap);
});
