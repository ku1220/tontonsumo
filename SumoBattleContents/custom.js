// ローカルサーバー対応版
/*const PORT = 8082;
const IP = "192.168.0.6";

window.GetWebSocketURLFromExternal = function () {
  acid = Math.floor(Math.random() * 1000 + 1);
  var wsUri = `ws://${IP}:${PORT}/?id=` + acid;
  console.log("acid : " + acid);
  console.log("📡 [custom.js] WebSocket URL:", wsUri);
  return wsUri;
};

window.GetQRCodeURLFromExternal = function () {

  var qrUrl = `http://${IP}:${PORT}/Mobile/SumoBattleSend.html?id=`;
  return qrUrl + acid;
};*/


// GitHub、render.com対応版
let acid = Date.now(); // unique ID （乱数でもOK）

window.GetWebSocketURLFromExternal = function () {

  // Render.com のURLから自動取得
  var wsUri = `wss://${location.host}/?id=${acid}`;

  console.log("📡 [custom.js] WebSocket URL:", wsUri);
  return wsUri;
};

window.GetQRCodeURLFromExternal = function () {

  // PCが開いているURLを元に生成すればOK
  var qrUrl = `https://${location.host}/Mobile/SumoBattleSend.html?id=${acid}`;
  return qrUrl;
};

// ランキングデータ取得用URL
