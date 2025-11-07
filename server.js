// GitHub、render.com対応版 WebSocketサーバー ///////////////////////
import express from "express";
import { WebSocketServer } from "ws";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// RankingDataフォルダを公開（確認用）
app.use("/RankingData", express.static(path.join(__dirname, "RankingData")));
// ← Unityビルドのフォルダを公開
app.use(express.static(path.join(__dirname, "SumoBattleContents")));

const server = http.createServer(app);

// WebSocketサーバー
const wss = new WebSocketServer({ server });

// クライアント管理用
const clients = new Map();
const waitingQueue = []; // 待機中のクライアントを管理

let isStartBattle = false; // 対戦開始フラグ

// render.comはPORTが必須
const port = process.env.PORT || 3000;
server.listen(port, () => console.log("running on", port));
//////////////////////////////////////////////////////////////////

/*
// Node.js用 WebSocket サーバー（無料）
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const ip = require('ip');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = 8082;
const IP = ip.address(); // ローカルIPアドレス取得

// クライアント管理用
const clients = new Map();
const waitingQueue = []; // 待機中のクライアントを管理

let isStartBattle = false; // 対戦開始フラグ

// 静的ファイル配信（publicフォルダ）
app.use(express.static('SumoBattleContents'));

// サーバー起動
server.listen(PORT, () => {
  console.log(`HTTP:  http://${IP}:${PORT}`);
  console.log(`WebSocket: ws://${IP}:${PORT}`);
});
*/

// WebSocketの接続処理
wss.on('connection', (ws) => {

  // ws.clientId で管理
  ws.clientId = null;

  // 最初のメッセージでデバイス種別を受け取る
  ws.on('message', function handleFirstMessage(message) {
    try {
      const data = JSON.parse(message);
      console.log('Received data:', data);

      // typeが"identify"
      if (data.type === 'identify') {
        // デバイス種別でIDを割り当て
        if (data.deviceType === 'PC') {
          ws.clientId = 'PC';  // PC
        } 
        else if (data.deviceType === 'Mobile') {
          // 試合中は全てwaiting
          if (isStartBattle) {
            waitingQueue.push(ws);
            ws.clientId = "waiting";
          }
          else {
            if (!clients.has('P1')) {
              ws.clientId = 'P1';  // プレイヤー1
            } else if (!clients.has('P2')) {
              ws.clientId = 'P2';  // プレイヤー2
            } else {
              waitingQueue.push(ws);
              ws.clientId = "waiting"; // すでに2人いる場合は待機中
            }
          }
        } 
        else {
          ws.send(JSON.stringify({ type: 'error', message: '不明なデバイス種別です' }));
          return;
        }
      } 

      // clientIdがセットされている場合のみ登録・通知
      if (ws.clientId) {
        // クライアントを登録
        if (ws.clientId !== "waiting") {
          clients.set(ws.clientId, ws);
        }
        ws.send(JSON.stringify({ type: 'assignId', clientId: ws.clientId, queueNumber: waitingQueue.length }));
        console.log(`Client connected: ${ws.clientId}`);
      }

      // この一時リスナーを解除
      ws.removeListener('message', handleFirstMessage);

      // 2回目以降のメッセージ受信処理を追加
      ws.on('message', function relayMessage(message) {
        try {
          // Mobile→PCへ画像データを転送
          if (ws.clientId === 'P1' || ws.clientId === 'P2') {

            // サーバーに画像を保存
            const msgObj = JSON.parse(message);
            if (msgObj.type === "image" && msgObj.imageData) {
              const base64Data = msgObj.imageData.replace(/^data:image\/\w+;base64,/, "");
              const buffer = Buffer.from(base64Data, "base64");
              const filename = `received_${Date.now()}.png`;
              fs.writeFileSync(`./RankingData/${filename}`, buffer);
              console.log("画像保存:", filename);
            }

            // 画像や操作データをPCに転送
            sendToClient('PC', message);
          }

          // PC→P1、P2へ転送
          else if (ws.clientId === 'PC') {
            // Buffer型の場合は文字列に変換
            let msgStr = message;
            if (Buffer.isBuffer(message)) {
              msgStr = message.toString('utf8');
            }

            // JSONとしてパース
            let msgObj;
            try {
              msgObj = JSON.parse(msgStr);
            } catch (e) {
              msgObj = {};
            }

            // プレイヤーが待機していることを受信
            if (msgObj.type === 'waitingScene') {
              sendToClient(msgObj.player, msgStr);
              return;
            }
            
            // 対戦開始フラグをセット
            else if (msgObj.type === 'startBattle') isStartBattle = true;

            // 試合結果を受信
            else if (msgObj.type === 'result') {
              // P1がCPUの場合
              if (msgObj.cpuState === 1) {
                sendToClient('P2', msgStr);
                return; // P2にのみ送信
              }
              // P2がCPUの場合
              else if (msgObj.cpuState === 2) {
                sendToClient('P1', msgStr);
                return; // P1にのみ送信
              }
            }

            // リスタートを受信
            else if (msgObj.type === 'restart') {
              isStartBattle = false; // 対戦終了フラグをリセット
              promoteWaitingPlayers();  // プレイヤー追加処理
            }

            if (clients.has('P1')) sendToClient('P1', msgStr);
            if (clients.has('P2')) sendToClient('P2', msgStr);
          }
        } catch (e) {
          console.log('Invalid relay message:', message);
        }
      });

    } catch (e) {
      console.log('Invalid message:', message);
    }
  });

  // 特定のクライアントに送信する
  function sendToClient(targetId, message) {
    console.log(`Sending to ${targetId}:`, message);
    const client = clients.get(targetId);
    if (client && client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }

  // 全クライアントに送信する（PCには送信しない）
  function sendToAllClients(message) {
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN && client.clientId !== 'PC') {
        client.send(message);
      }
    });
  }

  // プレイヤー追加処理
  function promoteWaitingPlayers() {
    ['P1', 'P2'].forEach(id => {
      if (!clients.has(id) && waitingQueue.length > 0) {
        let nextWs = null;
        // 切断済みのWebSocketをスキップ
        while (waitingQueue.length > 0) {
          nextWs = waitingQueue.shift();  // 配列から最初の要素を取り除く
          if (nextWs.readyState === WebSocket.OPEN) break;
          nextWs = null;
        }
        if (nextWs) {
          nextWs.clientId = id;
          clients.set(id, nextWs);
          nextWs.send(JSON.stringify({
            type: 'assignId',
            clientId: id,
            queueNumber: waitingQueue.length
          }));
          console.log(`Waiting client promoted to: ${id}`);

          // 新しいクライアントにもrelayMessageを設定
          nextWs.on('message', function relayMessage(message) {
            try {
              const data = JSON.parse(message);
              if (nextWs.clientId === 'P1' || nextWs.clientId === 'P2') {
                sendToClient('PC', message);
              }
            } catch (e) {
              console.log('Invalid relay message:', message);
            }
          });
        }
      }
    });
  }

  // 切断時の処理
  ws.on('close', () => {
    if (ws.clientId && ws.clientId !== "waiting") {
      clients.delete(ws.clientId);
      console.log(`切断されました: ${ws.clientId}`);

      // P1またはP2が切断された場合、待機キューから次のクライアントを割り当て
      if ((ws.clientId === 'P1' || ws.clientId === 'P2') && waitingQueue.length > 0) {
        promoteWaitingPlayers();
      }
    }
    else if (ws.clientId === "waiting") {
      // 待機中のクライアントが切断された場合、キューから削除
      const index = waitingQueue.indexOf(ws);
      if (index !== -1) {
        waitingQueue.splice(index, 1);
        console.log(`Waiting client disconnected: ${ws.clientId}`);
      }
    }

    // 他のクライアントに切断通知を送信（プレイヤーが残っている場合のみ）
    const noPlayers = !clients.has('P1') && !clients.has('P2');
    if (!noPlayers) {
      sendToAllClients(JSON.stringify({ type: 'disconnected', queueNumber: waitingQueue.length }));
    }

    // 誰も接続するプレイヤーがいなくなったらPCに通知
    if (noPlayers) {
      sendToClient('PC', JSON.stringify({ type: 'noPlayers' }));
    }
  });
});
