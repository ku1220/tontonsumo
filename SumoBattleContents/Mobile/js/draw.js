// ⭐ 状態管理変数
let currentTool = 'brush';
let color = 'rgb(0, 0, 0)';
let lineWidth = 8;
let alpha = 1;
let blurStrength = 0;
let eraser = false;

// 描画用キャンバス
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

// 背景用キャンバス
const bgCanvas = document.getElementById("bgCanvas");
const bgCtx = bgCanvas.getContext("2d");

// ガイド用キャンバス
const guideCanvas = document.getElementById("guidecanvas");
const guideCtx = guideCanvas.getContext("2d");

// 合成画像表示用キャンバス
const mergeCanvas = document.getElementById("mergecanvas");
const mergeCtx = mergeCanvas.getContext("2d");

const buffer = document.createElement("canvas");
buffer.width = canvas.width;
buffer.height = canvas.height;
const bctx = buffer.getContext("2d");

let drawing = false;
let lastX = 0, lastY = 0;
const history = [];
let historyStep = -1;

function saveHistory() {
  if (historyStep < history.length - 1) history.splice(historyStep + 1);
  history.push(canvas.toDataURL());
  if (history.length > 50) history.shift();
  else historyStep++;
}

function undo() {
  if (historyStep > 0) restoreHistory(--historyStep);
}

function redo() {
  if (historyStep < history.length - 1) restoreHistory(++historyStep);
}

function restoreHistory(step) {
  const img = new Image();
  img.src = history[step];
  img.onload = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);
  };
}

function clearCanvas() {
  //ctx.clearRect(0, 0, canvas.width, canvas.height);
  setSampleImage(); // 初期背景画像
  //saveHistory();
}

// ⭐ 画像保存機能（未使用）
function saveImage() {
    const link = document.createElement('a');
    link.href = canvas.toDataURL("image/png");
    link.download = "drawing.png";
    link.click();
}

// ⭐ ツール切り替え
function setTool(tool) {
  currentTool = tool;
  eraser = (tool === 'eraser');
  document.querySelectorAll('.tool-button').forEach(b => b.classList.remove('active'));
  document.getElementById('tool-' + tool).classList.add('active');
}

// ボタンのイベントを登録
document.getElementById('tool-brush').onclick = () => setTool('brush');
document.getElementById('tool-eraser').onclick = () => setTool('eraser');
document.getElementById('tool-fill').onclick = () => setTool('fill');
document.getElementById('tool-picker').onclick = () => setTool('picker');
document.getElementById('undoBtn').onclick = () => undo();
document.getElementById('redoBtn').onclick = () => redo();
document.getElementById('clearBtn').onclick = () => clearCanvas();
document.getElementById('saveBtn').onclick = () => renderSendUI();

// ⭐ 背景画像の読み込み
const bgimg = document.getElementById('bgImage');
let baseImageData = null;

// ⭐ 背景画像の描画
function drawBgImage() {
    bgCtx.clearRect(0, 0, canvas.width, canvas.height);
    bgCtx.drawImage(bgimg, 0, 0, canvas.width, canvas.height);
    baseImageData = bgCtx.getImageData(0, 0, canvas.width, canvas.height);
    saveHistory();
}
bgimg.onload = drawBgImage;
if (bgimg.complete) drawBgImage();

// ⭐ 不透明部分判定関数
function isOpaque(x, y) {
    if (!baseImageData) return true; // 画像未ロード時は全て描画可
    const idx = (Math.floor(y) * canvas.width + Math.floor(x)) * 4 + 3; // α値
    return baseImageData.data[idx] > 10; // α値10以上を不透明とみなす
}

// ⭐ サンプル画像の読み込みと描画
let sampleImg = new Image();

function setSampleImage() {
    sampleImg.src = 'img/SampleImage.png';
    sampleImg.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(sampleImg, 0, 0, canvas.width, canvas.height);
    };
}

// ⭐ 描画関数
function drawLine(x, y) {
    if (currentTool !== 'brush' && !eraser) return;

    // 不透明部分のみ描画
    if (!isOpaque(x, y)) {
        lastX = x;
        lastY = y;
        return;
    }

    bctx.clearRect(0, 0, canvas.width, canvas.height);
    bctx.beginPath();
    bctx.moveTo(lastX, lastY);
    bctx.lineTo(x, y);
    bctx.lineWidth = lineWidth;
    bctx.lineCap = "round";
    bctx.lineJoin = "round";

    if (eraser) {
        bctx.globalCompositeOperation = "source-over";
        bctx.strokeStyle = "rgba(0,0,0,1)";
        bctx.shadowBlur = 0;
        bctx.stroke();
        ctx.globalCompositeOperation = "destination-out";
        ctx.drawImage(buffer, 0, 0);
        ctx.globalCompositeOperation = "source-over";
    } else {
        bctx.globalCompositeOperation = "source-over";
        bctx.strokeStyle = color;
        bctx.shadowBlur = blurStrength;
        bctx.shadowColor = color;
        bctx.stroke();
        ctx.globalAlpha = alpha;
        ctx.drawImage(buffer, 0, 0);
        ctx.globalAlpha = 1.0;
    }

    lastX = x;
    lastY = y;
}

// ⭐ ガイド画像の読み込み
const guideimg = document.getElementById('guideImage');

// ⭐ ガイド画像の描画
function drawGuideImage() {
    guideCtx.clearRect(0, 0, canvas.width, canvas.height);
    guideCtx.drawImage(guideimg, 0, 0, canvas.width, canvas.height);
    saveHistory();
}
guideimg.onload = drawGuideImage;
if (guideimg.complete) drawGuideImage();

// ⭐ マウス・タッチイベント
canvas.addEventListener("mousedown", e => {
  if (currentTool !== 'brush' && !eraser) return;
  drawing = true;
  const rect = canvas.getBoundingClientRect();
  lastX = (e.clientX - rect.left) * (canvas.width / rect.width);
  lastY = (e.clientY - rect.top) * (canvas.height / rect.height);
});
canvas.addEventListener("mousemove", e => {
  if (!drawing) return;
  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) * (canvas.width / rect.width);
  const y = (e.clientY - rect.top) * (canvas.height / rect.height);
  drawLine(x, y);
});
canvas.addEventListener("mouseup", () => {
  if (drawing) {
    drawing = false;
    saveHistory();
  }
});
canvas.addEventListener("touchstart", e => {
  if (e.touches.length > 1 || isPinching) return;   // 2本指以上なら描画しない

  if (currentTool !== 'brush' && !eraser) return;
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const touch = e.touches[0];
  lastX = (touch.clientX - rect.left) * (canvas.width / rect.width);
  lastY = (touch.clientY - rect.top) * (canvas.height / rect.height);
  drawing = true;
});
canvas.addEventListener("touchmove", e => {
  if (e.touches.length > 1 || !drawing || isPinching) return;
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const touch = e.touches[0];
  const x = (touch.clientX - rect.left) * (canvas.width / rect.width);
  const y = (touch.clientY - rect.top) * (canvas.height / rect.height);
  drawLine(x, y);
});
canvas.addEventListener("touchend", () => {
  if (drawing) {
    drawing = false;
    saveHistory();
  }
});

// ⭐ カラーピッカーとスウォッチ（5個固定）
const swatches = document.getElementById("colorSwatches");
let swatchColors = ["#ffffff", "#ffffff", "#ffffff", "#ffffff", "#ffffff"];

function renderSwatches() {
    swatches.innerHTML = "";
    swatchColors.forEach((col, i) => {
        const div = document.createElement("div");
        div.className = "swatch";
        div.style.background = col;
        div.title = col;

        div.onclick = () => {
            color = col;
            //document.getElementById('colorPicker').value = col;
            document.getElementById('colorPicker-icon').style.backgroundColor = col;
        };
        swatches.appendChild(div);
    });
}
renderSwatches();

document.getElementById('saveColorBtn').onclick = () => {
    // 現在の色をスウォッチに保存（5個まで、古い順に上書き）
    swatchColors.shift();
    swatchColors.push(color);
    renderSwatches();
};

document.getElementById('colorPicker').oninput = e => {
    color = e.target.value;
    document.getElementById('colorPicker-icon').style.backgroundColor = color;
};

document.getElementById('lineWidth').oninput = e => {
    lineWidth = +e.target.value;
    document.getElementById('lineNum').value = lineWidth;
};
document.getElementById('lineNum').oninput = e => {
    lineWidth = +e.target.value;
    document.getElementById('lineWidth').value = lineWidth;
};
document.getElementById('alphaRange').oninput = e => {
    alpha = +e.target.value;
    document.getElementById('alphaNum').value = alpha;
};
document.getElementById('alphaNum').oninput = e => {
    alpha = +e.target.value;
    document.getElementById('alphaRange').value = alpha;
};
document.getElementById('blurRange').oninput = e => {
    blurStrength = +e.target.value;
    document.getElementById('blurNum').value = blurStrength;
};
document.getElementById('blurNum').oninput = e => {
    blurStrength = +e.target.value;
    document.getElementById('blurRange').value = blurStrength;
};


// ⭐ スポイト機能
canvas.addEventListener('click', e => {
    if (currentTool !== 'picker') return;
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) * (canvas.width / rect.width));
    const y = Math.floor((e.clientY - rect.top) * (canvas.height / rect.height));
    const pixel = ctx.getImageData(x, y, 1, 1).data;
    color = `rgba(${pixel[0]},${pixel[1]},${pixel[2]},${pixel[3] / 255})`;
    //document.getElementById('colorPicker').value = `#${((1 << 24) + (pixel[0] << 16) + (pixel[1] << 8) + pixel[2]).toString(16).slice(1)}`;
    document.getElementById('colorPicker-icon').style.backgroundColor = color;
    setTool('brush');
});

// ⭐ 塗りつぶし機能
function floodFill(x, y, fillColor) {
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    const width = canvas.width;
    const height = canvas.height;
    const targetIdx = (y * width + x) * 4;
    const targetColor = data.slice(targetIdx, targetIdx + 4);

    // ⭐ 色の差分を許容する比較関数（アンチエイリアス対応）
    const colorThreshold = 20; // 差分の許容値（0～255）
    const colorDistance = (i) => {
        return Math.abs(data[i] - targetColor[0]) +
            Math.abs(data[i + 1] - targetColor[1]) +
            Math.abs(data[i + 2] - targetColor[2]) +
            Math.abs(data[i + 3] - targetColor[3]);
    };

    // ⭐ 塗りたい色が似ている場合は塗らない（無限ループ回避）
    const [r, g, b, a] = fillColor;
    if (
        Math.abs(r - targetColor[0]) < colorThreshold &&
        Math.abs(g - targetColor[1]) < colorThreshold &&
        Math.abs(b - targetColor[2]) < colorThreshold &&
        Math.abs(a - targetColor[3]) < colorThreshold
    ) return;

    const visited = new Uint8Array(width * height);
    const stack = [[x, y]];

    while (stack.length) {
        const [cx, cy] = stack.pop();
        const idx = (cy * width + cx) * 4;
        const vIdx = cy * width + cx;
        if (visited[vIdx]) continue;
        if (colorDistance(idx) > colorThreshold) continue;

        // ★ 不透明部分のみ塗りつぶし
        if (!isOpaque(cx, cy)) continue;

        visited[vIdx] = 1;
        data[idx] = r;
        data[idx + 1] = g;
        data[idx + 2] = b;
        data[idx + 3] = a;

        if (cx > 0) stack.push([cx - 1, cy]);
        if (cx < width - 1) stack.push([cx + 1, cy]);
        if (cy > 0) stack.push([cx, cy - 1]);
        if (cy < height - 1) stack.push([cx, cy + 1]);
    }

    ctx.putImageData(imageData, 0, 0);
}

canvas.addEventListener('click', e => {
    if (currentTool !== 'fill') return;
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) * (canvas.width / rect.width));
    const y = Math.floor((e.clientY - rect.top) * (canvas.height / rect.height));
    const tmp = document.createElement('canvas');
    const tmpCtx = tmp.getContext('2d');
    tmpCtx.fillStyle = color;
    tmpCtx.fillRect(0, 0, 1, 1);
    const c = tmpCtx.getImageData(0, 0, 1, 1).data;
    floodFill(x, y, c);
    saveHistory();
});

// ⭐ ズーム・パン関連の変数
let scale = 1, translateX = 0, translateY = 0;
let lastTouchDist = null;
let lastPan = null;
let isPinching = false;

// ⭐ キャンバスのtransformを適用する関数
function applyTransform() {
    canvas.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
    bgCanvas.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
    guideCanvas.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
    mergeCanvas.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
}

// ⭐ 2本指の距離を計算
function getDistance(touches) {
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.sqrt(dx * dx + dy * dy);
}
function getMidPoint(touches) {
  return {
    x: (touches[0].clientX + touches[1].clientX) / 2,
    y: (touches[0].clientY + touches[1].clientY) / 2
  };
}

const canvasWrapper = document.getElementById('main');
canvasWrapper.addEventListener("touchstart", (e) => {
  if (e.touches.length === 2) {
    isPinching = true;
    lastTouchDist = getDistance(e.touches);
    lastPan = getMidPoint(e.touches);
  }
}, { passive: false });

canvasWrapper.addEventListener("touchmove", (e) => {
  if (e.touches.length === 2) {
    e.preventDefault();
    const newDist = getDistance(e.touches);
    const mid = getMidPoint(e.touches);

    // ピンチズーム
    scale *= newDist / lastTouchDist;
    scale = Math.max(0.5, Math.min(scale, 5));  // 最小・最大スケール制限

    // パン（移動）
    translateX += mid.x - lastPan.x;
    translateY += mid.y - lastPan.y;

    applyTransform();
    lastTouchDist = newDist;
    lastPan = mid;
  }
}, { passive: false });

canvasWrapper.addEventListener("touchend", (e) => {
    if (e.touches.length < 2) {
        isPinching = false;
        lastTouchDist = null;
        lastPan = null;
    }
});

window.onload = () => {
    setSampleImage(); // 初期背景画像
    saveHistory(); // 初期状態を保存
};

// ⭐ 決定ボタン後の操作と戻るボタンの実装
const sendMenu = document.getElementById("sendMenu");
const backBtn = document.getElementById("backBtn");
const topMenu = document.getElementById("topMenu");
const bottomMenu = document.getElementById("bottomMenu");
const tontonScreen = document.getElementById("tontonScreen");   // ⭐ トントン画面

let isSendMode = false;     // 送信モードフラグ
let alreadySent = false;    // 送信済みフラグ

backBtn.onclick = () => {
    isSendMode = false;
    alreadySent = false;
    topMenu.style.display = "flex";
    bottomMenu.style.display = "flex";
    sendMenu.style.display = "none";
    canvas.style.removeProperty('display');  // お絵描き部分表示
    bgCanvas.style.removeProperty('display');  // 背景表示
    guideCanvas.style.removeProperty('display');  // ガイド表示
    mergeCanvas.style.display = "none";  // 合成画像非表示

    // ⭐ キャンバスを中央に戻す処理
    scale = 1;
    translateX = 0;
    translateY = 0;
    applyTransform();
};

const swipeLabel = document.getElementById('swipeLabel');

// ⭐ 送信UIの表示と操作
function renderSendUI() {
    topMenu.style.display = "none";
    bottomMenu.style.display = "none";
    canvas.style.display = "none";  // お絵描き部分非表示
    bgCanvas.style.display = "none";  // 背景非表示
    guideCanvas.style.display = "none";  // ガイド非表示
    sendMenu.style.display = "flex";

    showOriginalAndFlippedOnAnotherCanvas();  // ⭐ 別キャンバスに横並び表示

    // ⭐ キャンバスを中央に戻す処理
    scale = 1;
    translateX = 0;
    translateY = -100;  // 少し上に移動して見やすくする
    applyTransform();

    checkBattleStatus();
}

// ⭐ 対戦中かどうかのチェック
function checkBattleStatus() {

    // 対戦中の場合は待ち状態にする
    if (clientId == "waiting" || isStartBattle) {
        isSendMode = false;  // 送信モードを無効化
        swipeHintGif.style.display = "none";  // スワイプヒントGIF非表示
        swipeLabel.innerHTML = "他のプレイヤーが対戦中です。<br>しばらくお待ちください。<br>あなたの番まであと" + queueNumber + "人";
    }
    else {
        isSendMode = true;  // 送信モードを有効化
        swipeHintGif.style.removeProperty('display');  // スワイプヒントGIF表示
        swipeLabel.innerHTML = "上にスワイプして土俵に送ろう！";
    }
}

// ⭐ 元画像＋左右反転画像を一つの画像として別キャンバスに描画
function showOriginalAndFlippedOnAnotherCanvas() {

    mergeCanvas.style.display = "block";  // 表示する

    // 1. 元画像を一時キャンバスにコピー
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(canvas, 0, 0);

    // 2. 表示用キャンバスを取得・サイズ設定
    mergeCtx.clearRect(0, 0, mergeCanvas.width, mergeCanvas.height);

    // 3. 左側に元画像
    mergeCtx.drawImage(tempCanvas, 0, 0);

    // 4. 右側に左右反転画像
    mergeCtx.save();
    mergeCtx.translate(canvas.width * 2, 0); // 右端に移動
    mergeCtx.scale(-1, 1); // 左右反転
    mergeCtx.drawImage(tempCanvas, 0, 0);
    mergeCtx.restore();
}

// ⭐ CPUと対戦するか選択画面
const waitScreen = document.getElementById("waitScreen");

function showWaitScreen(isDisplay) {
    waitScreen.style.display = isDisplay; // 画面表示
}
// ⭐ CPUと対戦するボタン
document.getElementById("battleCPUBtn").onclick = () => {
    waitScreen.style.display = "none"; // 画面非表示

    // CPUと対戦することをサーバーに送信
    sendVsCPU();
}

// ⭐ 画像送信処理
const container = document.getElementById("container"); // お絵描き部分のコンテナ
const compImage = document.getElementById('compImage'); // 合成画像を表示するimg要素（トントン画面）

document.addEventListener("touchstart", e => {
    if (e.touches.length === 1) touchStartY = e.touches[0].clientY;
});
document.addEventListener("touchend", e => {
    if (touchStartY !== null && e.changedTouches.length === 1) {
        const deltaY = touchStartY - e.changedTouches[0].clientY;
        if (deltaY > 200 && isSendMode && !alreadySent) {

            // // ⭐ 一度だけ送信可能に
            alreadySent = true;

            // ⭐ アニメーションして送信
            mergeCanvas.classList.add("canvas-slide-up");

            // ⭐ 送信後の処理
            setTimeout(() => {
                sendImage();
                // ⭐ 合成画像をトントン画面に表示
                compImage.src = mergeCanvas.toDataURL("image/png");
                // ⭐ トントン画面を表示
                tontonScreen.classList.add("show");
                // ⭐ お絵描き部分を非表示
                container.style.display = "none"; // お絵描き部分非表示
                // ⭐ その他のUIを無効化
                sendMenu.style.display = "none";
            }, 600);    // アニメーション時間に合わせる
        }
        touchStartY = null;
    }
});

// ⭐ 試合終了
const winTextImage = document.getElementById('winTextImage');   // 勝ち画像
const loseTextImage = document.getElementById('loseTextImage'); // 負け画像
const drawTextImage = document.getElementById('drawTextImage'); // 引き分け画像
const resultButtonArea = document.getElementById('resultButtonArea'); // 続ける・終了ボタンエリア
const resultLabel = document.getElementById('resultLabel');

function showResultScreen(result) {
    // 勝ち
    if (result === "win") {
        winTextImage.style.display = "block";  // 勝ち画像表示
        loseTextImage.style.display = "none";  // 負け画像非表示
        drawTextImage.style.display = "none";  // 引き分け画像非表示
        resultButtonArea.style.display = "flex"; // 続ける・終了ボタンエリア表示
        resultLabel.innerHTML = "おめでとうございます！<br>引き続き対戦しますか？"; // 勝ちメッセージ
    }
    // 負け 
    else if (result === "lose") {
        winTextImage.style.display = "none";   // 勝ち画像非表示
        loseTextImage.style.display = "block"; // 負け画像表示
        drawTextImage.style.display = "none";  // 引き分け画像非表示
        resultButtonArea.style.display = "none"; // 続ける・終了ボタンエリア非表示
        resultLabel.innerHTML = "ありがとうございました。<br>また挑戦してね！"; // 負けメッセージ
        socket.close(); // 切断
    }
    else {
        winTextImage.style.display = "none";   // 勝ち画像非表示
        loseTextImage.style.display = "none";   // 負け画像非表示
        drawTextImage.style.display = "block"; // 引き分け画像表示
        resultButtonArea.style.display = "none"; // 続ける・終了ボタンエリア非表示
        resultLabel.innerHTML = "ありがとうございました。<br>また挑戦してね！"; // 引き分けメッセージ
        socket.close(); // 切断
    }
    // ⭐ 勝敗画面を表示
    resultScreen.classList.add("show");
}

// ⭐ 続けるボタン
document.getElementById("continueBtn").onclick = () => {
    resultScreen.classList.remove("show"); // 勝敗画面非表示
    showWaitScreen("flex");     // CPUと対戦するか選択画面を表示

    // 続けることをサーバーに送信
    sendContinue();
}

// ⭐ やめるボタン
document.getElementById("endBtn").onclick = () => {

    resultButtonArea.style.display = "none"; // 続ける・終了ボタンエリア非表示
    resultLabel.innerHTML = "ありがとうございました。<br>また挑戦してね！";
    sendGameQuit(); // やめることをサーバーに送信
}

// テスト
document.getElementById("testBtn").onclick = () => {

    compImage.src = mergeCanvas.toDataURL("image/png");

    container.style.display = "none"; // お絵描き部分非表示
    // ⭐ トントン画面を表示
    tontonScreen.classList.add("show");
    showWaitScreen("flex");
    // ⭐ その他のUIも完全に無効化（必要に応じて）
    sendMenu.style.display = "none";
}
//

// ⭐ トップに戻るボタンの実装（いらないかもしれない）
/*document.getElementById("returnTopBtn").onclick = () => {
    // 初期状態に戻す
    isSendMode = false;
    alreadySent = false;

    // UI表示
    topMenu.style.display = "flex";
    bottomMenu.style.display = "flex";
    sendMenu.style.display = "none";
    tontonScreen.classList.remove("show");

    // キャンバスをクリア
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 履歴をリセット
    history.length = 0;
    historyStep = -1;
    saveHistory();  // 空状態を履歴に保存

    // スケール・位置をリセット
    scale = 1;
    translateX = 0;
    translateY = 0;
    applyTransform();

    // ブラシ設定をリセット
    lineWidth = 8;
    alpha = 1;
    blurStrength = 0;

    document.getElementById("lineWidth").value = lineWidth;
    document.getElementById("lineNum").value = lineWidth;
    document.getElementById("alphaRange").value = alpha;
    document.getElementById("alphaNum").value = alpha;
    document.getElementById("blurRange").value = blurStrength;
    document.getElementById("blurNum").value = blurStrength;

    // ツールリセット（ブラシ）
    setTool("brush");

    // カラーピッカーと履歴リセット
    color = "rgb(0, 0, 0)";
    document.getElementById('colorPicker-icon').style.backgroundColor = color;
    swatchColors = ["#ffffff", "#ffffff", "#ffffff", "#ffffff", "#ffffff"];
    renderSwatches();

    // アニメーションクラスを外す
    mergeCanvas.classList.remove("canvas-slide-up");
};*/