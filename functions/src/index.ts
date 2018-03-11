'use strict';

// import * as functions from 'firebase-functions';
// import DialogflowApp as App from 'actions-on-google';
const App = require('actions-on-google').DialogflowApp;
const functions = require('firebase-functions');

// // Start writing Firebase Functions
// // https://firebase.google.com/docs/functions/typescript
//
// export const helloWorld = functions.https.onRequest((request, response) => {
//  response.send("Hello from Firebase!");
// });

process.env.DEBUG = "actions-on-google:*";

const NAME_ACTION = 'make_name';

exports.kettouCountdown = functions.https.onRequest((request, response) => {
    const app = new App({request, response});
    console.log("Request headers: " + JSON.stringify(request.headers));
    console.log("Request body: " + JSON.stringify(request.body));

    function makeResponse(app) {
        app.tell('OK! 通信成功');
    }

    let actionMap = new Map();
    actionMap.set(NAME_ACTION, makeResponse)

    app.handleRequest(actionMap)
});
