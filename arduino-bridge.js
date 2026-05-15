// Bu dosyayı sadece kendi PC'nde çalıştıracaksın
// Arduino'dan veri okur, Railway'e gönderir

const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const https = require('https');

const RAILWAY_URL = 'konveyor-sistem-production.up.railway.app';

function sendToRailway(data) {
  const body = JSON.stringify(data);
  const options = {
    hostname: RAILWAY_URL,
    path: '/api/veri',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
  };
  const req = https.request(options, res => {
    console.log('Railway yanıt:', res.statusCode);
  });
  req.on('error', e => console.log('Railway hata:', e.message));
  req.write(body);
  req.end();
}

function connectSerial() {
  const port = new SerialPort({ path: 'COM3', baudRate: 9600, autoOpen: false });
  port.open((err) => {
    if (err) {
      console.log('COM3 açılamadı, 3sn sonra tekrar:', err.message);
      setTimeout(connectSerial, 3000);
      return;
    }
    console.log('COM3 bağlandı! Railway\'e veri gönderiliyor...');
    const parser = port.pipe(new ReadlineParser({ delimiter: '\n' }));
    parser.on('data', (data) => {
      const val = data.trim();
      const mesafe = parseFloat(val);
      const algilandi = !isNaN(mesafe) && mesafe < 20 && mesafe > 2;
      const kayit = { zaman: new Date().toISOString(), deger: isNaN(mesafe) ? val : mesafe.toFixed(1), algilandi };
      sendToRailway(kayit);
      console.log('Gönderildi:', val);
    });
    port.on('close', () => { console.log('Port kapandı, yeniden bağlanıyor...'); setTimeout(connectSerial, 3000); });
    port.on('error', () => { setTimeout(connectSerial, 3000); });
  });
}

connectSerial();
console.log('Arduino Bridge başladı...');
