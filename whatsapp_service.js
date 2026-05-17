import { makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } from '@whiskeysockets/baileys';
import QRCode from 'qrcode';
import WebSocket from 'ws';
import fs from 'fs';
import Pino from 'pino';
import * as dotenv from 'dotenv';
import dns from 'dns';

dotenv.config();

let sock;
let currentQr = null;
let isConnected = false;
let ws;
let isReconnecting = false;
let currentStatus = 'Starting...';

function updateStatus(status) {
    currentStatus = status;
    process.stdout.write(`\r\x1b[K[WhatsApp] ${status}`);
}

async function attemptReconnect() {
    if (isReconnecting) return;
    isReconnecting = true;

    const checkNetwork = () => new Promise(resolve => {
        dns.lookup('web.whatsapp.com', (err) => resolve(!err));
    });

    while (true) {
        const isOnline = await checkNetwork();
        if (isOnline) {
            updateStatus('Reconnecting...');
            await new Promise(res => setTimeout(res, 2000));
            isReconnecting = false;
            connectToWhatsApp();
            break;
        } else {
            updateStatus('Disconnected - Waiting for internet (Checking every 15s)...');
            await new Promise(res => setTimeout(res, 15000));
        }
    }
}

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('baileys_auth_info');
    const { version } = await fetchLatestBaileysVersion();
    
    sock = makeWASocket({
        version,
        auth: state,
        logger: Pino({ level: 'silent' }),
        browser: ['Ubuntu', 'Chrome', '110.0.5481.104'], // Explicit browser string often fixes the 405 error
    });

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            currentQr = await QRCode.toDataURL(qr);
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'whatsapp_qr', data: currentQr }));
            }
        }
        
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) {
                updateStatus('Disconnected');
                attemptReconnect();
            } else {
                updateStatus('Logged out. Clearing auth info to generate new QR...');
                console.log(); // print newline
                try { fs.rmSync('baileys_auth_info', { recursive: true, force: true }); } catch (e) {}
                currentQr = null;
                isConnected = false;
                if (ws && ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ type: 'whatsapp_disconnected' }));
                }
                setTimeout(connectToWhatsApp, 2000);
            }
        } else if (connection === 'open') {
            updateStatus('Connected');
            isConnected = true;
            currentQr = null;
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'whatsapp_connected' }));
            }
        }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async (m) => {
        if (m.type !== 'notify') return;
        for (const msg of m.messages) {
            if (!msg.key.fromMe && msg.message) {
                const text = msg.message.conversation || msg.message.extendedTextMessage?.text;
                if (text) {
                    console.log(`\nReceived message: ${text} from ${msg.key.remoteJid}`);
                    updateStatus(currentStatus); // restore status line
                    if (ws && ws.readyState === WebSocket.OPEN) {
                        ws.send(JSON.stringify({
                            type: 'whatsapp_message',
                            data: text,
                            number: msg.key.remoteJid,
                            name: msg.pushName || 'Unknown'
                        }));
                    }
                }
            }
        }
    });
}

function connectToBroker() {
    const token = process.env.APP_SECRET_TOKEN || '';
    ws = new WebSocket(`ws://localhost:8765?token=${encodeURIComponent(token)}`);
    
    ws.on('open', () => {
        console.log('Connected to broker WebSocket');
        // Announce current status
        if (isConnected) {
            ws.send(JSON.stringify({ type: 'whatsapp_connected' }));
        } else if (currentQr) {
            ws.send(JSON.stringify({ type: 'whatsapp_qr', data: currentQr }));
        }
    });
    
    ws.on('message', async (dataStr) => {
        try {
            const payload = JSON.parse(dataStr);
            
            // Re-broadcast status if requested
            if (payload.type === 'request_whatsapp_status') {
                if (isConnected) {
                    ws.send(JSON.stringify({ type: 'whatsapp_connected' }));
                } else if (currentQr) {
                    ws.send(JSON.stringify({ type: 'whatsapp_qr', data: currentQr }));
                }
            }
            
            // Listen for agent wanting to send a message
            if (payload.type === 'send_whatsapp_message') {
                if (isConnected && sock) {
                    // WhatsApp uses format: number@s.whatsapp.net
                    let number = payload.number;
                    if (!number.includes('@')) {
                        number = `${number.replace(/[^0-9]/g, '')}@s.whatsapp.net`;
                    }
                    console.log(`Sending message to ${number}: ${payload.message}`);
                    await sock.sendMessage(number, { text: payload.message });
                } else {
                    console.log('Cannot send message, WhatsApp not connected.');
                }
            }
        } catch (e) {
            console.error('Error handling broker message:', e);
        }
    });

    ws.on('close', () => {
        console.log('Disconnected from broker, retrying in 3s...');
        setTimeout(connectToBroker, 3000);
    });
    
    ws.on('error', () => {
        ws.close();
    });
}

connectToWhatsApp();
connectToBroker();
