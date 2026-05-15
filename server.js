const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.static(__dirname));

// Veri deposu
let sensorHistory = [];
let totalCount = 0;
let lastValue = null;
let serialConnected = false;
let alerts = [];

// Admin kullanıcılar
const ADMIN_USER = 'admin';
const ADMIN_PASS = '1234';

// Admin API
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (username === ADMIN_USER && password === ADMIN_PASS) {
    res.json({ ok: true });
  } else {
    res.status(401).json({ ok: false, error: 'Hatalı giriş' });
  }
});

app.get('/api/durum', (req, res) => {
  res.json({
    bagli: serialConnected,
    toplamUrun: totalCount,
    sonDeger: lastValue,
    sonGuncelleme: new Date().toISOString()
  });
});

app.get('/api/gecmis', (req, res) => {
  res.json(sensorHistory.slice(0, 100));
});

app.post('/api/sifirla', (req, res) => {
  sensorHistory = [];
  totalCount = 0;
  lastValue = null;
  alerts = [];
  io.emit('reset');
  res.json({ ok: true });
});

app.get('/api/istatistik', (req, res) => {
  const now = Date.now();
  const son1dk = sensorHistory.filter(h => h.algilandi && now - new Date(h.zaman).getTime() < 60000).length;
  const son1saat = sensorHistory.filter(h => h.algilandi && now - new Date(h.zaman).getTime() < 3600000).length;
  res.json({ son1dk, son1saat, toplam: totalCount, bagli: serialConnected });
});

// Serial bağlantı
function connectSerial() {
  const port = new SerialPort({ path: 'COM3', baudRate: 9600, autoOpen: false });

  port.open((err) => {
    if (err) {
      console.log('COM3 açılamadı, 3sn sonra tekrar:', err.message);
      setTimeout(connectSerial, 3000);
      return;
    }
    serialConnected = true;
    console.log('COM3 bağlandı!');
    io.emit('conn-status', { bagli: true });

    const parser = port.pipe(new ReadlineParser({ delimiter: '\n' }));

    parser.on('data', (data) => {
      const val = data.trim();
      const mesafe = parseFloat(val);
      const algilandi = !isNaN(mesafe) && mesafe < 20 && mesafe > 2;
      const kayit = {
        zaman: new Date().toISOString(),
        deger: isNaN(mesafe) ? val : mesafe.toFixed(1),
        algilandi
      };

      lastValue = kayit.deger;
      sensorHistory.unshift(kayit);
      if (sensorHistory.length > 500) sensorHistory.pop();

      if (algilandi) {
        totalCount++;
        io.emit('urun-gecti', { toplam: totalCount, zaman: kayit.zaman, deger: kayit.deger });
      }

      io.emit('sensor-data', kayit);
      console.log('Veri:', val);
    });

    port.on('error', (err) => {
      console.log('Port hatası:', err.message);
      serialConnected = false;
      io.emit('conn-status', { bagli: false });
      setTimeout(connectSerial, 3000);
    });

    port.on('close', () => {
      serialConnected = false;
      io.emit('conn-status', { bagli: false });
      setTimeout(connectSerial, 3000);
    });
  });
}

connectSerial();

server.listen(3000, () => {
  console.log('Sunucu hazır: http://localhost:3000');
});
