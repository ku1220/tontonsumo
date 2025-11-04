const PORT = 8082;
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
};