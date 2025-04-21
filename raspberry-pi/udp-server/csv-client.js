const fs = require('fs');
const dgram = require('dgram');
const csv = require('csv-parser');

const client = dgram.createSocket('udp4');
const PORT = 41234;
const HOST = '192.168.54.126';

function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  

async function sendRow() {
    const stream = fs.createReadStream('smarteyeData.csv').pipe(csv({ separator: ';' }));

    for await (const row of stream) {
        const message = Buffer.from(JSON.stringify(row));

        client.send(message, PORT, HOST, (err) => {
            if (err) console.error('Error:', err);
            else console.log('Sent:', message.toString());
        });
        await wait(1000);
    }

}

sendRow();
