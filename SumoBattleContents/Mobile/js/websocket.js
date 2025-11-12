// ⭐ websocket関連のコード
function GetQueryString() {
    const result = {};
    if (1 < window.location.search.length) {
        const query = window.location.search.substring(1).split('&');
        for (const param of query) {
            const [key, value] = param.split('=').map(decodeURIComponent);
            result[key] = value;
        }
    }
    return result;
}

const param = GetQueryString();
const acid = param["id"];

// ローカルサーバー対応版
//const wsUri = `ws://192.168.0.10:8082/?id=${acid}`;

// GitHub、render.com対応版
const wsUri = `wss://${location.host}/?id=${acid}`;

const socket = new WebSocket(wsUri);
let base64Image = null;
let clientId = null;    // クライアントID（P1、P2、waiting）
let queueNumber = 0;    // 順番待ち番号（waiting時に使用）

let isStartBattle = false; // 対戦開始フラグ（trueなら対戦中）

// 接続が開いた時
socket.onopen = () => {
    console.log("✅ WebSocket 接続成功" + acid);

    // identifyメッセージを送信
    const identifyMsg = {
        type: "identify",
        deviceType: "Mobile"
    };
    socket.send(JSON.stringify(identifyMsg));
};

// メッセージ受信時
socket.onmessage = (event) => {
    try {
        const data = JSON.parse(event.data);
        console.log("📥 メッセージ受信:", data);
        // IDの割り当てを受信
        if (data.type === 'assignId' && data.clientId) {
            clientId = data.clientId;
            console.log("🎫 ID:", clientId);
            
            queueNumber = data.queueNumber || 0; // 順番待ち番号を取得、なければ0をセット
        }

        // 誰かが切断されたことを受信
        else if (data.type === 'disconnected') {
            if (queueNumber > data.queueNumber) {
                queueNumber--; // 待機中の人が減ったので自分の番号を減らす
            }
        }

        // 自分が待機中なのを受信
        else if (data.type === 'waitingScene') {
            // ⭐ CPUと対戦するか選択画面を表示
            showWaitScreen("flex");
        }

        // 対戦が開始されたことを受信
        else if (data.type === 'startBattle') {
            isStartBattle = true; // 対戦開始フラグをセット
            showWaitScreen("none");
        }

        // 試合結果を受信
        else if (data.type === 'result') {
            if (data.player === "Draw") {
                showResultScreen("Draw"); // 引き分け
            }
            else if (data.player === clientId) {
                showResultScreen("win");  // 勝ち
            }
            else {
                showResultScreen("lose"); // 負け
            }
            console.log("🏆 試合結果:", data.player);
        }

        // リスタートを受信
        else if (data.type === 'restart') {
            isStartBattle = false; // 対戦終了フラグをリセット
        }

        // 強制切断を受信
        else if (data.type === 'forceDisconnect') {
            console.log("管理者により強制切断されました。");
            socket.close();
            handleDisconnection();
        }

    } catch (e) {
        console.log("JSON解析エラー:", e);
    }

    // 送信モードの時（mergeCanvasが表示されているかどうかで判定）
    if (mergeCanvas.style.display !== "none") {
        checkBattleStatus();
    }
};

// エラー発生時
socket.onerror = (error) => console.log("❌ WebSocketエラー:", error);

// 接続が閉じられた時
socket.onclose = (event) => console.log(`🔌 接続終了 (コード: ${event.code})`);

// ⭐ ブラウザが閉じられる/リロードされる時にWebSocket接続を切る
window.addEventListener('beforeunload', () => {
    if (socket.readyState === WebSocket.OPEN) {
        socket.close();
    }
});

// ⭐ 一定時間操作がない場合にWebSocket切断
let inactivityTimer = null;
const INACTIVITY_LIMIT = 3 * 60 * 1000; // n分（ミリ秒）
//const INACTIVITY_LIMIT = 5 * 1000; // 30秒（ミリ秒）デバッグ用

function resetInactivityTimer() {
    console.log("🕒 ユーザー操作検知 - タイマーリセット");
    if (inactivityTimer) clearTimeout(inactivityTimer);
    inactivityTimer = setTimeout(() => {
        if (socket.readyState === WebSocket.OPEN) {

            // 「CPUと対戦するか選択画面」が表示されているか、「swipeHintGif」が表示されていなかったら（待機状態）切断しない
            if (waitScreen.style.display === "flex" || swipeHintGif.style.display === "none") {
                console.log("🕒 待機中のため切断しない");
                resetInactivityTimer(); // 再度タイマー開始
                return;
            }

            console.log("⏰ 一定時間操作なしのためWebSocket切断");
            socket.close();
        }
    }, INACTIVITY_LIMIT);
}

// ユーザー操作イベントでタイマーリセット
["mousemove", "keydown", "touchstart", "click"].forEach(eventType => {
    window.addEventListener(eventType, resetInactivityTimer);
});

// ページ表示時にタイマー開始
resetInactivityTimer();

// ⭐ 画像送信
function sendImage() {
    base64Image = mergeCanvas.toDataURL("image/png");
    if (socket.readyState === WebSocket.OPEN && base64Image) {

        const playerID = acid + Math.floor(Math.random() * 10000).toString();

        var msg = {
            "type": "image",            // 送信タイプ
            "clientId": clientId,       // ID（P1かP2）
            "imageData": base64Image,   // 画像データ
            "playerID": playerID        // プレイヤーの識別番号(ユニークID)
        };

        try {
            socket.send(JSON.stringify(msg));
        } catch (e) {
            alert("申し訳ありません。お使いのブラウザでは動作しません。(websocket err)");
        }

        console.log("📤 画像送信:", msg);
    } else {
        console.log("WebSocket未接続または画像未取得");
    }
}

// ⭐ CPUと対戦することをサーバーに送信
function sendVsCPU() {
    if (socket.readyState === WebSocket.OPEN) {

        var msg = {
            "type": "vsCPU",       // 送信タイプ
            "clientId": clientId    // ID（P1かP2）
        };

        try {
            socket.send(JSON.stringify(msg));
        } catch (e) {
            alert("申し訳ありません。お使いのブラウザでは動作しません。(websocket err)");
        }

        console.log("📤 CPUと対戦:", msg);
    } else {
        console.log("WebSocket未接続");
    }
}

// ⭐ トントン送信
document.getElementById("tontonBtn").onclick = () => {

    if (socket.readyState === WebSocket.OPEN) {

        var msg = {
            "type": "tonton",       // 送信タイプ
            "clientId": clientId    // ID（P1かP2）
        };

        try {
            socket.send(JSON.stringify(msg));
        } catch (e) {
            alert("申し訳ありません。お使いのブラウザでは動作しません。(websocket err)");
        }

        console.log("📤 トントン送信:", msg);
    } else {
        console.log("WebSocket未接続");
    }
}

// ⭐ 続けることを送信
function sendContinue() {

    if (socket.readyState === WebSocket.OPEN) {

        var msg = {
            "type": "continue",       // 送信タイプ
            "clientId": clientId    // ID（P1かP2）
        };

        try {
            socket.send(JSON.stringify(msg));
        } catch (e) {
            alert("申し訳ありません。お使いのブラウザでは動作しません。(websocket err)");
        }

        console.log("📤 続けることを送信:", msg);
    } else {
        console.log("WebSocket未接続");
    }
}

// ⭐ やめることを送信
function sendGameQuit() {

    console.log("📤 やめることを送信");

    if (socket.readyState === WebSocket.OPEN) {

        var msg = {
            "type": "gameQuit",       // 送信タイプ
            "clientId": clientId    // ID（P1かP2）
        };

        try {
            socket.send(JSON.stringify(msg));

            // 送信後、100ms待ってから切断
            setTimeout(() => {
                socket.close();
            }, 100);
        } catch (e) {
            alert("申し訳ありません。お使いのブラウザでは動作しません。(websocket err)");
            socket.close();
        }

        console.log("📤 やめることを送信:", msg);
    } else {
        console.log("WebSocket未接続");
    }
}

// テスト
document.getElementById("testBtn2").onclick = () => {
    if (socket.readyState === WebSocket.OPEN) {
        socket.close();
    }
}
document.getElementById("testBtn3").onclick = () => {
    if (socket.readyState === WebSocket.OPEN) {
        socket.close();
    }
}
